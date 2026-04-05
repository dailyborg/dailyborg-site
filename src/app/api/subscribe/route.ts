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
      await resend.emails.send({
        from: 'The Daily Borg <notifications@thedailyborg.com>',
        to: [email],
        subject: 'Welcome to The Record',
        html: `
          <div style="font-family: serif; color: #111;">
            <h2>Welcome to the Record.</h2>
            <p>You are now officially subscribed to verified intelligence updates.</p>
            <p><strong>Plan:</strong> ${plan === 'paid' ? 'Premium ($0.99/mo)' : 'Free'}</p>
            <p><strong>Frequency:</strong> ${freq}</p>
            ${tracked_politician ? `<p><strong>Borg Alert Active:</strong> You will now be notified of priority stance shifts or broken promises regarding ${tracked_politician.toUpperCase().replace('-', ' ')}.</p>` : ''}
            ${(tracked_politicians && tracked_politicians.length > 0) ? `<p><strong>Entities Tracked:</strong> ${tracked_politicians.map((p: string) => p.toUpperCase().replace('-', ' ')).join(', ')}</p>` : ''}
            ${topics?.length ? `<p><strong>Topics Tracked:</strong> ${topics.join(', ')}</p>` : ''}
            <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px; font-family: sans-serif; text-transform: uppercase;">The Daily Borg - Broadcast Operations & Reporting Grid</p>
          </div>
        `,
      });
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
