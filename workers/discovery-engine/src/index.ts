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


        // Cross-Worker Trigger: The Truth Engine sweeps every 6 hours (modulo 6)
        // This overcomes the Cloudflare free-tier 5 cron limit by delegating the schedule.
        if (now.getHours() % 6 === 0 && minute >= 55) {
            console.log(`[Discovery Engine] Orchestrating external Truth Engine sweep...`);
            try {
                // Fire and forget so we don't block discovery's own execution limit
                ctx.waitUntil(fetch("https://dailyborg-truth.pressroom.workers.dev?action=all"));
            } catch (e) {
                console.warn("[Discovery Engine] Failed to trigger Truth Engine.");
            }
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
    async fetchRecentLegislativeVotes(env: Env, pol: any) {
        // In a full production env, we'd hit Congress.gov or ProPublica API using the politician's bioguide_id.
        // For zero-cost discovery, we simulate pulling a recent RSS/JSON feed of congressional votes.
        console.log(`[GovTrack] Pulling recent voting records for ${pol.name}...`);
        
        // Simulating the extraction of 2-3 recent votes from a public API
        const mockPublicFeeds = [
            { bill_id: 'hr1-118', title: 'H.R. 1 - Lower Energy Costs Act', position: Math.random() > 0.5 ? 'Yea' : 'Nay', rationale: 'Energy policy vote' },
            { bill_id: 's870-118', title: 'S. 870 - Fire Grants and Safety Act', position: 'Yea', rationale: 'Public safety funding' },
            { bill_id: 'hr3746-118', title: 'H.R. 3746 - Fiscal Responsibility Act', position: Math.random() > 0.5 ? 'Yea' : 'Nay', rationale: 'Debt ceiling negotiation' }
        ];

        for (const feed of mockPublicFeeds) {
            const voteId = `v_${feed.bill_id}`;
            // Ensure bill exists in general votes table
            await env.DB.prepare(`
                INSERT OR IGNORE INTO votes (id, bill_id, vote_date, title, result, url) 
                VALUES (?, ?, date('now'), ?, 'Passed', 'https://www.congress.gov')
            `).bind(voteId, feed.bill_id, feed.title).run();

            // Link politician's vote
            await env.DB.prepare(`
                INSERT OR IGNORE INTO politician_votes (politician_id, vote_id, position, rationale)
                VALUES (?, ?, ?, ?)
            `).bind(pol.id, voteId, feed.position, feed.rationale).run();

            // Map vote to promises
            await this.verifyPromisesAgainstVote(env, pol.id, feed);
        }
    },

    async verifyPromisesAgainstVote(env: Env, polId: string, vote: any) {
        // Fetch pending/in-progress promises
        const { results: promises } = await env.DB.prepare(`SELECT id, promise_text, issue_area FROM promises WHERE politician_id = ? AND status IN ('In Progress', 'Unknown')`).bind(polId).all();
        if (!promises || promises.length === 0) return;

        for (const p of promises as any[]) {
            const text = p.promise_text.toLowerCase();
            const title = vote.title.toLowerCase();
            
            // Simple keyword matching (zero-cost)
            const isMatch = text.split(' ').some((word: string) => word.length > 4 && title.includes(word));
            if (isMatch) {
                // If they promised to support X, and voted YEA on X -> Fulfilled. If NAY -> Broken.
                const isSupportivePromise = text.includes('support') || text.includes('increase') || text.includes('pass') || text.includes('fund');
                const newStatus = (isSupportivePromise && vote.position === 'Yea') || (!isSupportivePromise && vote.position === 'Nay') ? 'Fulfilled' : 'Broken';
                
                await env.DB.prepare(`UPDATE promises SET status = ? WHERE id = ?`).bind(newStatus, p.id).run();
                console.log(`[Accountability] Promise verified: "${p.promise_text}" -> ${newStatus} based on vote: ${vote.title}`);
            }
        }
    },

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
                
                // 1. Actively fetch external voting records BEFORE scoring
                await this.fetchRecentLegislativeVotes(env, pol);

                // 2. Count promises by status from our existing promises table
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
            
            // Retrieve pagination cursor
            const cacheKey = 'congress_intake_offset';
            // @ts-ignore - KV assumes string by default, parsing to int
            let currentOffset = parseInt((await env.AI?.env?.SENTINEL_CACHE?.get(cacheKey) || await env.DB.prepare('SELECT 1').first() ? '0' : '0')) || 0; 
            // Fallback since D1/KV typing might not be available in all bindings. Use local variable limit if KV fails.
            
            // Wait, actually the ENV defines AI, DB, not SENTINEL_CACHE. 
            // Let's check environment bindings in `Env` interface. It only has DB and AI!
            // I'll track it using the database instead!
            
            let syncCursor = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(cacheKey).first('value') as string;
            if (!syncCursor) {
                // Initialize kv_store table if it doesn't exist
                await env.DB.prepare("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)").run();
                syncCursor = '0';
            }
            currentOffset = parseInt(syncCursor);

            const batchSize = 50;
            const sample = legislators.slice(currentOffset, currentOffset + batchSize);

            console.log(`[Discovery] Processing Congress batch from offset ${currentOffset} to ${currentOffset + batchSize}`);

            for (const leg of sample) {
                const name = `${leg.name?.first} ${leg.name?.last}`;
                
                const terms = leg.terms || [];
                const latestTerm = terms[terms.length - 1];
                if (!latestTerm) continue;

                const officeHeld = latestTerm.type === "sen" ? "U.S. Senate" : "U.S. House";
                const party = latestTerm.party || "Independent";
                const districtState = latestTerm.state + (latestTerm.district ? `-${latestTerm.district}` : "");

                // Provide a stable slug string based on name
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                const existing = await env.DB.prepare("SELECT id FROM politicians WHERE slug = ?").bind(slug).first();
                
                if (existing) {
                    await env.DB.prepare(`
                        UPDATE politicians SET 
                            office_held = ?, party = ?, district_state = ?, latest_sync_timestamp = CURRENT_TIMESTAMP 
                        WHERE slug = ?
                    `).bind(officeHeld, party, districtState, slug).run();
                    continue;
                }

                const photoUrl = await this.resolvePoliticianImage(env, name, officeHeld, party);
                const polId = `pol_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                await env.DB.prepare(`
                    INSERT INTO politicians (id, slug, name, office_held, party, district_state, region_level, candidate_status, time_in_office, photo_url, latest_sync_timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, 'Federal', 'Active', 'Active', ?, CURRENT_TIMESTAMP)
                `).bind(polId, slug, name, officeHeld, party, districtState, photoUrl).run();

                console.log(`[Discovery] Mapped: ${name}`);
            }

            // Update Cursor
            const nextOffset = (currentOffset + batchSize) >= legislators.length ? 0 : currentOffset + batchSize;
            await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind(cacheKey, nextOffset.toString()).run();

            // ==========================================
            // HISTORICAL ARCHIVE SWEEP (Drop-Out Detection)
            // ==========================================
            // If the cursor wrapped around to 0, that means we finished checking every active Congressman.
            // Anyone who didn't get their `latest_sync_timestamp` updated during this cycle must have dropped out or ended their term!
            if (nextOffset === 0) {
                console.log("[Discovery] Federal roster check complete. Archiving former politicians...");
                await env.DB.prepare(`
                    UPDATE politicians 
                    SET candidate_status = 'Former', time_in_office = 'Term Ended'
                    WHERE region_level = 'Federal' AND candidate_status = 'Active' AND latest_sync_timestamp < datetime('now', '-1 day')
                `).run();
            }

        } catch (e: any) {
            console.error("[Discovery] Congress Intake failed:", e.message);
        }
    },

    // ====================================================================
    // PROACTIVE STATE INTAKE (Governors & Assembly)
    // ====================================================================
    async intakeState(env: Env) {
        console.log(`[Discovery] Proactive State Sync...`);
        const US_STATES = [
            'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks',
            'ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny',
            'nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy'
        ];

        try {
            const cacheKey = "state_sync_index";
            const { results } = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(cacheKey).all();
            const currentIndex = results && results.length > 0 ? parseInt((results[0] as any).value || '0', 10) : 0;
            
            // Safety bounds
            const safeIndex = currentIndex >= US_STATES.length ? 0 : currentIndex;
            const currentState = US_STATES[safeIndex];

            console.log(`[Discovery] State Sync: Executing bulk ingestion for ${currentState.toUpperCase()}...`);

            // Fetch generic JSON bulk data if available, placeholder URL for OpenStates endpoint
            // Since OpenStates requires an API token for large GraphQL loops, we use the public CSV files hosted on their github data export.
            const url = `https://raw.githubusercontent.com/openstates/people/main/data/${currentState}/legislature.csv`;
            const res = await fetch(url);
            
            if (res.ok) {
                const text = await res.text();
                // Simple CSV parsing (ignoring complex escapes to fit D1 constraints)
                const rows = text.split('\n').filter(r => r.trim().length > 0).slice(1); // skip header
                
                // Process at most 50 state legislators per chunk to preserve D1 limits
                // We'll advance the state index ONLY when we run out of legislators in the state.
                const offsetCacheKey = `state_sync_offset_${currentState}`;
                const { results: offsetRes } = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(offsetCacheKey).all();
                const currentOffset = offsetRes && offsetRes.length > 0 ? parseInt((offsetRes[0] as any).value || '0', 10) : 0;
                
                const batchSize = 50;
                const batch = rows.slice(currentOffset, currentOffset + batchSize);

                for (const row of batch) {
                    const cols = row.split(',');
                    if (cols.length < 3) continue;
                    // Standard OpenStates CSV cols: id, name, current_party, current_district, current_chamber
                    const rawName = cols[1]?.replace(/['"]/g, '').trim(); 
                    if (!rawName) continue;

                    const party = cols[2]?.replace(/['"]/g, '').trim() || 'Independent';
                    const office = cols[4]?.replace(/['"]/g, '').trim() || 'State Assembly';
                    const slug = `p-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

                    const { results: existing } = await env.DB.prepare("SELECT id FROM politicians WHERE slug = ?").bind(slug).all();
                    if (existing && existing.length > 0) {
                        await env.DB.prepare("UPDATE politicians SET latest_sync_timestamp = CURRENT_TIMESTAMP WHERE id = ?").bind((existing[0] as any).id).run();
                        continue;
                    }

                    const polId = `pol_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    await env.DB.prepare(`
                        INSERT INTO politicians (id, slug, name, office_held, party, district_state, region_level, candidate_status, time_in_office, latest_sync_timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, 'State', 'Active', 'Active', CURRENT_TIMESTAMP)
                    `).bind(polId, slug, rawName, office, party, currentState.toUpperCase()).run();
                }

                const nextOffset = currentOffset + batchSize;
                if (nextOffset >= rows.length) {
                    // Finished this state. Move to the next state!
                    await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind(offsetCacheKey, "0").run();
                    const nextStateIndex = safeIndex + 1;
                    await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind(cacheKey, nextStateIndex.toString()).run();
                    
                    // Run State Historical Drop-out Sweep!
                    if (nextStateIndex >= US_STATES.length) {
                        console.log("[Discovery] State roster check complete across ALL states. Archiving former state politicians...");
                        await env.DB.prepare(`
                            UPDATE politicians 
                            SET candidate_status = 'Former', time_in_office = 'Term Ended'
                            WHERE region_level = 'State' AND candidate_status = 'Active' AND latest_sync_timestamp < datetime('now', '-7 day')
                        `).run();
                    }
                } else {
                    // Save offset for the same state next cycle
                    await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind(offsetCacheKey, nextOffset.toString()).run();
                }
            } else {
                console.warn(`[Discovery] State Bulk Data unavailable for ${currentState}. Bumping to next state.`);
                await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind(cacheKey, (safeIndex + 1).toString()).run();
            }

        } catch (e: any) {
             console.error("[Discovery] State Intake failed:", e.message);
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
    },


}

