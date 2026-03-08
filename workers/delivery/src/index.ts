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
            <div style="margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
                <p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Inter', sans-serif; margin-bottom: 5px;">${a.desk.toUpperCase()}</p>
                <h2 style="font-family: 'Playfair Display', serif; font-size: 22px; margin-top: 0; margin-bottom: 10px; color: #0f172a;">
                    ${a.title}
                </h2>
                <p style="font-family: 'Inter', sans-serif; font-size: 15px; color: #334155; line-height: 1.6;">
                    ${a.excerpt}
                </p>
                <a href="https://dailyborg.com/${a.desk.toLowerCase()}/${a.slug}" style="display: inline-block; margin-top: 10px; color: #1e3a8a; text-decoration: none; font-weight: bold; font-family: 'Inter', sans-serif; font-size: 13px;">Read Full Briefing &rarr;</a>
            </div>
        `).join('');

        return `
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Inter', sans-serif; background-color: #fafafa;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900; letter-spacing: -0.02em; color: #020617; margin: 0;">The Daily Borg</h1>
                    <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; color: #64748b; margin-top: 5px;">Morning Edition</p>
                </div>
                
                <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
                    ${articleBlocks}
                </div>
                
                <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p>Delivered by The Daily Borg Automated Delivery Engine.</p>
                    <p><a href="https://dailyborg.com/settings" style="color: #94a3b8;">Manage Subscriptions</a></p>
                </div>
            </div>
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
