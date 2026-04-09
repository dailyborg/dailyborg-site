import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Resend } from 'resend';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { email, phone_number, plan_type, delivery_channel, frequency, topics, tracked_politician, tracked_politicians } = await request.json() as any;

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

    let db;
    let resendApiKey;

    try {
      const context = getRequestContext();
      const env = context.env as any;
      db = env.DB;
      resendApiKey = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
    } catch (e) {
      // Fallback for local Node.js Next dev server testing
      console.warn("Running outside Cloudflare context. Falling back to local DB module.");
      const { getDbBinding } = await import('../../../lib/db');
      db = await getDbBinding();
      resendApiKey = process.env.RESEND_API_KEY;
    }

    if (!db) {
      return NextResponse.json({ error: "Database not bound" }, { status: 500 });
    }

    // Auto-migrate in dev to bypass ephemeral Miniflare memory resets
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS subscribers (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            phone_number TEXT UNIQUE,
            plan_type TEXT DEFAULT 'free',
            delivery_channel TEXT DEFAULT 'email',
            frequency TEXT DEFAULT 'daily',
            topics TEXT,
            tracked_politicians TEXT DEFAULT '[]',
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            stripe_status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `).run();
    } catch (e) {
      console.warn("Auto-migration skipped or failed:", e);
    }

    const topicsJson = JSON.stringify(topics || []);
    const plan = plan_type || 'free';
    const channel = delivery_channel || 'email';
    const freq = frequency || 'daily';

    // Fetch Existing User if applicable
    let userQuery;
    let existingUser = null;

    if (email) {
      userQuery = await db.prepare('SELECT id, tracked_politicians FROM subscribers WHERE email = ?').bind(email).all();
      existingUser = userQuery.results?.[0];
    } else if (phone_number) {
      userQuery = await db.prepare('SELECT id, tracked_politicians FROM subscribers WHERE phone_number = ?').bind(phone_number).all();
      existingUser = userQuery.results?.[0];
    }

    const finalId = existingUser ? (existingUser as any).id : crypto.randomUUID();

    // Reconcile tracked_politicians JSON array
    let currentTracked: string[] = [];
    if (existingUser && (existingUser as any).tracked_politicians) {
      try {
        currentTracked = JSON.parse((existingUser as any).tracked_politicians);
      } catch (e) { }
    }

    // Maintain legacy tracked_politician string widget payload
    if (tracked_politician && !currentTracked.includes(tracked_politician)) {
      currentTracked.push(tracked_politician);
    }
    // Handle new wizard tracked_politicians array payload
    if (tracked_politicians && Array.isArray(tracked_politicians)) {
      for (const pol of tracked_politicians) {
        if (!currentTracked.includes(pol)) {
          currentTracked.push(pol);
        }
      }
    }
    const trackedJson = JSON.stringify(currentTracked);

    if (existingUser) {
      // Update existing record
      await db.prepare(`
            UPDATE subscribers SET 
                email = ?, 
                phone_number = ?, 
                plan_type = ?, 
                delivery_channel = ?, 
                frequency = ?, 
                topics = ?,
                tracked_politicians = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(
        email || null,
        phone_number || null,
        plan,
        channel,
        freq,
        topicsJson,
        trackedJson,
        finalId
      ).run();
    } else {
      // Insert new record
      await db.prepare(`
            INSERT INTO subscribers (id, email, phone_number, plan_type, delivery_channel, frequency, topics, tracked_politicians)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        finalId,
        email || null,
        phone_number || null,
        plan,
        channel,
        freq,
        topicsJson,
        trackedJson
      ).run();
    }

    // 2. Dispatch Welcome Email via Resend if email channel
    if (channel === 'email' && email && resendApiKey) {
      const resend = new Resend(resendApiKey);
      const { error: resendError } = await resend.emails.send({
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
                        <p style="margin: 10px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3em; color: #94a3b8; font-weight: 700;">Broadcast Operations & Reporting Grid</p>
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
                                  <span style="color: #f8fafc; font-size: 15px; font-weight: 600;">${plan === 'paid' ? 'Premium Protocol' : 'Standard Feed'}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #1e293b;">
                                  <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Dispatch Frequency</strong><br/>
                                  <span style="color: #f8fafc; font-size: 15px; font-weight: 600; text-transform: capitalize;">${freq}</span>
                                </td>
                              </tr>
                              ${tracked_politician || (tracked_politicians && tracked_politicians.length > 0) ? `
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #1e293b;">
                                  <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Entities Tracked</strong><br/>
                                  <span style="color: #f8fafc; font-size: 15px; font-weight: 600;">${[tracked_politician, ...(tracked_politicians || [])].filter(Boolean).map((p: string) => p.toUpperCase().replace('-', ' ')).join(', ')}</span>
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
                          <a href="https://dailyborg.com/admin" style="color: #cbd5e1; text-decoration: none;">Manage Subscriptions</a>
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
      });

      if (resendError) {
        console.error("Resend delivery failed during execution:", resendError);
      }
    } else if (channel === 'whatsapp' && phone_number) {
      // Future WhatsApp Welcome Message Trigger
      console.log(`[Twilio/WhatsApp Stub] Send welcome to ${phone_number}`);
    }

    return NextResponse.json({
      success: true,
      message: plan === 'paid' ? "Redirecting to standard checkout..." : "Subscription active.",
      id: finalId
    }, { status: 200 });

  } catch (error: any) {
    console.error("Subscription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
