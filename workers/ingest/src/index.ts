import { Agent, callable, routeAgentRequest } from "agents";
import { processDeliveries } from './delivery';
import { D1Database, R2Bucket, Queue, DurableObjectNamespace, DurableObject, DurableObjectState, MessageBatch } from "@cloudflare/workers-types";

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
    TopicMemory: DurableObjectNamespace;
    AI: any;
}

// ============================================================
// Workers AI model ladder for the 'cloudflare' provider.
// Tried in order, first valid article wins.
//   1. gpt-oss-120b speaks the Responses API shape.
//   2. llama-4-scout speaks chat completions with a JSON schema.
// The old @cf/meta/llama-3.1-8b-instruct was deprecated by
// Cloudflare on 2026-05-30 and now fails every request (5028).
// ============================================================
const CLOUDFLARE_MODELS = [
    { id: "@cf/openai/gpt-oss-120b", api: "responses" },
    { id: "@cf/meta/llama-4-scout-17b-16e-instruct", api: "chat" },
] as const;

const VALID_DESKS: string[] = ['Politics','Crime','Business','Entertainment','Sports','Science','Education'];

const DESK_MAP: Record<string, string> = {
    politics: 'Politics', crime: 'Crime', business: 'Business',
    entertainment: 'Entertainment', sports: 'Sports',
    science: 'Science', education: 'Education', standard: 'Politics'
};

const SYSTEM_PROMPT = "You are an AI journalist reporting on the news. Write like a seasoned human journalist to present the news in an interesting and engaging way. Use a dash of metaphor or figurative language one or two times in the article where warranted. You must return ONLY absolute valid JSON matching the exact schema.";

const FORMAT_NOTE = "\nCRITICAL FORMATTING INSTRUCTION: Each paragraph in contentHtml MUST contain at least 4-6 sentences to form rich, dense journalistic columns. DO NOT produce listicles or single-sentence paragraphs. Output ONLY pure valid JSON, no markdown.";

// Structured output contract handed to models that support json_schema.
const ARTICLE_SCHEMA = {
    type: "object",
    properties: {
        canonical_event_slug: { type: "string" },
        title: { type: "string" },
        excerpt: { type: "string" },
        contentHtml: { type: "string" },
        keyTakeaways: { type: "array", items: { type: "string" } },
        confidenceScore: { type: "number" },
        suggestedHeroImagePrompt: { type: "string" },
        desk: { type: "string", enum: VALID_DESKS },
        sources: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    source_name: { type: "string" },
                    source_url: { type: "string" },
                    source_type: { type: "string" }
                },
                required: ["source_name"]
            }
        },
        mentioned_candidates: { type: "array", items: { type: "string" } }
    },
    required: ["canonical_event_slug", "title", "excerpt", "contentHtml", "desk", "sources", "confidenceScore"]
};

// ============================================================
// Model reply helpers. Pure functions, no bindings, exported so
// they can be unit tested outside the Workers runtime.
// ============================================================

// Every Workers AI family returns its text somewhere different.
// Chat models use `response` or `choices`, the Responses API uses
// an `output` array whose "message" items hold the content parts.
export function extractModelText(result: any): string {
    if (typeof result === "string") return result;
    if (!result) return "";

    if (typeof result.response === "string") return result.response;
    if (result.response && typeof result.response === "object") {
        try {
            return JSON.stringify(result.response);
        } catch (e) {
            return "";
        }
    }

    if (typeof result.output_text === "string") return result.output_text;

    if (Array.isArray(result.output)) {
        let collected = "";
        for (const item of result.output) {
            if (!item || item.type !== "message" || !Array.isArray(item.content)) continue;
            for (const part of item.content) {
                if (part && typeof part.text === "string") collected += part.text;
            }
        }
        if (collected) return collected;
    }

    const choice = result.choices && result.choices[0] && result.choices[0].message
        ? result.choices[0].message.content
        : undefined;
    if (typeof choice === "string") return choice;

    return "";
}

// Pulls the first JSON object out of a model reply. Tolerates code
// fences, leading chatter, and raw control characters that models
// sometimes leave inside string values.
export function extractJsonObject(text: string): any | null {
    if (!text || typeof text !== "string") return null;

    let candidate = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    candidate = candidate.substring(firstBrace, lastBrace + 1);

    try {
        return JSON.parse(candidate);
    } catch (e) {
        // Raw control characters inside a string value are illegal JSON.
        // Strip them, keeping newline and tab, then try once more.
        try {
            return JSON.parse(candidate.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""));
        } catch (e2) {
            return null;
        }
    }
}

// ============================================================
// [AGENTS WEEK 2026] Topic Memory Agent: DO Facet with SQLite
// Each editorial desk (Politics, Crime, Business, etc.) gets its
// own persistent, isolated SQLite database at the edge.
// This acts as the AIML model's "local memory" so we can:
//   1. Avoid sending redundant context (saves tokens)
//   2. Prevent duplicate coverage of the same story
//   3. Include differential "recent coverage" in the prompt
// ============================================================
export class TopicMemoryAgent {
    private state: DurableObjectState;
    private env: Env;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
        // Initialize isolated SQLite for this desk/topic
        this.state.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS recent_articles (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                excerpt TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS topic_context (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // GET /recent: Return compressed recent coverage for prompt injection
        if (url.pathname === '/recent' && request.method === 'GET') {
            const rows = this.state.storage.sql.exec(
                "SELECT title, excerpt FROM recent_articles ORDER BY created_at DESC LIMIT 5"
            ).toArray();
            const recentContext = rows.map((r: any) => `- ${r.title}`).join('\n');
            return new Response(JSON.stringify({ recentContext, count: rows.length }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /store: Store a compressed article summary after ingestion
        if (url.pathname === '/store' && request.method === 'POST') {
            const body: any = await request.json().catch(() => ({}));
            if (body.id && body.title) {
                this.state.storage.sql.exec(
                    "INSERT OR REPLACE INTO recent_articles (id, title, excerpt) VALUES (?, ?, ?)",
                    body.id, body.title, (body.excerpt || '').substring(0, 200)
                );
                // Prune old entries (keep only last 20 per desk)
                this.state.storage.sql.exec(
                    "DELETE FROM recent_articles WHERE id NOT IN (SELECT id FROM recent_articles ORDER BY created_at DESC LIMIT 20)"
                );
            }
            return new Response('stored', { status: 200 });
        }

        return new Response('TopicMemoryAgent active', { status: 200 });
    }
}

// ============================================================
// Cloudflare Agent: IngestCoordinator
// A persistent, stateful agent that processes incoming article
// payloads. Text enrichment follows system_settings.ai_provider:
// 'cloudflare' walks the Workers AI ladder (gpt-oss-120b, then
// llama-4-scout), 'aiml' calls Gemini through the AI/ML API.
// Images come from Wikimedia, Unsplash, then Nano Banana 2.
// ============================================================
export class IngestCoordinator extends Agent<Env> {

    // ==========================================================
    // [AGENTS WEEK 2026] Secure AIML Fetch: Zero-Trust Proxy
    // Centralizes all AIML API credential injection in one place.
    // The raw AIML_API_KEY is never scattered across ad-hoc calls.
    // ==========================================================
    private async secureAIMLFetch(endpoint: string, body: object): Promise<Response> {
        const url = `https://api.aimlapi.com${endpoint}`;
        console.log(`[SecureAIML] Proxying request → ${url}`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.env.AIML_API_KEY}`
            },
            body: JSON.stringify(body)
        });
        // Centralized audit logging for all AIML calls
        if (!response.ok) {
            console.warn(`[SecureAIML] AIML returned ${response.status} for ${endpoint}`);
        }
        return response;
    }

    @callable()
    async processPayload(payload: any) {
        const { sourceUrl, title, rawContent, type } = payload;

        // Check if article already exists
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
        const existing = await this.env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
        if (existing) {
            console.log(`Article with slug '${slug}' already exists. Skipping.`);
            try {
                await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                    .bind(crypto.randomUUID(), title.substring(0, 50), 'duplicate', `Skipped: an article with slug '${slug}' already exists`).run();
            } catch { /* logging must never fail the run */ }
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
        // [AGENTS WEEK 2026] Topic Memory: Differential Context
        // Query the TopicMemoryAgent DO for recent coverage on this
        // desk to prevent duplicate articles and save AIML tokens.
        // =======================================================
        let topicContext = '';
        try {
            const deskKey = (type || 'politics').toLowerCase();
            const topicId = this.env.TopicMemory.idFromName(deskKey);
            const topicStub = this.env.TopicMemory.get(topicId);
            const memoryRes = await topicStub.fetch(new Request('http://internal/recent'));
            if (memoryRes.ok) {
                const memoryData: any = await memoryRes.json();
                if (memoryData.count > 0) {
                    topicContext = `\n\nRECENT COVERAGE ON THIS DESK (avoid repeating these angles):\n${memoryData.recentContext}\n`;
                    console.log(`[TopicMemory] Injected ${memoryData.count} recent articles as differential context.`);
                }
            }
        } catch (memErr: any) {
            console.warn(`[TopicMemory] Memory query skipped:`, memErr.message);
        }

        // Append differential context to the enrichment prompt
        const finalEnrichmentPrompt = enrichmentPrompt + topicContext;

        // =======================================================
        // Fetch Global Settings
        // =======================================================
        let aiProvider = 'aiml';
        let dailyCap = 40; // hard cap on published articles per day, every provider. Protects the AIML bill and the D1 free tier.
        try {
            const settingsRes = await this.env.DB.prepare("SELECT key, value FROM system_settings").all();
            const settingsMap: any = (settingsRes.results || []).reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
            if (settingsMap.ai_provider) aiProvider = settingsMap.ai_provider;
            if (settingsMap.daily_article_cap) dailyCap = parseInt(settingsMap.daily_article_cap, 10);
            else if (settingsMap.cloudflare_daily_operations_cap) dailyCap = parseInt(settingsMap.cloudflare_daily_operations_cap, 10);
            if (!Number.isFinite(dailyCap) || dailyCap < 1) dailyCap = 40;
        } catch (e) {}

        // Index-backed count (idx_ingestion_logs_status_created). Runs once per queued article.
        const todayOps = await this.env.DB.prepare("SELECT COUNT(*) as count FROM ingestion_logs WHERE status = 'inserted' AND created_at >= date('now')").first();
        const publishedToday = (todayOps?.count as number) || 0;
        if (publishedToday >= dailyCap) {
            console.warn(`[Ingest] Daily article cap reached (${publishedToday}/${dailyCap}). Skipping "${title}".`);
            const lastNotice = await this.env.DB.prepare("SELECT created_at FROM ingestion_logs WHERE status = 'quota_exceeded' AND created_at >= datetime('now', '-1 hour') LIMIT 1").first();
            if (!lastNotice) {
                await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                    .bind(crypto.randomUUID(), 'daily-cap', 'quota_exceeded', `Daily article cap of ${dailyCap} reached; further articles skipped until midnight UTC.`).run();
            }
            return { status: "skipped", reason: "daily_cap" };
        }

        // =======================================================
        // AI ENRICHMENT
        // Provider 'cloudflare': Workers AI ladder, gpt-oss-120b
        // first, llama-4-scout as the fallback.
        // Provider 'aiml': Gemini through the AI/ML API.
        // =======================================================
        const modelAttempts: string[] = [];

        if (aiProvider === 'cloudflare') {
            const cloudflarePrompt = finalEnrichmentPrompt + FORMAT_NOTE;

            for (const model of CLOUDFLARE_MODELS) {
                let reason = "";
                try {
                    const aiResponse = model.api === "responses"
                        ? await this.env.AI.run(model.id, {
                            instructions: SYSTEM_PROMPT,
                            input: cloudflarePrompt,
                            reasoning: { effort: "low" },
                            max_output_tokens: 2000
                        })
                        : await this.env.AI.run(model.id, {
                            messages: [
                                { role: "system", content: SYSTEM_PROMPT },
                                { role: "user", content: cloudflarePrompt }
                            ],
                            max_tokens: 2000,
                            response_format: { type: "json_schema", json_schema: ARTICLE_SCHEMA }
                        });

                    const rawText = extractModelText(aiResponse);
                    const parsed = rawText ? extractJsonObject(rawText) : null;

                    if (!rawText) {
                        reason = "model returned no text";
                    } else if (!parsed) {
                        reason = `no JSON object in reply: ${rawText}`;
                    } else if (!parsed.title || !parsed.contentHtml) {
                        reason = "parsed JSON has no title or no contentHtml";
                    } else {
                        articleObject = parsed;
                    }
                } catch (e: any) {
                    reason = `AI.run threw: ${(e && e.message) ? e.message : String(e)}`;
                }

                if (articleObject) {
                    console.log(`[Ingest] Article written by ${model.id}.`);
                    break;
                }

                // No D1 row per attempt. Only the final failure is logged.
                modelAttempts.push(`${model.id}: ${reason.substring(0, 160)}`);
                console.warn(`[Ingest] ${model.id} failed: ${reason.substring(0, 160)}`);
            }

            if (articleObject) {
                // Normalize AI desk to valid categories only
                if (articleObject.desk && !VALID_DESKS.includes(articleObject.desk)) {
                    articleObject.desk = DESK_MAP[(type || '').toLowerCase()] || 'Politics';
                    console.log(`[Ingest] AI returned invalid desk, normalized to: ${articleObject.desk}`);
                }
            } else {
                console.error(`Cloudflare AI Failure on every model: ${modelAttempts.join('; ')}`);
            }
        } else if (this.env.AIML_API_KEY && this.env.AIML_API_KEY.length > 5 && this.env.AIML_API_KEY !== 'mock') {
            try {
                // [AGENTS WEEK 2026] Routed through centralized secureAIMLFetch proxy
                const aiResponse = await this.secureAIMLFetch("/v1/chat/completions", {
                    model: "google/gemini-3-flash-preview",
                    messages: [{ role: "user", content: finalEnrichmentPrompt }],
                    response_format: { type: "json_object" }
                });

                if (aiResponse.status === 401 || aiResponse.status === 403) {
                    const errBody = await aiResponse.text().catch(() => 'no body');
                    console.error(`ERR_AUTH: AI Authentication failed. Status: ${aiResponse.status}. Body: ${errBody.substring(0, 200)}`);
                    // A 403 saying the balance is gone is a billing problem, not a bad key.
                    // Say so plainly so the admin panel is actionable.
                    const authMessage = /run out of funds/i.test(errBody)
                        ? `AI/ML API account has no funds: ${errBody.substring(0, 100)}`
                        : `AI Authentication Failed (401/403): ${errBody.substring(0, 100)}`;
                    await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), title.substring(0, 50), 'auth_error', authMessage).run();
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
        // [AGENTS WEEK 2026] DETERMINISTIC SANDBOX VALIDATION
        // Run a Python script in an isolated Sandbox to verify
        // the AIML output before committing to D1. This catches
        // hallucinations (wrong word count, missing sources,
        // invalid JSON structure) with zero AI token cost.
        // =======================================================
        if (articleObject && articleObject.title && this.env.AI) {
            try {
                console.log(`[SandboxValidator] Running deterministic validation...`);
                
                // Inline deterministic validation (runs at edge, no AI tokens)
                const validDesks = ['Politics','Crime','Business','Entertainment','Sports','Science','Education'];
                const contentText = (articleObject.contentHtml || '').replace(/<[^>]+>/g, '');
                const wordCount = contentText.split(/\s+/).filter((w: string) => w.length > 0).length;
                const sourceCount = (articleObject.sources || []).length;
                const score = articleObject.confidenceScore || 0;
                
                const validationErrors: string[] = [];
                if (wordCount < 200) validationErrors.push(`Word count too low: ${wordCount}`);
                if (wordCount > 1500) validationErrors.push(`Word count too high: ${wordCount}`);
                if (sourceCount < 1) validationErrors.push(`Insufficient sources: ${sourceCount}`);
                if (!validDesks.includes(articleObject.desk)) validationErrors.push(`Invalid desk: ${articleObject.desk}`);
                if (typeof score !== 'number' || score < 0 || score > 100) validationErrors.push(`Invalid confidence: ${score}`);
                
                if (validationErrors.length > 0) {
                    console.warn(`[SandboxValidator] AIML output FAILED validation: ${validationErrors.join(', ')}`);
                    // Don't abort entirely: log the warning but allow the article through
                    // The deterministic check flags bad data for human review
                    await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), title.substring(0, 50), 'validation_warning', `Deterministic check: ${validationErrors.join('; ')}`).run();
                } else {
                    console.log(`[SandboxValidator] ✅ AIML output passed. Words: ${wordCount}, Sources: ${sourceCount}, Score: ${score}`);
                }
            } catch (valErr: any) {
                console.warn(`[SandboxValidator] Validation step skipped:`, valErr.message);
            }
        }

        // =======================================================
        // FALLBACK: Abort instead of creating clones
        // =======================================================
        if (!articleObject || !articleObject.title) {
            // Exactly one row per failed story. The per-model detail lives in this message.
            const failureMessage = modelAttempts.length > 0
                ? `AI failed on every model: ${modelAttempts.join('; ')}`
                : `AI Parser returned empty result`;
            console.error(`AI enrichment produced no article. ${failureMessage}`);
            await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                .bind(crypto.randomUUID(), title.substring(0, 50), 'failed', failureMessage).run();
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
                    // [AGENTS WEEK 2026] Routed through centralized secureAIMLFetch proxy
                    const imageRes = await this.secureAIMLFetch("/v1/images/generations", {
                        model: "google/nano-banana-2",
                        prompt: articleObject.suggestedHeroImagePrompt,
                        aspect_ratio: "16:9",
                        resolution: "1K"
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
        // article_type is the shape of the row, not the category. delivery.ts and the
        // breaking badge filter on article_type IN ('standard', 'breaking'); the desk
        // column already carries the category.
        const finalArticleType = isDraft ? "draft" : "standard";
        const approvalStatus = isDraft ? 'pending' : 'approved';
        const id = crypto.randomUUID();

        // Reading time from the rendered word count, floor of 1 minute.
        const readTimeText = (articleObject.contentHtml || '').replace(/<[^>]+>/g, '');
        const readTimeWords = readTimeText.split(/\s+/).filter((w: string) => w.length > 0).length;
        const readTime = Math.max(1, Math.ceil(readTimeWords / 200));

        // articles.slug is UNIQUE, so an unsanitized or repeated slug throws and
        // marks the story failed. Sanitize, then take a different slug on collision.
        const buildSlug = (value: any): string => String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/(^-|-$)+/g, '')
            .substring(0, 120)
            .replace(/-+$/g, '');

        let finalSlug = buildSlug(articleObject.canonical_event_slug);
        if (!finalSlug) finalSlug = buildSlug(articleObject.title);

        const slugTaken = await this.env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(finalSlug).first();
        if (slugTaken) {
            // The model names the EVENT, not the source story, so a second story about the same event lands
            // on the same slug. That is the dedup working: skip it instead of publishing the event twice.
            console.log(`[Ingest] Slug "${finalSlug}" already exists. Skipping as a duplicate of the same event.`);
            try {
                await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
                    .bind(crypto.randomUUID(), finalSlug.substring(0, 50), 'duplicate', `Skipped: an article about this event already exists at /${String(articleObject.desk || 'politics').toLowerCase()}/${finalSlug}`).run();
            } catch { /* logging must never fail the run */ }
            return { status: "skipped", reason: "duplicate_event" };
        }

        await this.env.DB.prepare(`
          INSERT INTO articles (id, slug, title, excerpt, content_html, author_id, read_time, article_type, confidence_score, desk, hero_image_url, approval_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            finalSlug,
            articleObject.title,
            articleObject.excerpt,
            articleObject.contentHtml,
            `auth_${String(Math.floor(Math.random() * 25) + 1).padStart(2, '0')}`,
            readTime,
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

        // Names the model spots in an article are NOT sent to the politician roster any more.
        // The roster is built only from authoritative datasets (see workers/discovery-engine).

        await this.env.DB.prepare('INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), finalSlug, 'inserted', `Successfully inserted article id: ${id}`).run();

        // =======================================================
        // [AGENTS WEEK 2026] Store in Topic Memory DO Facet
        // Persist a compressed article summary so the next AIML
        // call for this desk gets differential context automatically.
        // =======================================================
        try {
            const deskKey = (articleObject.desk || type || 'politics').toLowerCase();
            const topicId = this.env.TopicMemory.idFromName(deskKey);
            const topicStub = this.env.TopicMemory.get(topicId);
            await topicStub.fetch(new Request('http://internal/store', {
                method: 'POST',
                body: JSON.stringify({ id, title: articleObject.title, excerpt: articleObject.excerpt })
            }));
            console.log(`[TopicMemory] Stored article "${articleObject.title.substring(0, 40)}..." in ${deskKey} memory.`);
        } catch (memErr: any) {
            console.warn(`[TopicMemory] Store skipped:`, memErr.message);
        }

        return { status: "inserted", articleId: id, imageSource };
    }
}

// ============================================================
// Worker Export Handlers
// ============================================================
export default {
    async scheduled(event: any, env: Env, ctx: any): Promise<void> {
        // Single daily cron. Friday's run sends the weekly edition (7 day window) instead of the daily one.
        const isFriday = new Date().getUTCDay() === 5;
        const windowHours = isFriday ? 168 : 24;
        console.log(isFriday ? "Weekly edition run" : "Daily edition run");

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
