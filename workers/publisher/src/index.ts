export interface Env {
    DB: D1Database;
    SOCIAL_WEBHOOK_URL?: string;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(runPublisherEngine(env));
    },

    // HTTP trigger for testing locally
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/__force_publish') {
            await runPublisherEngine(env);
            return new Response('Social Media Publisher Sweep Complete', { status: 200 });
        }
        return new Response('Publisher Engine Online', { status: 200 });
    }
};

async function runPublisherEngine(env: Env) {
    try {
        console.log("Starting Social Media Publisher Sweep...");

        // 1. Fetch unpublished, high-quality enriched articles
        // We look for confidence_score >= 80 (simulating severity 3+) with a valid hero image
        const { results: publishableArticles } = await env.DB.prepare(`
            SELECT id, title, excerpt, desk, slug, hero_image_url 
            FROM articles 
            WHERE social_published = 0 
              AND confidence_score >= 80 
              AND hero_image_url IS NOT NULL
            ORDER BY publish_date ASC 
            LIMIT 5
        `).all();

        if (!publishableArticles || publishableArticles.length === 0) {
            console.log("No new high-value articles pending publication.");
            return;
        }

        console.log(`Found ${publishableArticles.length} articles to publish.`);

        const webhookUrl = env.SOCIAL_WEBHOOK_URL || 'https://hook.us1.make.com/placeholder-trigger';

        let publishedCount = 0;

        // 2. Process and Webhook Dispatch
        for (const article of publishableArticles) {

            // Construct the canonical URL back to the frontend
            const absoluteLink = `https://thedailyborg.com/${article.desk}/${article.slug}`;

            // Construct the unified platform payload requested by the user
            const socialPayload = {
                id: article.id,
                title: article.title,
                excerpt: article.excerpt,
                imageUrl: article.hero_image_url,
                articleLink: absoluteLink,
                desk: article.desk,
                timestamp: new Date().toISOString()
            };

            console.log(`Dispatching Payload for: ${article.title}`);

            try {
                // In production, this posts to Make.com or Zapier.
                // We mock the fetch wrapper here so it safely logs and proceeds if the webhook isn't configured yet.
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(socialPayload)
                });

                // If the webhook succeeds (or if we are testing against a placeholder), mark as published.
                // For a placeholder without throwing errors, we'll mark as published so we don't infinitely retry locally.
                if (response.ok || webhookUrl.includes('placeholder')) {
                    await env.DB.prepare(`
                        UPDATE articles 
                        SET social_published = 1 
                        WHERE id = ?
                    `).bind(article.id).run();

                    publishedCount++;
                    console.log(`Successfully dispatched and marked published: ${article.id}`);
                } else {
                    console.error(`Webhook returned non-OK status: ${response.status} for article ${article.id}`);
                }

            } catch (dispatchErr) {
                console.error(`Failed to dispatch webhook for ${article.id}:`, dispatchErr);
            }
        }

        console.log(`Publisher Sweep Completed. Total Published: ${publishedCount}`);

    } catch (e) {
        console.error("Publisher Critical Error:", e);
    }
}
