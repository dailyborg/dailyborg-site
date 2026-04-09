export interface Env {
    DB: D1Database;
    UNSPLASH_ACCESS_KEY: string;
    AIML_API_KEY: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Allows manual execution via Curl for a one-time heal!
        await healImages(env);
        return new Response("Image Medic Completed.", { status: 200 });
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Runs on CRON (every hour at HH:30)
        ctx.waitUntil(healImages(env));
    }
};

async function healImages(env: Env) {
    console.log("[Image Medic] Starting routine...");

    // Find up to 10 articles missing images (Process in small batches to respect CPU)
    const { results } = await env.DB.prepare(`
        SELECT id, slug, title, desk, excerpt 
        FROM articles 
        WHERE (hero_image_url = '' OR hero_image_url IS NULL) AND publish_date > datetime('now', '-3 days')
        LIMIT 10
    `).all();

    if (!results || results.length === 0) {
        console.log("[Image Medic] No missing images found. All clear.");
        return;
    }

    console.log(`[Image Medic] Found ${results.length} articles needing healing.`);

    // Stop words to filter out non-topic keywords from the title
    const stopWords = new Set(['the','a','an','of','in','on','for','to','and','is','are','as','at','by','its','how','why','what','with','from','has','have','that','this','into','over','after','new','about']);

    for (const article of results as any[]) {
        const title: string = article.title;
        const desk: string = article.desk || "Politics";
        const articleId: string = article.id;
        
        console.log(`\n🩺 Healing: "${title}"`);

        // Extract strict keywords for recycling and searching
        const words = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
        // Only take the longest, most unique descriptive words (proper nouns usually)
        const keywords = words
            .filter((w: string) => w.length > 4 && !stopWords.has(w.toLowerCase()))
            .slice(0, 3); // Max 3 highly specific keywords 

        let finalUrl = "";

        // =======================================================
        // PHASE 1: STRICT RECYCLING
        // Requires EXACT desk match AND matching AT LEAST 2 major keywords from the title.
        // =======================================================
        if (keywords.length >= 2) {
            console.log(`[Phase 1] Attempting strict recycle matching keywords: ${keywords.join(', ')}`);
            
            // Build the dynamic SQL query safely
            let sql = `SELECT hero_image_url FROM articles WHERE desk = ? AND hero_image_url LIKE 'http%' AND id != ? `;
            const binds: string[] = [desk, articleId];
            
            for (const kw of keywords) {
                sql += `AND title LIKE ? `;
                binds.push(`%${kw}%`);
            }
            sql += `ORDER BY publish_date DESC LIMIT 1`;

            const statement = env.DB.prepare(sql).bind(...binds);
            const recycleMatch = await statement.first();

            if (recycleMatch && recycleMatch.hero_image_url) {
                console.log(`[Phase 1] ♻️ SUCCESS! Recycled exact-match image: ${recycleMatch.hero_image_url}`);
                finalUrl = recycleMatch.hero_image_url as string;
            } else {
                console.log(`[Phase 1] No perfect historical match found.`);
            }
        }

        // =======================================================
        // PHASE 2: UNSPLASH FETCH
        // =======================================================
        if (!finalUrl && env.UNSPLASH_ACCESS_KEY && env.UNSPLASH_ACCESS_KEY.length > 5) {
            const searchQuery = keywords.length > 0 ? keywords.join(' ') : desk;
            console.log(`[Phase 2] Searching Unsplash for: "${searchQuery}"`);
            
            try {
                const unsplashRes = await fetch(
                    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&orientation=landscape&per_page=1`,
                    { headers: { 'Authorization': `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } }
                );

                if (unsplashRes.ok) {
                    const uData = await unsplashRes.json() as any;
                    if (uData.results && uData.results.length > 0) {
                        finalUrl = uData.results[0].urls.regular;
                        console.log(`[Phase 2] ✅ Unsplash visual secured: ${finalUrl.substring(0, 50)}...`);
                    }
                }
            } catch (e: any) {
                console.log(`[Phase 2] Unsplash error: ${e.message}`);
            }
        }

        // =======================================================
        // PHASE 3: AIML NANO-BANANA-2 (LAST RESORT)
        // =======================================================
        if (!finalUrl && env.AIML_API_KEY && env.AIML_API_KEY.length > 5 && env.AIML_API_KEY !== 'mock') {
            console.log(`[Phase 3] Booting Nano Banana 2 generation...`);
            // We use the full title plus excerpt context to generate a highly accurate image prompt
            const prompt = `Premium wide editorial photography of: ${title}. ${article.excerpt ? article.excerpt.substring(0, 50) : ''}`;
            
            try {
                const imageRes = await fetch("https://api.aimlapi.com/v1/images/generations", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${env.AIML_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "google/nano-banana-2",
                        prompt: prompt,
                        aspect_ratio: "16:9",
                        resolution: "1K"
                    })
                });

                if (imageRes.ok) {
                    const imgData = await imageRes.json() as any;
                    finalUrl = imgData.data[0].url;
                    console.log(`[Phase 3] ✅ AIML Generation Complete: ${finalUrl.substring(0, 50)}...`);
                } else {
                    console.error(`[Phase 3] AIML generation failed with status: ${imageRes.status}`);
                }
            } catch (e: any) {
                console.error(`[Phase 3] AIML error: ${e.message}`);
            }
        }

        // =======================================================
        // PHASE 4: DATABASE PATCH
        // =======================================================
        if (finalUrl) {
            await env.DB.prepare(`UPDATE articles SET hero_image_url = ? WHERE id = ?`)
                .bind(finalUrl, articleId)
                .run();
            console.log(`[Phase 4] 💾 Database updated for ${articleId}`);
        } else {
            console.log(`[Phase 4] ❌ ALL Tiers failed. Article remains un-healed.`);
        }
    }
    
    console.log("[Image Medic] Routine complete.");
}
