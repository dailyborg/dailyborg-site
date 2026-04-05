export interface Env {
    DB: D1Database;
    AI: any;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        const now = new Date();
        const minute = now.getMinutes();

        // Congress intake runs at the top of the hour
        if (minute < 10) {
            console.log(`[Discovery Engine] Running proactive congressional intake...`);
            await this.intakeCongress(env);
        }

        // Accountability scoring runs at minute 20-30
        if (minute >= 20 && minute < 30) {
            console.log(`[Discovery Engine] Running accountability scoring cycle...`);
            await this.scoreAccountability(env);
        }

        // Popularity scoring runs at minute 40-50
        if (minute >= 40 && minute < 50) {
            console.log(`[Discovery Engine] Running popularity scoring cycle...`);
            await this.scorePopularity(env);
        }

        // User request processing runs every cycle
        await this.processRequests(env);
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        console.log(`[Discovery Engine] Manual trigger received.`);
        const url = new URL(request.url);
        const action = url.searchParams.get('action') || 'all';

        if (action === 'intake') await this.intakeCongress(env);
        else if (action === 'score') await this.scoreAccountability(env);
        else if (action === 'popularity') await this.scorePopularity(env);
        else {
            await this.processRequests(env);
            await this.intakeCongress(env);
            await this.scoreAccountability(env);
            await this.scorePopularity(env);
        }

        return new Response("Discovery Pipeline Completed", { status: 200 });
    },

    // ====================================================================
    // ACCOUNTABILITY SCORING ENGINE (No AI — pure data comparison)
    // ====================================================================
    async scoreAccountability(env: Env) {
        console.log(`[Accountability] Starting scoring cycle...`);
        try {
            // Get politicians who haven't been scored in the last 24 hours
            const { results: politicians } = await env.DB.prepare(`
                SELECT id, name, slug FROM politicians 
                WHERE last_scored_at IS NULL OR last_scored_at < datetime('now', '-24 hours')
                LIMIT 10
            `).all();

            if (!politicians || politicians.length === 0) {
                console.log(`[Accountability] All politicians are up to date.`);
                return;
            }

            for (const pol of politicians as any[]) {
                // Count promises by status from our existing promises table
                const { results: promiseStats } = await env.DB.prepare(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Fulfilled' THEN 1 ELSE 0 END) as fulfilled,
                        SUM(CASE WHEN status = 'Broken' OR status = 'Reversed' THEN 1 ELSE 0 END) as broken,
                        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress
                    FROM promises WHERE politician_id = ?
                `).bind(pol.id).all();

                const stats = (promiseStats?.[0] || { total: 0, fulfilled: 0, broken: 0 }) as any;
                const total = stats.total || 0;
                const kept = stats.fulfilled || 0;
                const broken = stats.broken || 0;

                // Also count stance contradictions as a negative signal
                const { results: stanceStats } = await env.DB.prepare(`
                    SELECT COUNT(*) as contradictions FROM stance_changes
                    WHERE politician_id = ?
                `).bind(pol.id).all();

                const contradictions = (stanceStats?.[0] as any)?.contradictions || 0;

                // Calculate trustworthiness score
                // Formula: Base 50 + (kept percentage * 40) - (contradictions * 5), clamped 0-100
                let score: number | null = null;
                if (total > 0) {
                    const denominator = kept + broken;
                    const keepRate = denominator > 0 ? (kept / denominator) : 0.5;
                    score = Math.round(Math.min(100, Math.max(0,
                        50 + (keepRate * 40) - (contradictions * 5)
                    )));
                }

                // Also factor in evidence quality from the claims table
                const { results: evidenceStats } = await env.DB.prepare(`
                    SELECT AVG(e.trust_score) as avg_trust
                    FROM evidence e
                    JOIN claims c ON e.claim_id = c.id
                    WHERE c.politician_id = ?
                `).bind(pol.id).all();

                const avgEvidenceTrust = (evidenceStats?.[0] as any)?.avg_trust;
                if (avgEvidenceTrust && score !== null) {
                    // Blend evidence trust into final score (20% weight)
                    score = Math.round(score * 0.8 + (avgEvidenceTrust / 100) * 20);
                }

                // Update the politician record
                await env.DB.prepare(`
                    UPDATE politicians 
                    SET trustworthiness_score = ?,
                        promises_kept = ?,
                        promises_broken = ?,
                        promises_total = ?,
                        last_scored_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(score, kept, broken, total, pol.id).run();

                // Log to history for time-series charting
                if (score !== null) {
                    const histId = `th_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    await env.DB.prepare(`
                        INSERT INTO trustworthiness_history (id, politician_id, score, promises_kept, promises_broken)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(histId, pol.id, score, kept, broken).run();
                }

                console.log(`[Accountability] Scored ${pol.name}: trust=${score}, kept=${kept}/${total}`);
            }
        } catch (e: any) {
            console.error("[Accountability] Scoring failed:", e.message);
        }
    },

    // ====================================================================
    // POPULARITY SCORING (Article mention count + Wikipedia pageviews)
    // ====================================================================
    async scorePopularity(env: Env) {
        console.log(`[Popularity] Starting popularity scoring...`);
        try {
            const { results: politicians } = await env.DB.prepare(`
                SELECT id, name FROM politicians LIMIT 20
            `).all();

            if (!politicians || politicians.length === 0) return;

            for (const pol of politicians as any[]) {
                // Count article mentions in our own DB (free, no API needed)
                let mentionCount = 0;
                try {
                    const { results: mentions } = await env.DB.prepare(`
                        SELECT COUNT(*) as cnt FROM articles 
                        WHERE title LIKE ? OR content_html LIKE ?
                    `).bind(`%${pol.name}%`, `%${pol.name}%`).all();
                    mentionCount = (mentions?.[0] as any)?.cnt || 0;
                } catch (e) {
                    // articles table might not have content_html indexed
                }

                // Try Wikipedia pageview API (free, no auth needed)
                let wikiViews = 0;
                try {
                    const wikiTitle = encodeURIComponent(pol.name.replace(/ /g, '_'));
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    const startDate = thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '');
                    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');

                    const wikiUrl = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${wikiTitle}/monthly/${startDate}/${endDate}`;
                    const wikiRes = await fetch(wikiUrl, {
                        headers: { 'User-Agent': 'DailyBorg/1.0 (contact@dailyborg.com)' }
                    });

                    if (wikiRes.ok) {
                        const wikiData: any = await wikiRes.json();
                        const items = wikiData?.items || [];
                        wikiViews = items.reduce((sum: number, item: any) => sum + (item.views || 0), 0);
                    }
                } catch (e) {
                    // Wikipedia API might rate limit, that's fine
                }

                // Popularity = normalized score 0-100
                // Base from mentions (each mention = 5 pts, max 50) + wiki views (normalized to 50 pts)
                const mentionScore = Math.min(50, mentionCount * 5);
                const wikiScore = Math.min(50, Math.round((wikiViews / 500000) * 50)); // 500k views = max
                const popularity = mentionScore + wikiScore;

                await env.DB.prepare(`
                    UPDATE politicians SET popularity_score = ? WHERE id = ?
                `).bind(popularity, pol.id).run();

                console.log(`[Popularity] ${pol.name}: mentions=${mentionCount}, wikiViews=${wikiViews}, score=${popularity}`);
            }
        } catch (e: any) {
            console.error("[Popularity] Scoring failed:", e.message);
        }
    },

    // ====================================================================
    // IMAGE RESOLUTION PIPELINE (Wikimedia + AI Fallback)
    // ====================================================================
    async resolvePoliticianImage(env: Env, name: string, office: string, party: string): Promise<string | null> {
        try {
            const wikiTitle = encodeURIComponent(name.replace(/ /g, '_'));
            const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${wikiTitle}&pithumbsize=600&format=json`;
            const wikiRes = await fetch(wikiUrl);
            const wikiData: any = await wikiRes.json();

            const pages = wikiData?.query?.pages;
            if (pages) {
                const pageId = Object.keys(pages)[0];
                if (pageId && pageId !== "-1" && pages[pageId].thumbnail?.source) {
                    console.log(`[Image] Wikimedia image found for ${name}`);
                    return pages[pageId].thumbnail.source;
                }
            }
        } catch (e) {
            console.warn(`[Image] Wikimedia lookup failed for ${name}`, e);
        }

        // AI Fallback
        try {
            const prompt = `Professional portrait of a ${party} ${office} named ${name}, US politician, high quality, digital art, government background`;
            const response = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', { prompt });

            if (response) {
                const buffer = await new Response(response).arrayBuffer();
                const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                return `data:image/jpeg;base64,${base64}`;
            }
        } catch (e: any) {
            console.warn(`[Image] AI fallback failed for ${name}`, e.message);
        }

        return null;
    },

    // ====================================================================
    // PROACTIVE CONGRESSIONAL INTAKE
    // ====================================================================
    async intakeCongress(env: Env) {
        console.log(`[Discovery] Proactive Congressional Sync...`);
        try {
            const res = await fetch("https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.json");
            if (!res.ok) {
                console.warn("[Discovery] Could not fetch legislators. Skipping.");
                return;
            }

            const legislators: any[] = await res.json();
            const sample = legislators.slice(0, 5);

            for (const leg of sample) {
                const name = `${leg.name?.first} ${leg.name?.last}`;
                const existing = await env.DB.prepare("SELECT id FROM politicians WHERE name = ?").bind(name).first();
                if (existing) continue;

                const terms = leg.terms || [];
                const latestTerm = terms[terms.length - 1];
                if (!latestTerm) continue;

                const officeHeld = latestTerm.type === "sen" ? "U.S. Senate" : "U.S. House";
                const party = latestTerm.party || "Independent";
                const districtState = latestTerm.state + (latestTerm.district ? `-${latestTerm.district}` : "");

                const photoUrl = await this.resolvePoliticianImage(env, name, officeHeld, party);
                const polId = `pol_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                await env.DB.prepare(`
                    INSERT INTO politicians (id, slug, name, office_held, party, district_state, region_level, time_in_office, photo_url)
                    VALUES (?, ?, ?, ?, ?, ?, 'Federal', 'Active', ?)
                `).bind(polId, slug, name, officeHeld, party, districtState, photoUrl).run();

                console.log(`[Discovery] Mapped: ${name}`);
            }
        } catch (e: any) {
            console.error("[Discovery] Intake failed:", e.message);
        }
    },

    // ====================================================================
    // USER REQUEST PROCESSOR
    // ====================================================================
    async processRequests(env: Env) {
        const { results: pendingRequests } = await env.DB.prepare(
            `SELECT * FROM politician_requests WHERE status = 'Pending' LIMIT 5`
        ).all();

        if (!pendingRequests || pendingRequests.length === 0) return;

        for (const req of pendingRequests as any[]) {
            const requestedName = req.requested_name;
            try {
                let parsed: any = {
                    name: requestedName,
                    office_held: "State Official",
                    party: "Independent",
                    district_state: "USA",
                    region_level: "State",
                    political_platform_summary: "AI discovery pending further documentation."
                };

                try {
                    const aiPrompt = `Extract basic details of US political figure "${requestedName}". Return strict JSON: { "name": "...", "office_held": "...", "party": "...", "district_state": "...", "region_level": "...", "political_platform_summary": "..." }`;
                    const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: [{ role: 'user', content: aiPrompt }] });
                    const rawText = aiRes.response || aiRes;
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.warn("[Discovery] AI text parsing failed, using defaults.");
                }

                const photoUrl = await this.resolvePoliticianImage(env, parsed.name, parsed.office_held, parsed.party);
                const polId = `pol_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const slug = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                const stmt1 = env.DB.prepare(`
                    INSERT INTO politicians (id, slug, name, office_held, party, district_state, region_level, time_in_office, photo_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'New Intake', ?)
                `).bind(polId, slug, parsed.name, parsed.office_held, parsed.party, parsed.district_state, parsed.region_level, photoUrl);

                const claimId = `clm_${Date.now()}`;
                const stmt2 = env.DB.prepare(`
                    INSERT INTO claims (id, politician_id, type, content, date, context)
                    VALUES (?, ?, 'Fact', ?, DATE('now'), 'AI Initial Discovery')
                `).bind(claimId, polId, parsed.political_platform_summary);

                const stmt3 = env.DB.prepare(`
                    UPDATE politician_requests SET status = 'Verified', updated_at = CURRENT_TIMESTAMP WHERE id = ?
                `).bind(req.id);

                await env.DB.batch([stmt1, stmt2, stmt3]);
            } catch (err: any) {
                await env.DB.prepare(`UPDATE politician_requests SET status = 'Rejected', verification_notes = ? WHERE id = ?`).bind(`Discovery Error: ${err.message}`, req.id).run();
            }
        }
    }
}
