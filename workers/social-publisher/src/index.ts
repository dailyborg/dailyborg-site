export interface Env {
    DB: D1Database;
    AI: any;
    MAKE_WEBHOOK_URL?: string;
}

export default {
    // The scheduled handler runs when the Cron Trigger fires
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        console.log("Cron trigger fired:", event.cron);

        // We use waitUntil so the worker doesn't shut down before everything finishes
        ctx.waitUntil(this.processAutomatedPublishing(env));
    },

    async processAutomatedPublishing(env: Env) {
        // 1. Check if we have the Make.com Webhook URL
        if (!env.MAKE_WEBHOOK_URL) {
            console.warn("MAKE_WEBHOOK_URL is not set. Skipping social publishing.");
            return;
        }

        try {
            // 2. Fetch the latest articles from D1
            // For this example, we fetch the 20 most recent articles to let the AI pick from them
            const result = await env.DB.prepare(
                `SELECT slug, title, excerpt, desk, hero_image_url 
         FROM articles 
         ORDER BY publish_date DESC 
         LIMIT 20`
            ).all();

            if (!result.results || result.results.length === 0) {
                console.log("No articles found in D1 to publish.");
                return;
            }

            const articles = result.results;
            console.log(`Fetched ${articles.length} recent articles for evaluation.`);

            // 3. Prepare Prompt for AI Selection & Captioning
            const aiPrompt = `
You are the Executive Social Media Editor for "The Daily Borg" (a digital newspaper). 
Your job is to read the latest published articles and select the single BEST article to post on our social media networks (X, Facebook, LinkedIn, Instagram).
Choose the article that has the highest potential for viral engagement, human interest, or breaking news impact.

Here are the ${articles.length} latest articles:
${JSON.stringify(articles, null, 2)}

Instructions:
1. Select the top 1 article.
2. Write a highly engaging, punchy, click-worthy social media caption for it. DO NOT use emojis.
3. Output ONLY a valid JSON object in exactly this format with NO markdown wrapping, NO backticks, and NO other text before or after:
{
  "selectedSlug": "[slug of the chosen article]",
  "caption": "[your generated caption]"
}
`;

            // 4. Call Cloudflare Workers AI
            // We are using llama-3-8b-instruct which is very capable for summarization and JSON output
            const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
                messages: [{ role: 'user', content: aiPrompt }]
            });

            let aiOutput = aiResponse.response;

            // Clean up the output in case the AI added markdown block \`\`\`json ... \`\`\`
            if (aiOutput.startsWith('```json')) {
                aiOutput = aiOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            console.log("AI Response:", aiOutput);

            const parsedSelection = JSON.parse(aiOutput);
            const chosenSlug = parsedSelection.selectedSlug;
            const caption = parsedSelection.caption;

            // Find the full article object
            const chosenArticle = articles.find((a: any) => a.slug === chosenSlug) as any;
            if (!chosenArticle) {
                console.error("AI selected an invalid slug:", chosenSlug);
                return;
            }

            // 5. Build the Payload for Make.com
            const articleUrl = `https://thedailyborg.com/${chosenArticle.desk}/${chosenArticle.slug}`;
            const payload = {
                title: chosenArticle.title,
                caption: caption,
                url: articleUrl,
                image_url: chosenArticle.hero_image_url || null
            };

            console.log("Sending Payload to Make.com:", payload);

            // 6. Send the data to Make.com
            const webhookResponse = await fetch(env.MAKE_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!webhookResponse.ok) {
                throw new Error(`Make.com returned status ${webhookResponse.status}`);
            }

            console.log("Successfully posted to Make.com Webhook!");

        } catch (error) {
            console.error("Error in processAutomatedPublishing:", error);
        }
    }
};
