import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';
import { readEnv } from '@/lib/admin-auth';

export const runtime = 'edge';

// Strict enough to reject the shapes that used to get through ("a@b", "a@b.", spaces, unicode tricks).
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/; // E.164 only
const MAX_EMAIL_LENGTH = 254;
const MAX_TOPICS = 20;
const MAX_TOPIC_LENGTH = 40;
const GENERIC_ERROR = "Something went wrong. Please try again.";

/** 32 lowercase hex characters. Private to the subscriber; it is the only key an unsubscribe link needs. */
function newUnsubscribeToken(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as any;
    // plan_type is deliberately ignored. Only the Stripe webhook may move a subscriber to 'paid'.
    const { email: rawEmail, phone_number: rawPhone, delivery_channel, frequency, topics, tracked_politician, tracked_politicians } = body;
    const email = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim().toLowerCase() : undefined;
    const phone_number = typeof rawPhone === 'string' && rawPhone.trim() ? rawPhone.replace(/[^0-9+]/g, '') : undefined;

    if (email && (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email))) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (phone_number && !PHONE_RE.test(phone_number)) {
      return NextResponse.json({ error: "Please enter a valid phone number with country code, for example +12125550123" }, { status: 400 });
    }
    if (topics !== undefined && !Array.isArray(topics)) {
      return NextResponse.json({ error: "Invalid topics" }, { status: 400 });
    }
    if (Array.isArray(topics) && topics.length > MAX_TOPICS) {
      return NextResponse.json({ error: "Invalid topics" }, { status: 400 });
    }

    if (!email && !phone_number) {
      return NextResponse.json({ error: "Email or Phone Number is required" }, { status: 400 });
    }

    // Enforce channel requirements
    if (delivery_channel === 'whatsapp' && !phone_number) {
      return NextResponse.json({ error: "Phone number required for WhatsApp delivery" }, { status: 400 });
    }
    if (delivery_channel === 'email' && !email) {
      return NextResponse.json({ error: "Email required for Email delivery" }, { status: 400 });
    }

    const db = await getDbBinding();
    const resendApiKey = readEnv('RESEND_API_KEY');

    const cleanTopics = Array.isArray(topics)
      ? topics.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
              .slice(0, MAX_TOPICS)
              .map((t: string) => t.trim().slice(0, MAX_TOPIC_LENGTH))
      : undefined;
    const topicsJson = cleanTopics ? JSON.stringify(cleanTopics) : null;
    const channel = typeof delivery_channel === 'string' && delivery_channel ? delivery_channel : undefined;
    const freq = typeof frequency === 'string' && frequency ? frequency : undefined;

    // One indexed read: the existing row plus whether it was touched in the last minute (rate limit).
    const lookupSql = `
        SELECT id, tracked_politicians,
               CASE WHEN COALESCE(updated_at, created_at) >= datetime('now', '-60 seconds') THEN 1 ELSE 0 END AS recently_touched
        FROM subscribers WHERE ${email ? 'email' : 'phone_number'} = ? LIMIT 1`;
    const existingUser = await db.prepare(lookupSql).bind(email || phone_number).first() as any;

    if (existingUser && Number(existingUser.recently_touched) === 1) {
      return NextResponse.json({ error: "Please wait a minute before updating your subscription again." }, { status: 429 });
    }

    const finalId = existingUser ? (existingUser.id as string) : crypto.randomUUID();

    // Reconcile tracked_politicians JSON array
    let currentTracked: string[] = [];
    if (existingUser && existingUser.tracked_politicians) {
      try {
        const parsed = JSON.parse(existingUser.tracked_politicians);
        if (Array.isArray(parsed)) currentTracked = parsed.filter((p: unknown) => typeof p === 'string');
      } catch (e) { }
    }

    // Maintain legacy tracked_politician string widget payload
    let trackedSupplied = false;
    if (typeof tracked_politician === 'string' && tracked_politician) {
      trackedSupplied = true;
      if (!currentTracked.includes(tracked_politician)) currentTracked.push(tracked_politician);
    }
    // Handle new wizard tracked_politicians array payload
    if (Array.isArray(tracked_politicians)) {
      trackedSupplied = true;
      for (const pol of tracked_politicians) {
        if (typeof pol === 'string' && pol && !currentTracked.includes(pol)) currentTracked.push(pol);
      }
    }
    const trackedJson = JSON.stringify(currentTracked.slice(0, 50));
    const unsubscribeToken = newUnsubscribeToken();

    try {
      if (existingUser) {
        // Update existing record. Anything the caller did not send keeps the value it already had,
        // and plan_type plus the Stripe columns are never touched here.
        await db.prepare(`
              UPDATE subscribers SET
                  email = COALESCE(?, email),
                  phone_number = COALESCE(?, phone_number),
                  delivery_channel = COALESCE(?, delivery_channel),
                  frequency = COALESCE(?, frequency),
                  topics = COALESCE(?, topics),
                  tracked_politicians = COALESCE(?, tracked_politicians),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
          `).bind(
          email || null,
          phone_number || null,
          channel || null,
          freq || null,
          topicsJson,
          trackedSupplied ? trackedJson : null,
          finalId
        ).run();
      } else {
        // Insert new record. Every new subscriber starts on the free plan.
        await db.prepare(`
              INSERT INTO subscribers (id, email, phone_number, plan_type, delivery_channel, frequency, topics, tracked_politicians, unsubscribe_token)
              VALUES (?, ?, ?, 'free', ?, ?, ?, ?, ?)
          `).bind(
          finalId,
          email || null,
          phone_number || null,
          channel || 'email',
          freq || 'daily',
          topicsJson || '[]',
          trackedJson,
          unsubscribeToken
        ).run();
      }
    } catch (writeError: any) {
      if (/UNIQUE constraint/i.test(String(writeError?.message || ''))) {
        return NextResponse.json({ error: "That email or phone is already subscribed." }, { status: 409 });
      }
      throw writeError;
    }

    // 2. Dispatch the welcome email via Resend, only for a subscriber who is new.
    const isNewSubscriber = !existingUser;
    const effectiveChannel = channel || (existingUser ? undefined : 'email');
    if (isNewSubscriber && effectiveChannel === 'email' && email && resendApiKey) {
      const unsubscribeUrl = `https://dailyborg.com/api/unsubscribe?t=${unsubscribeToken}`;
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
        from: 'The Daily Borg <edition@dailyborg.com>',
        to: [email],
        subject: 'Welcome to The Record',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin: 0; padding: 0; background-color: #020617; font-family: 'Inter', -apple-system, sans-serif; color: #f8fafc;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 40px 20px;">
              <tr>
                <td align="center">

                  <!-- Main Glassmorphic Card -->
                  <table border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">

                    <!-- Header -->
                    <tr>
                      <td align="center" style="padding: 40px 40px 20px 40px;">
                        <img src="https://dailyborg.com/dailyborg-logo2.png" alt="Daily Borg Logo" width="80" style="display: block; margin-bottom: 20px;" />
                        <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 900; color: #f8fafc; letter-spacing: -0.02em;">The Daily Borg</h1>
                        <p style="margin: 10px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3em; color: #94a3b8; font-weight: 700;">Broadcast Operations &amp; Reporting Grid</p>
                      </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                      <td style="padding: 20px 40px 40px 40px;">
                        <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 30px;">
                            <h2 style="margin: 0 0 15px 0; font-size: 20px; font-weight: 700; color: #f8fafc;">Welcome to the Record.</h2>
                            <p style="margin: 0 0 25px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">You are now officially connected to the grid. Your intelligence feed has been successfully configured.</p>

                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #1e293b;">
                                  <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Clearance Level</strong><br/>
                                  <span style="color: #f8fafc; font-size: 15px; font-weight: 600;">Standard Feed</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #1e293b;">
                                  <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Dispatch Frequency</strong><br/>
                                  <span style="color: #f8fafc; font-size: 15px; font-weight: 600; text-transform: capitalize;">${freq || 'daily'}</span>
                                </td>
                              </tr>
                              ${currentTracked.length > 0 ? `
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #1e293b;">
                                  <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Entities Tracked</strong><br/>
                                  <span style="color: #f8fafc; font-size: 15px; font-weight: 600;">${currentTracked.map((p: string) => p.toUpperCase().replace(/-/g, ' ')).join(', ')}</span>
                                </td>
                              </tr>
                              ` : ''}
                            </table>

                            <div style="margin-top: 30px; text-align: center;">
                              <a href="https://dailyborg.com" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 8px; letter-spacing: 0.05em;">ENTER THE GRID</a>
                            </div>
                        </div>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #020617; padding: 25px 40px; text-align: center; border-bottom-left-radius: 24px; border-bottom-right-radius: 24px;">
                        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">This dispatch was autonomous generated by The Daily Borg Network.</p>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;">
                          <a href="https://dailyborg.com" style="color: #cbd5e1; text-decoration: none;">dailyborg.com</a> •
                          <a href="${unsubscribeUrl}" style="color: #cbd5e1; text-decoration: none;">Unsubscribe</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        }),
      }).catch(() => null);

      if (!resendRes || !resendRes.ok) {
        console.error("Resend delivery failed during execution:", resendRes ? resendRes.status : "network error");
      }
    } else if (isNewSubscriber && effectiveChannel === 'whatsapp' && phone_number) {
      // Future WhatsApp Welcome Message Trigger
      console.log("[Twilio/WhatsApp Stub] Send welcome message to a new WhatsApp subscriber.");
    }

    return NextResponse.json({
      success: true,
      message: "Subscription active.",
      id: finalId
    }, { status: 200 });

  } catch (error: any) {
    console.error("Subscription Error:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
