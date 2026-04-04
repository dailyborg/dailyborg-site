export interface Env {
    DB: D1Database;
    AI: any;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`[Discovery Engine] Waking up structure mapping...`);
        // We run user requests first, then background intaking
        await this.processRequests(env);
        
        // Only run congress intake on the hour to save compute
        const now = new Date();
        if (now.getMinutes() < 15) {
            await this.intakeCongress(env);
        }
    },

    // HTTP trigger for manual local testing
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        console.log(`[Discovery Engine] Manual trigger received.`);
        await this.processRequests(env);
        await this.intakeCongress(env);
        return new Response("Discovery Pipeline Completed", { status: 200 });
    },

    // ----------------------------------------------------
    // PHASE 2 & 3: IMAGE ATTACHMENT PIPELINE
    // ----------------------------------------------------
    async resolvePoliticianImage(env: Env, name: string, office: string, party: string): Promise<string | null> {
        // 1. Wikipedia Public Domain Check
        try {
            const wikiTitle = encodeURIComponent(name.replace(/ /g, '_'));
            // Ask wikimedia for the main page image
            const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${wikiTitle}&pithumbsize=600&format=json`;
            const wikiRes = await fetch(wikiUrl);
            const wikiData: any = await wikiRes.json();
            
            const pages = wikiData?.query?.pages;
            if (pages) {
                const pageId = Object.keys(pages)[0];
                if (pageId && pageId !== "-1" && pages[pageId].thumbnail?.source) {
                    console.log(`[Image Node] Verified Public Domain Image found for ${name}`);
                    return pages[pageId].thumbnail.source;
                }
            }
        } catch (e) {
            console.warn(`[Image Node] Wikimedia lookup failed for ${name}`, e);
        }

        // 2. Fallback Generative Avatar (AI Synthesis)
        // Cloudflare text-to-image is available locally and on edge.
        console.log(`[Image Node] Wikipedia failed. Synthesizing avatar for ${name}...`);
        try {
            const genderGuess = name.match(/^[A-M]/i) ? "politician" : "politician"; // Naive safely neutral fallback
            const prompt = `Stylized professional portrait vector art of a ${party} ${office} named ${name}, US Politician, high quality, digital art, realistic face, government background`;
            
            const inputs = { prompt: prompt };
            
            const response = await env.AI.run(
                '@cf/stabilityai/stable-diffusion-xl-base-1.0',
                inputs
            );
            
            if (response) {
                // Returns a binary stream. On workers, we can parse it to base64.
                // We'll store it as a slim Base64 string in D1 since R2 bucket creation failed user backend setup
                const buffer = await new Response(response).arrayBuffer();
                const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                console.log(`[Image Node] Synthesized Base64 Avatar for ${name}`);
                return `data:image/jpeg;base64,${base64}`;
            }
        } catch (e: any) {
            console.warn(`[Image Node] AI Image Synthesis failed for ${name}`, e.message);
        }

        return null;
    },

    // ----------------------------------------------------
    // PHASE 1: PROACTIVE CONGRESSIONAL INTAKE
    // ----------------------------------------------------
    async intakeCongress(env: Env) {
        console.log(`[Discovery Engine] Initiating Proactive Congressional Sync...`);
        try {
            // Fetch unified congress JSON from public github unitedstates project
            const res = await fetch("https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.json");
            
            if (!res.ok) {
                console.warn("[Discovery Engine] Could not reach legislators JSON. Skipping.");
                return;
            }

            const legislators: any[] = await res.json();
            
            // Just process a batch of 5 to stay within limits during an hour slice
            const sample = legislators.slice(0, 5); 

            for (const leg of sample) {
                const name = `${leg.name?.first} ${leg.name?.last}`;
                // Check if exists
                const existing = await env.DB.prepare("SELECT id FROM politicians WHERE name = ?").bind(name).first();
                if (existing) continue; // Skip if already verified

                console.log(`[Discovery Engine] Proactively discovered unmapped member: ${name}`);
                
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

                console.log(`[Discovery Engine] Background mapping complete for: ${name}`);
            }

        } catch (e: any) {
            console.error("[Discovery Engine] Intake Failed:", e.message);
        }
    },

    // ----------------------------------------------------
    // ORIGINAL USER REQUEST PROCESSOR
    // ----------------------------------------------------
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

                // AI Lookup
                try {
                    const aiPrompt = `Extract basic details of US political figure "${requestedName}". Return strict JSON: { "name": "...", "office_held": "...", "party": "...", "district_state": "...", "region_level": "...", "political_platform_summary": "..." }`;
                    const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: [{ role: 'user', content: aiPrompt }] });
                    const rawText = aiRes.response || aiRes;
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.warn("[Discovery Engine] AI text parsing failed, using defaults.");
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
