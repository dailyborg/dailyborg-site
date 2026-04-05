export interface Env {
    DB: D1Database;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(this.runSelfHealing(env));
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/__run_check') {
            await this.runSelfHealing(env);
            return new Response('Sentinel self-healing check complete.', { status: 200 });
        }
        return new Response('Sentinel Online', { status: 200 });
    },

    async runSelfHealing(env: Env) {
        console.log("[Sentinel] Starting Self-Healing Coverage Check...");
        
        try {
            // 1. Check for missing articles in specific desks (last 12h)
            const desks = ["Politics", "Science", "Business", "Entertainment", "Sports", "Crime", "Education"];
            let missingDesks = [];
            
            for (const desk of desks) {
                const { count } = await env.DB.prepare(
                    "SELECT COUNT(*) as count FROM articles WHERE desk = ? AND publish_date > datetime('now', '-12 hours')"
                ).bind(desk).first() as { count: number };
                
                if (count === 0) {
                    missingDesks.push(desk);
                }
            }

            // 2. Check for missing days (April 2 & 3)
            const { day2Count } = await env.DB.prepare(
                "SELECT COUNT(*) as day2Count FROM articles WHERE publish_date LIKE '2026-04-02%'"
            ).first() as { day2Count: number };
            
            const { day3Count } = await env.DB.prepare(
                "SELECT COUNT(*) as day3Count FROM articles WHERE publish_date LIKE '2026-04-03%'"
            ).first() as { day3Count: number };

            // 3. Check Politicians health
            const { polCount } = await env.DB.prepare("SELECT COUNT(*) as polCount FROM politicians").first() as { polCount: number };
            const { officeVariety } = await env.DB.prepare("SELECT COUNT(DISTINCT office_held) as officeVariety FROM politicians").first() as { officeVariety: number };

            // 4. Check for Content Staleness (> 24 hours)
            const { lastArticleAge } = await env.DB.prepare(
                "SELECT (julianday('now') - julianday(MAX(publish_date))) * 24 as lastArticleAge FROM articles"
            ).first() as { lastArticleAge: number };

            console.log(`[Sentinel] Coverage Report: Missing Desks: ${missingDesks.join(', ') || 'None'} | Apr2: ${day2Count} | Apr3: ${day3Count} | Pols: ${polCount} | Variety: ${officeVariety} | Staleness: ${lastArticleAge?.toFixed(1)}h`);

            let actionsTaken = [];

            // 5. Trigger Scraper if news is missing or stale
            if (missingDesks.length > 0 || day2Count === 0 || day3Count === 0 || lastArticleAge > 24) {
                console.log("[Sentinel] Detected content gaps or staleness. Triggering Scraper Deep-Scout...");
                try {
                    // Trigger deep scout if staleness detected
                    const scraperUrl = `https://dailyborg-scraper.pressroom.workers.dev${lastArticleAge > 24 ? '?deep=true' : ''}`;
                    await fetch(scraperUrl, { method: "POST" });
                    actionsTaken.push(lastArticleAge > 24 ? "Staleness Healed" : "Scraper Triggered");
                } catch (e) {
                    console.error("[Sentinel] Failed to trigger Scraper:", e);
                }
            }

            // 6. Trigger Discovery if Matrix is low or lacking variety
            if (polCount < 20 || officeVariety < 2) {
                console.log(`[Sentinel] Intelligence Matrix ${polCount < 20 ? 'low' : 'lacking variety'}. Triggering Discovery Engine...`);
                try {
                    await fetch("https://dailyborg-discovery.pressroom.workers.dev", { method: "POST" });
                    actionsTaken.push("Discovery Triggered");
                } catch (e) {
                    console.error("[Sentinel] Failed to trigger Discovery:", e);
                }
            }

            // 7. Log the healing event
            const status = actionsTaken.length > 0 ? 'healed' : 'healthy';
            const message = actionsTaken.length > 0 
                ? `Sentinel detected gaps and took actions: ${actionsTaken.join(', ')}. Missing: ${missingDesks.join(', ')}` 
                : "Sentinel check complete. All systems healthy.";

            await env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                .bind(crypto.randomUUID(), 'sentinel-health', status, message).run();

        } catch (error: any) {
            console.error("[Sentinel] Healing cycle failed:", error);
            await env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                .bind(crypto.randomUUID(), 'sentinel-health', 'error', `Sentinel Error: ${error.message}`).run();
        }
    }
};
