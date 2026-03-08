export interface Env {
    DB: D1Database;
    RESEND_API_KEY: string;
    TWILIO_SID: string;
    TWILIO_TOKEN: string;
    TWILIO_WHATSAPP_NUMBER: string;
}

export async function processDeliveries(env: Env, timeWindowMs: number) {
    console.log(`[DELIVERY ENGINE] Waking up. Processing subscribers for window: ${timeWindowMs / (60 * 60 * 1000)} hours`);

    // 1. Fetch recent articles from the specified window
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMs).toISOString();

    const articlesQuery = await env.DB.prepare(`
        SELECT slug, title, excerpt, content_html, desk, publish_date, hero_image_url 
        FROM articles 
        WHERE publish_date >= ? AND article_type IN ('standard', 'breaking')
        ORDER BY publish_date DESC
    `).bind(windowStart).all();

    if (!articlesQuery.success) {
        throw new Error("Failed to fetch recent articles for delivery");
    }

    const articles = articlesQuery.results as any[];
    if (articles.length === 0) {
        console.log(`[DELIVERY ENGINE] No new articles published in the last ${timeWindowMs / (60 * 60 * 1000)} hours. Sleeping.`);
        return;
    }

    console.log(`[DELIVERY ENGINE] Found ${articles.length} new articles to distribute.`);

    // 2. Fetch subscribers
    const frequencyTarget = timeWindowMs > (48 * 60 * 60 * 1000) ? 'weekly' : 'daily';

    const subscribersQuery = await env.DB.prepare(`
        SELECT id, email, phone_number, plan_type, delivery_channel, frequency, topics
        FROM subscribers
        WHERE frequency = ?
    `).bind(frequencyTarget).all();

    const subscribers = subscribersQuery.results as any[];
    if (subscribers.length === 0) {
        console.log(`[DELIVERY ENGINE] No subscribers configured for '${frequencyTarget}' delivery.`);
        return;
    }

    console.log(`[DELIVERY ENGINE] Analyzing preferences for ${subscribers.length} '${frequencyTarget}' subscribers...`);

    const canSendEmails = env.RESEND_API_KEY && env.RESEND_API_KEY.length > 5;

    // 3. Dispatch Loop
    let emailsSent = 0;
    let whatsappTracked = 0;

    for (const sub of subscribers) {
        let userTopics: string[] = [];
        try {
            userTopics = JSON.parse(sub.topics || '[]');
        } catch (e) { }

        const relevantArticles = articles.filter(art => {
            const mappedContentStr = `${art.desk} ${art.title}`.toLowerCase();
            return userTopics.some((t: string) => {
                const topicNorm = t.toLowerCase().replace('u.s. ', '');
                return mappedContentStr.includes(topicNorm) || t === 'All';
            });
        });

        if (relevantArticles.length === 0) {
            console.log(`  -> Skip: No relevant news for ${sub.email || sub.phone_number}`);
            continue;
        }

        const isPaid = sub.plan_type === 'paid';
        const isEmail = sub.delivery_channel === 'email';

        // 3b. Assemble Message
        if (isEmail) {
            if (!canSendEmails) {
                console.log(`  -> Dev Mode: Would dispatch EMAIL to ${sub.email} with ${relevantArticles.length} articles.`);
                continue;
            }

            const htmlContent = buildEmailHtml(relevantArticles, isPaid, frequencyTarget, userTopics);

            try {
                const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        from: 'The Daily Borg <notifications@thedailyborg.com>',
                        to: [sub.email],
                        subject: `Your ${frequencyTarget === 'daily' ? 'Daily' : 'Weekly'} Intelligence Brief`,
                        html: htmlContent
                    })
                });

                if (resendRes.ok) {
                    emailsSent++;
                } else {
                    console.error("Resend API failed:", await resendRes.text());
                }
            } catch (e) {
                console.error("Fetch email dispatch failed:", e);
            }

        } else if (sub.delivery_channel === 'whatsapp') {
            const mdContent = buildWhatsAppMarkdown(relevantArticles, isPaid);

            if (!env.TWILIO_SID || !env.TWILIO_TOKEN) {
                console.log(`  -> Dev Mode: Would dispatch WHATSAPP to ${sub.phone_number} with ${relevantArticles.length} items.`);
                continue;
            }

            try {
                const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${btoa(env.TWILIO_SID + ":" + env.TWILIO_TOKEN)}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        'From': `whatsapp:${env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`, // Default to Twilio Sandbox
                        'To': `whatsapp:${sub.phone_number}`,
                        'Body': mdContent
                    })
                });

                if (twilioRes.ok) {
                    whatsappTracked++;
                } else {
                    console.error("Twilio API failed:", await twilioRes.text());
                }
            } catch (e) {
                console.error("Fetch WhatsApp dispatch failed:", e);
            }
        }
    }

    console.log(`[DELIVERY ENGINE] Complete. Sent ${emailsSent} emails, logged ${whatsappTracked} whatsapp triggers.`);
}

function buildEmailHtml(articles: any[], isPaid: boolean, frequency: string, topics: string[]): string {
    let output = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #1a2b4c;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-top: 5px solid #1a2b4c;">
            <h1 style="font-size: 24px; margin-bottom: 5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">The Daily Borg</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 30px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: bold;">${frequency} Intelligence Brief</p>
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 30px;">Tracked Subjects: ${topics.join(', ')}</p>
    `;

    articles.forEach(art => {
        const urlPath = art.desk.toLowerCase().replace(' grid', '').replace(/ /g, '-');

        output += `
            <div style="margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 10px;">${art.title}</h2>
                ${art.hero_image_url ? `<img src="${art.hero_image_url}" style="width: 100%; border-radius: 4px; margin-bottom: 15px;"/>` : ''}
                
                ${isPaid
                ? `
                        <div style="color: #334155; font-size: 16px; line-height: 1.6; padding-left: 15px; border-left: 3px solid #1a2b4c;">
                            ${art.content_html}
                        </div>
                      `
                : `
                        <p style="color: #475569; font-size: 16px; line-height: 1.5;">${art.excerpt}</p>
                        <a href="https://thedailyborg.com/${urlPath}/${art.slug}" style="display: inline-block; background-color: #1a2b4c; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; font-size: 13px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Access Full Intelligence</a>
                      `
            }
            </div>
        `;
    });

    output += `
            <div style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
                <p>This transmission is secure. ${isPaid ? 'Premium Director Account' : 'Standard Agent Account'}</p>
                <p>&copy; ${new Date().getFullYear()} The Daily Borg Operations</p>
            </div>
        </div>
        </div>
    `;
    return output;
}

function buildWhatsAppMarkdown(articles: any[], isPaid: boolean): string {
    let output = `*THE DAILY BORG* 🦅\n_Verified Intelligence Update_\n\n`;

    articles.forEach(art => {
        const urlPath = art.desk.toLowerCase().replace(' grid', '').replace(/ /g, '-');

        output += `*■ ${art.title}*\n`;
        if (isPaid) {
            const rawBody = art.content_html.replace(/<[^>]*>?/gm, '');
            output += `${rawBody}\n\n`;
        } else {
            output += `_${art.excerpt}_\n\n`;
            output += `Read more: https://thedailyborg.com/${urlPath}/${art.slug}\n\n`;
        }
    });

    output += `---\n_Manage preferences reply /grid_`;
    return output;
}
