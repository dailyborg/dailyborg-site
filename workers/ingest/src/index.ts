import { Agent, callable, routeAgentRequest } from "agents";
import { processDeliveries } from './delivery';
import { D1Database, R2Bucket, Queue, DurableObjectNamespace, MessageBatch } from "@cloudflare/workers-types";

interface Env {
    DB: D1Database;
    IMAGE_BUCKET: R2Bucket;
    AIML_API_KEY: string;
    UNSPLASH_ACCESS_KEY: string;
    RESEND_API_KEY: string;
    TWILIO_SID: string;
    TWILIO_TOKEN: string;
    TWILIO_WHATSAPP_NUMBER: string;
    ENRICHMENT_QUEUE: Queue<any>;
    IngestCoordinator: DurableObjectNamespace;
    AI: any;
}

// ============================================================
// Cloudflare Agent: IngestCoordinator
// A persistent, stateful agent that processes incoming article
// payloads. Uses AIML API (Gemini 3 Flash) for text enrichment
// and Unsplash / Nano Banana 2 for images.
// ============================================================
export class IngestCoordinator extends Agent<Env> {

    @callable()
    async processPayload(payload: any) {
        const { sourceUrl, title, rawContent, type } = payload;

        // Check if article already exists
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
        const existing = await this.env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
        if (existing) {
            console.log(`Article with slug '${slug}' already exists. Skipping.`);
            return { status: "skipped", reason: "duplicate" };
        }

        let articleObject: any = null;
        let isDraft = false;

        const enrichmentPrompt = `
          Analyze the following article content from ${sourceUrl}.
          Title: ${title}
          Content: ${rawContent}

          You are a seasoned journalist and senior political editor reporting on the news. Write an original, interesting, and engaging article based on this. Use a dash of metaphor or figurative language one or two times in the article where warranted to make it highly engaging and professional.
          STRICT REQUIREMENTS:
          1. The output contentHtml MUST be strictly between 450 and 600 words.
          2. You MUST extract or identify at least 2 distinct sources.

          Return a STRICTLY formatted JSON object EXACTLY matching this structure:
          {
            "canonical_event_slug": "...",
            "title": "...",
            "excerpt": "...",
            "contentHtml": "...",
            "keyTakeaways": ["...", "..."],
            "confidenceScore": 95,
            "suggestedHeroImagePrompt": "...",
            "desk": "Politics",
            "sources": [{"source_name": "...", "source_url": "...", "source_type": "..."}],
            "mentioned_candidates": ["First Last", "First Last"]
          }
          FOR "suggestedHeroImagePrompt": Provide a highly specific 2-3 word search query optimized for Unsplash that captures the EXACT emotional tone and subject matter. Do NOT just use the politicians names, use thematic elements. For example, if it's a lawsuit or pause on an order, use "Gavel Courtroom" instead of "Happy Politician".
          DO NOT output any conversational text. ONLY output the JSON object.
        `;

        // =======================================================
        // Fetch Global Settings
        // =======================================================
        let aiProvider = 'aiml';
        let dailyCap = 30;
        try {
            const settingsRes = await this.env.DB.prepare("SELECT key, value FROM system_settings").all();
            const settingsMap: any = (settingsRes.results || []).reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
            if (settingsMap.ai_provider) aiProvider = settingsMap.ai_provider;
            if (settingsMap.cloudflare_daily_operations_cap) dailyCap = parseInt(settingsMap.cloudflare_daily_operations_cap, 10);
        } catch (e) {}

        if (aiProvider === 'cloudflare') {
            const todayOps = await this.env.DB.prepare("SELECT COUNT(*) as count FROM ingestion_logs WHERE status = 'inserted' AND date(created_at) = date('now')").first();
            const count = (todayOps?.count as number) || 0;
            if (count >= dailyCap) {
                console.warn(`[Ingest] CLOUDFLARE QUOTA REACHED (${count}/${dailyCap}). Deferring.`);
                return { status: "deferred", reason: "quota" };
            }
        }

        // =======================================================
        // AI ENRICHMENT (Llama 3 or Gemini)
        // =======================================================
        if (aiProvider === 'cloudflare') {
            try {
                const cloudflarePrompt = enrichmentPrompt + "\nCRITICAL FORMATTING INSTRUCTION: Each paragraph in contentHtml MUST contain at least 4-6 sentences to form rich, dense journalistic columns. DO NOT produce listicles or single-sentence paragraphs. Output ONLY pure valid JSON, no markdown.";
                
                const aiResponse = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                    messages: [
                        { role: "system", content: "You are an AI journalist reporting on the news. Write like a seasoned human journalist to present the news in an interesting and engaging way. Use a dash of metaphor or figurative language one or two times in the article where warranted. You must return ONLY absolute valid JSON matching the exact schema." },
                        { role: "user", content: cloudflarePrompt }
                    ],
                    max_tokens: 2500
                });
                let rawText = (aiResponse as any).response;
                rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                
                // Extract just the JSON object
                const firstBrace = rawText.indexOf('{');
                const lastBrace = rawText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    rawText = rawText.substring(firstBrace, lastBrace + 1);
                }

                try {
                    articleObject = JSON.parse(rawText);
                } catch (e) {
                    // Fallback to strip problematic control characters if JSON.parse fails
                    try {
                        const safeText = rawText.replace(/[\n\r\t\\]/g, '');
                        articleObject = JSON.parse(safeText);
                    } catch (e2) {
                        console.error("Llama-3 JSON format irrevocably broken or empty.", rawText.substring(0, 100));
                        articleObject = null;
                    }
                }

                const validDesks = ['Politics','Crime','Business','Entertainment','Sports','Science','Education'];
                if (articleObject.desk && !validDesks.includes(articleObject.desk)) {
                    articleObject.desk = 'Politics';
                }
            } catch (e: any) {
                console.error("Cloudflare AI Fetch Failure:", e.message);
                await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                    .bind(crypto.randomUUID(), title.substring(0, 50), 'fetch_failure', `Cloudflare Net Error: ${e.message}`).run();
            }
        } else if (this.env.AIML_API_KEY && this.env.AIML_API_KEY.length > 5 && this.env.AIML_API_KEY !== 'mock') {
            try {
                const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${this.env.AIML_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "google/gemini-3-flash-preview",
                        messages: [{ role: "user", content: enrichmentPrompt }],
                        response_format: { type: "json_object" }
                    })
                });

                if (aiResponse.status === 401 || aiResponse.status === 403) {
                    const errBody = await aiResponse.text().catch(() => 'no body');
                    console.error(`ERR_AUTH: AI Authentication failed. Status: ${aiResponse.status}. Body: ${errBody.substring(0, 200)}`);
                    await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), title.substring(0, 50), 'auth_error', `AI Authentication Failed (401/403): ${errBody.substring(0, 100)}`).run();
                } else if (aiResponse.status === 429) {
                    console.error("ERR_QUOTA: AI API Quota exceeded.");
                    await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), title.substring(0, 50), 'quota_exceeded', 'AI API Quota exceeded (429)').run();
                } else if (!aiResponse.ok) {
                    const errBody = await aiResponse.text().catch(() => 'no body');
                    console.error(`ERR_HTTP: AI Provider returned ${aiResponse.status}. Body: ${errBody.substring(0, 200)}`);
                    await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), title.substring(0, 50), 'provider_error', `AI Provider Error (${aiResponse.status}): ${errBody.substring(0, 100)}`).run();
                } else {
                    const aiData = await aiResponse.json() as any;
                    articleObject = JSON.parse(aiData.choices[0].message.content);

                    // Normalize AI desk to valid categories only
                    const validDesks = ['Politics','Crime','Business','Entertainment','Sports','Science','Education'];
                    if (articleObject.desk && !validDesks.includes(articleObject.desk)) {
                        const deskMap: Record<string, string> = {
                            politics: 'Politics', crime: 'Crime', business: 'Business',
                            entertainment: 'Entertainment', sports: 'Sports',
                            science: 'Science', education: 'Education', standard: 'Politics'
                        };
                        articleObject.desk = deskMap[(type || '').toLowerCase()] || 'Politics';
                        console.log(`[Ingest] AI returned invalid desk, normalized to: ${articleObject.desk}`);
                    }
                }
            } catch (e: any) {
                console.error("AI Fetch Failure:", e.message);
                await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                    .bind(crypto.randomUUID(), title.substring(0, 50), 'fetch_failure', `AI Network Error: ${e.message}`).run();
            }
        }

        // =======================================================
        // FALLBACK: Abort instead of creating clones
        // =======================================================
        if (!articleObject || !articleObject.title) {
            console.error("AI Parsing Failed. Aborting ingestion of mock clones.");
            await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                .bind(crypto.randomUUID(), title.substring(0, 50), 'failed', `AI Parser returned empty result`).run();
            return { status: "failed", reason: "missing_payload" };
        }

        // =======================================================
        // IMAGE PIPELINE (3-Tier Matrix)
        // Tier 1: Wikimedia → Tier 2: Unsplash → Tier 3: AIML (if active)
        // =======================================================
        // Set baseline to empty string so frontend hash-fallback triggers if everything fails
        let heroImageUrl = ``;
        let imageSource = "default";

        // --- TIER 1: Wikimedia Action API ---
        if (articleObject.desk === "Politics" || articleObject.desk === "General") {
            try {
                const wikiSearch = articleObject.title.split(' ').slice(0, 3).join(' ');
                const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(wikiSearch)}&gsrlimit=1&prop=pageimages&pithumbsize=1024`);
                const wikiData = (await wikiRes.json()) as any;
                if (wikiData.query && wikiData.query.pages) {
                    const pages = Object.values(wikiData.query.pages) as any[];
                    if (pages.length > 0 && pages[0].thumbnail) {
                        heroImageUrl = pages[0].thumbnail.source;
                        imageSource = "wikimedia";
                        console.log(`[Tier 1] Wikimedia matched: ${heroImageUrl}`);
                    }
                }
            } catch (e) {}
        }

        // --- TIER 1: Unsplash ---
        try {
            if (this.env.UNSPLASH_ACCESS_KEY && this.env.UNSPLASH_ACCESS_KEY.length > 5) {
                let keywords = "";
                if (articleObject.suggestedHeroImagePrompt && articleObject.suggestedHeroImagePrompt.length > 3) {
                    keywords = articleObject.suggestedHeroImagePrompt;
                } else {
                    const stopWords = new Set(['the','a','an','of','in','on','for','to','and','is','are','as','at','by','its','how','why','what','with','from','has','have','that','this','into','over','after','new']);
                    keywords = articleObject.title
                        .replace(/[^a-zA-Z0-9\s]/g, '')
                        .split(/\s+/)
                        .filter((w: string) => w.length > 2 && !stopWords.has(w.toLowerCase()))
                        .slice(0, 5)
                        .join(' ');
                }

                console.log(`[Tier 1] Searching Unsplash for: "${keywords}"`);
                const unsplashRes = await fetch(
                    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&orientation=landscape&per_page=3&order_by=relevant`,
                    { headers: { 'Authorization': `Client-ID ${this.env.UNSPLASH_ACCESS_KEY}` } }
                );

                if (unsplashRes.ok) {
                    const unsplashData = await unsplashRes.json() as any;
                    if (unsplashData.results && unsplashData.results.length > 0) {
                        heroImageUrl = unsplashData.results[0].urls.regular;
                        imageSource = "unsplash";
                        console.log(`[Tier 1] ✅ Found Unsplash image: ${heroImageUrl.substring(0, 80)}...`);
                    } else {
                        console.log(`[Tier 1] No Unsplash results for "${keywords}"`);
                    }
                } else {
                    console.warn(`[Tier 1] Unsplash API error: ${unsplashRes.status}`);
                }
            }
        } catch (unsplashErr) {
            console.warn(`[Tier 1] Unsplash search failed:`, unsplashErr);
        }

        // --- TIER 3: Nano Banana 2 (paid fallback) ---
        if (imageSource === "default" && aiProvider === 'aiml') {
            try {
                if (this.env.AIML_API_KEY && this.env.AIML_API_KEY.length > 5 && this.env.AIML_API_KEY !== 'mock') {
                    console.log(`[Tier 3] No free image found. Generating with Nano Banana 2...`);
                    const imageRes = await fetch("https://api.aimlapi.com/v1/images/generations", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${this.env.AIML_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: "google/nano-banana-2",
                            prompt: articleObject.suggestedHeroImagePrompt,
                            aspect_ratio: "16:9",
                            resolution: "1K"
                        })
                    });

                    if (imageRes.ok) {
                        const imgData = await imageRes.json() as any;
                        heroImageUrl = imgData.data[0].url;
                        imageSource = "nano-banana-2";
                        console.log(`[Tier 3] ✅ Generated AI image: ${heroImageUrl}`);
                    } else {
                        const errText = await imageRes.text();
                        console.warn(`[Tier 3] Nano Banana 2 failed: ${imageRes.status} - ${errText}`);
                    }
                }
            } catch (imgErr) {
                console.error(`[Tier 3] Failed to generate image:`, imgErr);
            }
        } else if (imageSource === "default" && aiProvider === 'cloudflare') {
            console.log(`[Tier 3] Skipping AI Generation to strictly uphold Cost-Containment Protocol.`);
        }

        console.log(`Image sourced via: ${imageSource}`);

        // =======================================================
        // DATABASE INSERTION
        // =======================================================
        const finalArticleType = isDraft ? "draft" : (type || "standard");
        const approvalStatus = isDraft ? 'pending' : 'approved';
        const id = crypto.randomUUID();

        await this.env.DB.prepare(`
          INSERT INTO articles (id, slug, title, excerpt, content_html, author_id, article_type, confidence_score, desk, hero_image_url, approval_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            articleObject.canonical_event_slug,
            articleObject.title,
            articleObject.excerpt,
            articleObject.contentHtml,
            `auth_${String(Math.floor(Math.random() * 25) + 1).padStart(2, '0')}`,
            finalArticleType,
            articleObject.confidenceScore,
            articleObject.desk || "Politics",
            heroImageUrl,
            approvalStatus
        ).run();

        if (articleObject.sources && articleObject.sources.length > 0) {
            const stmts = articleObject.sources.map((s: any) => {
                return this.env.DB.prepare(`INSERT INTO article_sources (id, article_id, source_name, source_url, source_type) VALUES (?, ?, ?, ?, ?)`)
                    .bind(crypto.randomUUID(), id, s.source_name, s.source_url || null, s.source_type || 'unclassified');
            });
            await this.env.DB.batch(stmts);
        }

        // Push extracted "Sentinel" names to the Politician Discovery Engine
        if (articleObject.mentioned_candidates && articleObject.mentioned_candidates.length > 0) {
            const reqStmts = articleObject.mentioned_candidates.map((name: string) => {
                return this.env.DB.prepare(`
                    INSERT INTO politician_requests (id, requested_name, user_email, reference_link, status) 
                    VALUES (?, ?, 'sentinel@dailyborg.com', ?, 'Pending')
                `).bind(`req_${crypto.randomUUID().slice(0, 15)}`, name, sourceUrl);
            });
            try { await this.env.DB.batch(reqStmts); } catch (e) {
                console.warn("[Ingest] Failed pushing extracted candidates to discovery queue.");
            }
        }

        await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), articleObject.canonical_event_slug, 'inserted', `Successfully inserted article id: ${id}`).run();

        return { status: "inserted", articleId: id, imageSource };
    }
}

// ============================================================
// Worker Export Handlers
// ============================================================
export default {
    async scheduled(event: any, env: Env, ctx: any): Promise<void> {
        const cron = event.cron;
        let windowHours = 24;

        if (cron.includes(' 5')) {
            windowHours = 168;
            console.log("Weekly Schedule Detected");
        } else {
            console.log("Daily Schedule Detected");
        }

        ctx.waitUntil(processDeliveries(env, windowHours * 60 * 60 * 1000));
    },

    async fetch(request: Request, env: Env): Promise<Response> {
        // Route agent management requests (WebSocket, REST inspection)
        return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
    },

    async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
        // Get the singleton IngestCoordinator agent
        const id = env.IngestCoordinator.idFromName("global-coordinator");
        const stub = env.IngestCoordinator.get(id) as any;

        for (const message of batch.messages) {
            try {
                const result = await stub.processPayload(message.body);
                console.log(`Agent processed message: ${JSON.stringify(result)}`);
                message.ack();
            } catch (error: any) {
                console.error("Agent processing error:", error);
                try {
                    const title = message.body?.title || 'unknown';
                    await env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), title.substring(0, 50), 'failed', `Error: ${error.message || 'Unknown'}`).run();
                } catch (dbErr) {
                    console.error("Critical: Could not log failure to D1:", dbErr);
                }
                message.ack();
            }
        }
    }
};
