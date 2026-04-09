export interface Env {
    DB: D1Database;
    RESEND_API_KEY: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_PHONE_NUMBER: string; // The Twilio WhatsApp sender number
}

interface Subscriber {
    id: string;
    email: string | null;
    phone_number: string | null;
    plan_type: string;
    delivery_channel: 'email' | 'whatsapp';
    frequency: 'daily' | 'weekly';
    topics: string; // JSON string array
}

interface Article {
    slug: string;
    title: string;
    excerpt: string;
    desk: string;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(this.processDeliveries(env));
    },

    // Allow manual triggering via HTTP for testing
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== "POST") {
            return new Response("Method not allowed. Use POST to trigger manually.", { status: 405 });
        }

        ctx.waitUntil(this.processDeliveries(env));
        return new Response("Delivery pipeline triggered in background.", { status: 202 });
    },

    async processDeliveries(env: Env) {
        console.log("Starting Delivery Engine Pipeline...");

        // 1. Fetch Active Subscribers
        // For a production app, we would chunk this to avoid D1 limits, but for this demo 
        // we pull all active generic accounts.
        const { results: subscribers } = await env.DB.prepare(
            `SELECT * FROM subscribers WHERE stripe_status IS NULL OR stripe_status = 'active'`
        ).all<Subscriber>();

        if (!subscribers || subscribers.length === 0) {
            console.log("No active subscribers found. Exiting Pipeline.");
            return;
        }

        console.log(`Found ${subscribers.length} active subscribers. Determining content overlaps...`);

        // Cache recently published articles to avoid hammering D1 per subscriber
        // We fetch the top 10 highest-ranked articles from the last 24/48 hours across all desks.
        const { results: topArticles } = await env.DB.prepare(
            `SELECT slug, title, excerpt, desk FROM articles 
             ORDER BY publish_date DESC, confidence_score DESC 
             LIMIT 15`
        ).all<Article>();

        if (!topArticles || topArticles.length === 0) {
            console.log("No recent articles found. Skipping dispatch.");
            return;
        }

        const dispatchPromises = [];

        // 2. Build personalized payload for each subscriber
        for (const sub of subscribers) {
            let userTopics: string[] = [];
            try {
                userTopics = JSON.parse(sub.topics || '[]');
            } catch (e) {
                userTopics = [];
            }

            // Filter the daily cache for their specific interests. 
            // If they didn't specify topics, give them the top 3 overall.
            let curatedContent = topArticles;
            if (userTopics.length > 0) {
                curatedContent = topArticles.filter(a => userTopics.includes(a.desk));
            }

            // Limit payload to top 3 hits
            curatedContent = curatedContent.slice(0, 3);

            if (curatedContent.length === 0) continue; // Nothing met their criteria today

            // 3. Dispatch to specific channel
            if (sub.delivery_channel === 'email' && sub.email && env.RESEND_API_KEY) {
                dispatchPromises.push(this.sendEmail(env, sub.email, curatedContent));
            } else if (sub.delivery_channel === 'whatsapp' && sub.phone_number && env.TWILIO_ACCOUNT_SID) {
                dispatchPromises.push(this.sendWhatsApp(env, sub.phone_number, curatedContent));
            }
        }

        // Wait for all dispatches to complete
        const results = await Promise.allSettled(dispatchPromises);

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        console.log(`Delivery Run Complete: ${successCount} successful, ${failCount} failed.`);
    },

    async sendEmail(env: Env, email: string, articles: Article[]) {
        const htmlBody = this.buildEmailHTML(articles);

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: "The Daily Borg <edition@dailyborg.com>", // Default verified sender
                to: [email],
                subject: "Your Daily Borg Briefing",
                html: htmlBody
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Resend API Error for ${email}:`, err);
            throw new Error(`Email dispatch failed for ${email}`);
        }
    },

    async sendWhatsApp(env: Env, phone: string, articles: Article[]) {
        const textBody = this.buildWhatsAppText(articles);

        // Twilio requires form-urlencoded data, not JSON
        const params = new URLSearchParams();
        params.append('To', `whatsapp:${phone}`);
        params.append('From', `whatsapp:${env.TWILIO_PHONE_NUMBER}`);
        params.append('Body', textBody);

        const token = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${token}`
            },
            body: params
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Twilio Error to ${phone}:`, err);
            throw new Error(`WhatsApp dispatch failed for ${phone}`);
        }
    },

    buildEmailHTML(articles: Article[]): string {
        const articleBlocks = articles.map(a => `
            <tr>
              <td style="padding: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <p style="margin: 0 0 8px 0; color: #3b82f6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Inter', -apple-system, sans-serif;">${a.desk.toUpperCase()}</p>
                <h2 style="margin: 0 0 12px 0; font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #f8fafc; line-height: 1.3;">
                    ${a.title}
                </h2>
                <p style="margin: 0 0 16px 0; font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    ${a.excerpt}
                </p>
                <a href="https://dailyborg.com/${a.desk.toLowerCase()}/${a.slug}" style="display: inline-block; color: #60a5fa; text-decoration: none; font-weight: 600; font-family: 'Inter', -apple-system, sans-serif; font-size: 13px;">Read Full Briefing &rarr;</a>
              </td>
            </tr>
        `).join('');

        return `
          <!DOCTYPE html>
          <html>
          <body style="margin: 0; padding: 0; background-color: #020617; font-family: 'Inter', -apple-system, sans-serif; color: #f8fafc;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 40px 20px;">
              <tr>
                <td align="center">
                  
                  <table border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                    
                    <!-- Header -->
                    <tr>
                      <td align="center" style="padding: 40px 40px 20px 40px;">
                        <img src="https://dailyborg.com/dailyborg-logo2.png" alt="Daily Borg Logo" width="80" style="display: block; margin-bottom: 20px;" />
                        <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900; color: #f8fafc; letter-spacing: -0.02em;">The Daily Borg</h1>
                        <p style="margin: 8px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; color: #94a3b8; font-weight: 700;">Morning Intelligence Briefing</p>
                      </td>
                    </tr>
                    
                    <!-- Content Wrapper -->
                    <tr>
                      <td style="padding: 20px 30px 40px 30px;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden;">
                            ${articleBlocks}
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td align="center" style="background-color: #020617; padding: 25px 40px; border-bottom-left-radius: 24px; border-bottom-right-radius: 24px;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">Delivered by The Daily Borg Automated Delivery Engine.</p>
                        <a href="https://dailyborg.com/admin" style="color: #475569; text-decoration: none; font-size: 12px; font-weight: 600;">Manage Your Preferences</a>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
    },

    buildWhatsAppText(articles: Article[]): string {
        let text = `*The Daily Borg Briefing*\n\n`;

        articles.forEach((a, i) => {
            text += `📰 *${a.title}*\n_${a.excerpt}_\n🔗 https://dailyborg.com/${a.desk.toLowerCase()}/${a.slug}\n\n`;
        });

        text += `\n_Manage settings: dailyborg.com/settings_`;
        return text;
    }
};
