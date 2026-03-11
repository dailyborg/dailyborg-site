export interface Env {
    DB: D1Database;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(runActiveMonitoring(env));
    },

    // HTTP trigger for testing locally
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/__force_sentinel') {
            await runActiveMonitoring(env);
            return new Response('Sentinel Active Monitoring Pass Complete', { status: 200 });
        }
        return new Response('Sentinel Online', { status: 200 });
    }
};

async function runActiveMonitoring(env: Env) {
    try {
        console.log("Starting Sentinel Active Monitoring Sweep...");

        // 1. Fetch currently active politicians to monitor from the DB
        // We limit to active US officials.
        const { results: activePoliticians } = await env.DB.prepare(
            `SELECT id, name, slug FROM politicians WHERE country = 'US'`
        ).all();

        if (!activePoliticians || activePoliticians.length === 0) {
            console.log("No active politicians to monitor.");
            return;
        }

        console.log(`Monitoring ${activePoliticians.length} active politicians.`);

        // 2. Poll external live endpoints (e.g., White House Briefs, Congress.gov, News Wires).
        // Since we cannot scrape a real site natively in this simple test snippet, we'll hit a public 
        // mock endpoint or just use a placeholder array representing incoming intelligence wire data.

        // In a real production deployment, this would be an RSS fetch and XML parsing.
        const incomingIntelligenceStream = [
            {
                title: "Floor Statement on the Economy",
                content: "We must ensure economic stability for all constituents in the modern era.",
                source_url: "https://congress.gov/example-statement",
                detected_entities: ["alex-test", "j-d-vance", "smith-john"] // Mock AI extracted entities or regex matches
            },
            {
                title: "Press Release on Education Funding",
                content: "Education is the foundation of our future infrastructure.",
                source_url: "https://whitehouse.gov/example-brief",
                detected_entities: ["alex-test"]
            }
        ];

        let statementsAdded = 0;

        // 3. Entity Resolution: Check incoming stream against our DB slugs
        for (const intel of incomingIntelligenceStream) {
            for (const entitySlug of intel.detected_entities) {
                // Find matching politician
                const match = activePoliticians.find(p => p.slug === entitySlug);
                if (match) {
                    console.log(`Matched intel to politician: ${match.name}`);

                    // Create real-time append for their statements
                    const stmtId = `stmt_${crypto.randomUUID()}`;

                    // Simple distinct check using source_url so we don't insert duplicate statements every 15 mins
                    const existing = await env.DB.prepare(
                        `SELECT id FROM statements WHERE source_url = ? AND politician_id = ?`
                    ).bind(intel.source_url, match.id).first();

                    if (!existing) {
                        try {
                            await env.DB.prepare(`
                                INSERT INTO statements (id, politician_id, statement_date, content, source_url, tags)
                                VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, '[]')
                            `).bind(
                                stmtId,
                                match.id,
                                intel.content,
                                intel.source_url
                            ).run();
                            statementsAdded++;
                            console.log(`Live Inserted Statement for ${match.name}`);
                        } catch (dbErr) {
                            console.error(`Failed inserting statement for ${match.name}:`, dbErr);
                        }
                    } else {
                        console.log(`Statement already tracked for ${match.name}`);
                    }
                }
            }
        }

        console.log(`Sentinel Sweep Completed. New Records Added: ${statementsAdded}`);

    } catch (e) {
        console.error("Sentinel Critical Error:", e);
    }
}
