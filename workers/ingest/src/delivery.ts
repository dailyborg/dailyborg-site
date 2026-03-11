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

    // 1b. Fetch recent Borg Alerts (Contradictions & Broken Promises)
    const stanceChangesQuery = await env.DB.prepare(`
        SELECT sc.id, sc.topic, sc.shift_description, sc.created_at, p.name as politician_name, p.slug as politician_slug
        FROM stance_changes sc
        JOIN politicians p ON sc.politician_id = p.id
        WHERE sc.created_at >= ?
    `).bind(windowStart).all();

    const brokenPromisesQuery = await env.DB.prepare(`
        SELECT pr.id, pr.promise_text, pr.status_date, p.name as politician_name, p.slug as politician_slug
        FROM promises pr
        JOIN politicians p ON pr.politician_id = p.id
        WHERE pr.status = 'Broken' AND pr.status_date >= ?
    `).bind(windowStart).all();

    const alerts = {
        stances: (stanceChangesQuery.results as any[]) || [],
        promises: (brokenPromisesQuery.results as any[]) || []
    };

    if (articles.length === 0 && alerts.stances.length === 0 && alerts.promises.length === 0) {
        console.log(`[DELIVERY ENGINE] No new articles or alerts published in the last ${timeWindowMs / (60 * 60 * 1000)} hours. Sleeping.`);
        return;
    }

    console.log(`[DELIVERY ENGINE] Found ${articles.length} articles, ${alerts.stances.length} stance shifts, ${alerts.promises.length} broken promises.`);

    // 2. Fetch subscribers
    const frequencyTarget = timeWindowMs > (48 * 60 * 60 * 1000) ? 'weekly' : 'daily';

    const subscribersQuery = await env.DB.prepare(`
        SELECT id, email, phone_number, plan_type, delivery_channel, frequency, topics, tracked_politicians
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
        let trackedPoliticians: string[] = [];
        try {
            userTopics = JSON.parse(sub.topics || '[]');
        } catch (e) { }
        try {
            trackedPoliticians = JSON.parse(sub.tracked_politicians || '[]');
        } catch (e) { }

        const relevantArticles = articles.filter(art => {
            const mappedContentStr = `${art.desk} ${art.title}`.toLowerCase();
            return userTopics.some((t: string) => {
                const topicNorm = t.toLowerCase().replace('u.s. ', '');
                return mappedContentStr.includes(topicNorm) || t === 'All';
            });
        });

        const relevantAlerts = {
            stances: alerts.stances.filter(s => trackedPoliticians.includes(s.politician_slug)),
            promises: alerts.promises.filter(p => trackedPoliticians.includes(p.politician_slug))
        };

        if (relevantArticles.length === 0 && relevantAlerts.stances.length === 0 && relevantAlerts.promises.length === 0) {
            console.log(`  -> Skip: No relevant news or alerts for ${sub.email || sub.phone_number}`);
            continue;
        }

        const isPaid = sub.plan_type === 'paid';
        const isEmail = sub.delivery_channel === 'email';

        // 3b. Assemble Message
        if (isEmail) {
            if (!canSendEmails) {
                console.log(`  -> Dev Mode: Would dispatch EMAIL to ${sub.email} with ${relevantArticles.length} articles and ${relevantAlerts.stances.length + relevantAlerts.promises.length} alerts.`);
                continue;
            }

            const htmlContent = buildEmailHtml(relevantArticles, relevantAlerts, isPaid, frequencyTarget, userTopics);

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
            const mdContent = buildWhatsAppMarkdown(relevantArticles, relevantAlerts, isPaid);

            if (!env.TWILIO_SID || !env.TWILIO_TOKEN) {
                console.log(`  -> Dev Mode: Would dispatch WHATSAPP to ${sub.phone_number}`);
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

function buildEmailHtml(articles: any[], alerts: any, isPaid: boolean, frequency: string, topics: string[]): string {
    let output = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #1a2b4c;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-top: 5px solid #1a2b4c;">
            <h1 style="font-size: 24px; margin-bottom: 5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">The Daily Borg</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 30px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: bold;">${frequency} Intelligence Brief</p>
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 30px;">Tracked Subjects: ${topics.join(', ')}</p>
    `;

    // Inject High-Priority Borg Alerts First
    if (alerts.stances.length > 0 || alerts.promises.length > 0) {
        output += `<div style="background-color: #fef2f2; border: 2px solid #ef4444; padding: 20px; margin-bottom: 40px;">
            <h2 style="color: #ef4444; font-size: 16px; font-weight: 900; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.1em;">⚠️ Priority Borg Alerts</h2>
        `;

        alerts.stances.forEach((stance: any) => {
            output += `
                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #fca5a5;">
                    <strong style="color: #7f1d1d; font-size: 14px; text-transform: uppercase;">STANCE SHIFT DETECTED: ${stance.politician_name}</strong>
                    <p style="margin: 5px 0 0 0; color: #991b1b; font-weight: bold;">Topic: ${stance.topic}</p>
                    <p style="margin: 5px 0 0 0; color: #b91c1c; font-size: 14px;">${stance.shift_description || 'A notable contradiction or evolution was logged in the public record.'}</p>
                    <a href="https://thedailyborg.com/borg-record/politicians/${stance.politician_slug}" style="color: #ef4444; font-size: 12px; font-weight: bold; text-decoration: none; margin-top: 8px; display: inline-block;">VIEW THE MATRIX &rarr;</a>
                </div>
            `;
        });

        alerts.promises.forEach((promise: any) => {
            output += `
                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #fca5a5;">
                    <strong style="color: #7f1d1d; font-size: 14px; text-transform: uppercase;">BROKEN PROMISE: ${promise.politician_name}</strong>
                    <p style="margin: 5px 0 0 0; color: #b91c1c; font-size: 14px;">"${promise.promise_text}"</p>
                    <a href="https://thedailyborg.com/borg-record/politicians/${promise.politician_slug}" style="color: #ef4444; font-size: 12px; font-weight: bold; text-decoration: none; margin-top: 8px; display: inline-block;">VIEW THE MATRIX &rarr;</a>
                </div>
            `;
        });
        output += `</div>`;
    }

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

function buildWhatsAppMarkdown(articles: any[], alerts: any, isPaid: boolean): string {
    let output = `*THE DAILY BORG* 🦅\n_Verified Intelligence Update_\n\n`;

    if (alerts.stances.length > 0 || alerts.promises.length > 0) {
        output += `🚨 *PRIORITY BORG ALERTS* 🚨\n\n`;
        alerts.stances.forEach((stance: any) => {
            output += `*STANCE SHIFT: ${stance.politician_name}*\n`;
            output += `Topic: ${stance.topic}\n`;
            output += `_${stance.shift_description || 'A notable change was logged.'}_\n`;
            output += `Matrix: https://thedailyborg.com/borg-record/politicians/${stance.politician_slug}\n\n`;
        });
        alerts.promises.forEach((promise: any) => {
            output += `*BROKEN PROMISE: ${promise.politician_name}*\n`;
            output += `_${promise.promise_text}_\n`;
            output += `Matrix: https://thedailyborg.com/borg-record/politicians/${promise.politician_slug}\n\n`;
        });
        output += `---\n\n`;
    }

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
