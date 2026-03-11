// This is a standalone Cloudflare Worker dedicated to the Autonomous Feeder.
// It will be deployed alongside (but entirely separate from) the Next.js OpenNext application.
// This prevents Next.js bundle bloat and keeps execution strictly tied to background Cron/Queue events.

import Parser from 'rss-parser';

export interface Env {
    DB: import('@cloudflare/workers-types').D1Database;
    VECTORIZE: import('@cloudflare/workers-types').VectorizeIndex;
    AI: any;
    ENRICHMENT_QUEUE: import('@cloudflare/workers-types').Queue;
    PROCESSING_QUEUE: import('@cloudflare/workers-types').Queue;
    GEMINI_API_KEY: string;
}

const TRUSTED_FEEDS = [
    "https://feeds.npr.org/1014/rss.xml", // NPR Politics
    "https://rss.politico.com/politics-news.xml", // Politico
    // We can add 20+ feeds here
];

export default {
    // 1. Scheduled Cron Trigger (The Scout)
    // Fires every hour to grab RSS feeds and dump them into the Enrichment Queue.
    async scheduled(event: import('@cloudflare/workers-types').ScheduledEvent, env: Env, ctx: import('@cloudflare/workers-types').ExecutionContext) {
        console.log(`[AUTONOMOUS FEEDER] Cron triggered at ${event.cron}`);

        ctx.waitUntil((async () => {
            const parser = new Parser();
            let newArticlesCount = 0;

            for (const feedUrl of TRUSTED_FEEDS) {
                try {
                    const feed = await parser.parseURL(feedUrl);

                    // We only want very recent articles to avoid processing history
                    const recentItems = feed.items.filter((item: any) => {
                        if (!item.isoDate) return false;
                        const pubDate = new Date(item.isoDate);
                        const hoursAgo = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
                        return hoursAgo < 24; // Only process items from the last 24 hours
                    });

                    for (const item of recentItems) {
                        if (item.link) {
                            await env.ENRICHMENT_QUEUE.send({
                                type: 'enrich',
                                url: item.link,
                                title: item.title,
                                source: feed.title || feedUrl
                            });
                            newArticlesCount++;
                        }
                    }
                } catch (e) {
                    console.error(`[AUTONOMOUS FEEDER] Failed to parse feed ${feedUrl}:`, e);
                }
            }

            console.log(`[AUTONOMOUS FEEDER] Queued ${newArticlesCount} new articles for enrichment.`);
        })());
    },

    // 2. Queue Consumer (The Researcher & The Editor)
    // Wakes up when a Queue gets a new message.
    async queue(batch: import('@cloudflare/workers-types').MessageBatch<any>, env: Env, ctx: import('@cloudflare/workers-types').ExecutionContext) {

        // Route based on which queue woke us up
        if (batch.queue === 'enrichment-queue') {
            console.log(`[AUTONOMOUS FEEDER] Processing ${batch.messages.length} messages from enrichment-queue`);

            for (const message of batch.messages) {
                const { url, title, source } = message.body;
                console.log(`Enriching: ${title}`);

                try {
                    // Call Perplexity Sonar via AIML API for deep context
                    const response = await fetch("https://api.aimlapi.com/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${env.GEMINI_API_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "perplexity/sonar-pro",
                            messages: [
                                {
                                    role: "system",
                                    content: "You are a research AI. Your job is to read the provided news URL and return a highly detailed summary of the facts, quotes, and statistics contained within. Focus entirely on who said what, and what specific promises/facts were mentioned."
                                },
                                {
                                    role: "user",
                                    content: `Summarize the contents of this article and extract key factual claims: ${title} - ${url}`
                                }
                            ],
                            max_tokens: 2000
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`AIML API Error: ${response.status} ${response.statusText}`);
                    }

                    const perplexityData = (await response.json()) as any;
                    const enrichedText = perplexityData.choices?.[0]?.message?.content;

                    if (enrichedText) {
                        // Forward enriched text to Gemini/DB queue
                        await env.PROCESSING_QUEUE.send({
                            type: 'process',
                            original_url: url,
                            source_name: source,
                            title: title,
                            enriched_text: enrichedText
                        });
                        message.ack(); // Mark successful
                    } else {
                        throw new Error("Empty enrichment payload");
                    }

                } catch (e) {
                    console.error(`[AUTONOMOUS FEEDER] Enrichment Failed for ${url}:`, e);
                    // Do not ack(), will auto-retry
                }
            }

        } else if (batch.queue === 'processing-queue') {
            console.log(`[AUTONOMOUS FEEDER] Processing ${batch.messages.length} messages from processing-queue`);

            for (const message of batch.messages) {
                const { original_url, source_name, title, enriched_text } = message.body;
                console.log(`Extracting claims for: ${title}`);

                try {
                    // 1. Deduplication (Cost-Saver) via free Cloudflare Workers AI embeddings
                    const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [enriched_text] });
                    const vector = embeddingResponse.data?.[0] || embeddingResponse.data;

                    if (vector && vector.length > 0) {
                        const matches = await env.VECTORIZE.query(vector, { topK: 1 });
                        if (matches.matches.length > 0 && matches.matches[0].score > 0.95) {
                            console.log(`[AUTONOMOUS FEEDER] Deduplication triggered for ${title}. Highly similar content already exists.`);
                            message.ack();
                            continue; // Skip Gemini and D1
                        }
                    }

                    // 2. Fact Extraction, Categorization, & Context Tagging via Gemini 3 Flash Preview
                    const prompt = `
                        Read this news article and output a strict JSON object.
                        1. Determine the overall 'category' (e.g., "Politics", "Sports", "Entertainment", "Economy").
                        2. If Politics, extract the 'primary_politician' and 'emotional_context' (e.g., "victorious", "defensive", "neutral"). If not politics or no main figure, return "unknown" and "neutral".
                        3. Extract all verifiable facts and promises into the 'claims' array.
                        Format:
                        {
                            "category": "Politics",
                            "primary_politician": "first_last",
                            "emotional_context": "emotion",
                            "claims": [
                                {"claim_text": "...", "claim_type": "Fact", "date_said": "YYYY-MM-DD", "context": "..."}
                            ]
                        }
                        Text: ${enriched_text}
                    `;

                    const geminiResponse = await fetch("https://api.aimlapi.com/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${env.GEMINI_API_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "gemini-3-flash-preview",
                            messages: [{ role: "user", content: prompt }],
                            response_format: { type: "json_object" },
                            temperature: 0.1
                        })
                    });

                    if (!geminiResponse.ok) {
                        throw new Error(`Gemini AIML Error: ${geminiResponse.status}`);
                    }

                    const geminiData = (await geminiResponse.json()) as any;
                    const jsonContent = geminiData.choices?.[0]?.message?.content;

                    let parsedData;
                    try { parsedData = JSON.parse(jsonContent); } catch { parsedData = { claims: [] }; }

                    const claims = parsedData.claims || [];
                    const category = parsedData.category || "General";
                    const primaryPolitician = parsedData.primary_politician || "unknown";
                    const emotionalContext = parsedData.emotional_context || "neutral";

                    // 3. Hybrid Image Strategy (Public Photos vs Nano Banana 2)
                    let generatedImageUrl = null;

                    // If it's not politics, or we couldn't find a primary politician to map
                    if (category !== "Politics" || primaryPolitician === "unknown") {
                        try {
                            console.log(`[AUTONOMOUS FEEDER] Generating Nano Banana 2 image for category: ${category}`);
                            const imagePrompt = `High quality editorial news illustration about: ${title}. Style: professional, objective news media, no text.`;

                            const imageResponse = await fetch("https://api.aimlapi.com/images/generations", {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${env.GEMINI_API_KEY}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    model: "google/nano-banana-2", // Gemini 3 Flash Image
                                    prompt: imagePrompt,
                                    n: 1,
                                    size: "1024x1024"
                                })
                            });

                            if (imageResponse.ok) {
                                const imageData = (await imageResponse.json()) as any;
                                generatedImageUrl = imageData.data?.[0]?.url;
                            } else {
                                console.warn(`[AUTONOMOUS FEEDER] Image Gen Failed: ${imageResponse.status}`);
                            }
                        } catch (imgError) {
                            console.error(`[AUTONOMOUS FEEDER] Image generation network error:`, imgError);
                        }
                    }

                    // 4. Database Persistence
                    for (const claim of claims) {
                        const claimId = crypto.randomUUID();

                        // Save the extracted tags directly into the context column so the frontend can route the image 
                        // We will prepend the generated AI image URL if it exists, otherwise send the local routing tags.
                        let finalContext = `politician:${primaryPolitician}|emotion:${emotionalContext}|category:${category}|${claim.context || title}`;

                        if (generatedImageUrl) {
                            finalContext = `ai_image:${generatedImageUrl}|` + finalContext;
                        }

                        await env.DB.prepare(
                            `INSERT INTO claims (id, type, content, date, context) VALUES (?, ?, ?, ?, ?)`
                        ).bind(claimId, claim.claim_type || 'Fact', claim.claim_text, claim.date_said || new Date().toISOString(), finalContext).run();

                        const evidenceId = crypto.randomUUID();
                        await env.DB.prepare(
                            `INSERT INTO evidence (id, claim_id, url, source_name, trust_score) VALUES (?, ?, ?, ?, ?)`
                        ).bind(evidenceId, claimId, original_url, source_name, 85).run();

                        // Save vector for future deduplication sweeps
                        if (vector) {
                            await env.VECTORIZE.upsert([{ id: claimId, values: vector }]);
                        }
                    }

                    console.log(`[AUTONOMOUS FEEDER] Successfully verified and saved ${claims.length} claims for: ${title}`);
                    message.ack();

                } catch (e) {
                    console.error(`[AUTONOMOUS FEEDER] Processing Failed for ${title}:`, e);
                }
            }
        }
    }
}
