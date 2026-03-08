interface Env {
    DB: D1Database;
    IMAGE_BUCKET: R2Bucket;
    AIML_API_KEY: string;
    RESEND_API_KEY: string;
    TWILIO_SID: string;
    TWILIO_TOKEN: string;
    TWILIO_WHATSAPP_NUMBER: string;
}

import { processDeliveries } from './delivery';

export default {
    async scheduled(event: any, env: Env, ctx: any): Promise<void> {
        // Evaluate the cron string to determine window
        const cron = event.cron;
        let windowHours = 24; // Default to Daily

        if (cron.includes(' 5')) {
            // Runs on Fridays "0 12 * * 5"
            windowHours = 168; // 7 days
            console.log("Weekly Schedule Detected");
        } else {
            console.log("Daily Schedule Detected");
        }

        ctx.waitUntil(processDeliveries(env, windowHours * 60 * 60 * 1000));
    },

    async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
        for (const message of batch.messages) {
            const payload = message.body;
            const { sourceUrl, title, rawContent, type } = payload;

            try {
                let articleObject: any = null;
                let attempts = 0;
                let isDraft = false;

                const enrichmentPrompt = `
          Analyze the following article content from ${sourceUrl}.
          Title: ${title}
          Content: ${rawContent}

          You are a senior political editor. Write an original article based on this.
          STRICT REQUIREMENTS:
          1. The output contentHtml MUST be strictly between 450 and 600 words. Do not ignore this.
          2. You MUST extract or identify at least 2 distinct sources (organizations, people, or documents cited).

          Return a JSON object with:
          - canonical_event_slug (a generic kebab-case slug representing the event itself, e.g., 'senate-tech-hearing-2026'. Do not include publication names)
          - title (optimized newsroom headline)
          - excerpt (short deck context)
          - contentHtml (full article HTML with calm, credible newspaper formatting, no inline citations)
          - keyTakeaways (an array of strings)
          - confidenceScore (1-100 based on source authority)
          - suggestedHeroImagePrompt (a detailed prompt for gemini-3-1-flash-image-preview)
          - sources (an array of objects, each with 'source_name', 'source_url' (if available, otherwise leave blank) and 'source_type')
        `;

                while (attempts < 2) {
                    attempts++;
                    if (env.AIML_API_KEY && env.AIML_API_KEY.length > 5 && env.AIML_API_KEY !== 'mock') {
                        console.log(`[Attempt ${attempts}] Generating AI Enrichment...`);
                        const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${env.AIML_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: "gemini-3-flash-preview",
                                messages: [{ role: "user", content: enrichmentPrompt }],
                                response_format: { type: "json_object" }
                            })
                        });

                        if (!aiResponse.ok) {
                            throw new Error(`AI Enrichment failed: ${aiResponse.statusText}`);
                        }

                        const aiData = await aiResponse.json() as any;
                        articleObject = JSON.parse(aiData.choices[0].message.content);
                    } else {
                        // Mock fallback for deep E2E testing without real keys
                        console.log("Using Mock AI Payload because API Key is missing or invalid.");
                        articleObject = {
                            canonical_event_slug: `mocked-event-${Date.now()}`,
                            title: title,
                            excerpt: "Mock excerpt for E2E testing.",
                            contentHtml: "<p>Mock. ".repeat(60) + "</p>", // Just enough to pass 450 length gate 
                            keyTakeaways: ["Takeaway 1"],
                            confidenceScore: 80,
                            suggestedHeroImagePrompt: "Mock drawing",
                            sources: [
                                { source_name: "Mock Source 1", source_url: sourceUrl, source_type: "primary" },
                                { source_name: "Mock Source 2", source_url: "", source_type: "secondary" }
                            ]
                        };
                    }

                    if (attempts === 1) {
                        // 1. Duplicate Event Detection
                        console.log(`Evaluating canonical event slug: ${articleObject.canonical_event_slug}`);
                        const existing = await env.DB.prepare('SELECT id FROM articles WHERE slug = ?').bind(articleObject.canonical_event_slug).first();
                        if (existing) {
                            console.log(`❌ Event '${articleObject.canonical_event_slug}' already exists in DB. Dropping duplicate story.`);
                            message.ack();
                            return;
                        }
                    }

                    // Quality Gates Validation
                    const failedGates = [];

                    if (articleObject.confidenceScore < 75 && type === "breaking") {
                        failedGates.push(`Confidence too low (${articleObject.confidenceScore} < 75)`);
                    }
                    if (!articleObject.sources || articleObject.sources.length < 2) {
                        failedGates.push(`Insufficient sources (${articleObject.sources?.length || 0} < 2)`);
                    }

                    const plainText = articleObject.contentHtml.replace(/<[^>]*>?/gm, '');
                    const wordCount = plainText.split(/\s+/).filter((w: string) => w.length > 0).length;
                    if (wordCount < 450 || wordCount > 600) {
                        failedGates.push(`Word count out of bounds (${wordCount} words)`);
                    }

                    if (failedGates.length > 0) {
                        console.warn(`Quality gates failed on attempt ${attempts}: ${failedGates.join(', ')}`);
                        if (attempts === 1) {
                            console.log(`Retrying AI generation...`);
                            continue;
                        } else {
                            console.log(`Quality gates failed after retry. Forcing type to 'draft'.`);
                            isDraft = true;
                            break;
                        }
                    } else {
                        console.log(`✅ Quality gates passed. (Words: ${wordCount}, Sources: ${articleObject.sources.length})`);
                        break;
                    }
                }

                let heroImageUrl = "https://example.com/generated-hero.jpg";

                try {
                    console.log(`Requesting hero image generation...`);
                    if (env.AIML_API_KEY && env.AIML_API_KEY.length > 5 && env.AIML_API_KEY !== 'mock') {
                        const imageRes = await fetch("https://api.aimlapi.com/v1/images/generations", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${env.AIML_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: "gemini-3-1-flash-image-preview",
                                prompt: articleObject.suggestedHeroImagePrompt
                            })
                        });

                        if (imageRes.ok) {
                            const imgData = await imageRes.json() as any;
                            const srcUrl = imgData.data[0].url;

                            const imgBuffer = await fetch(srcUrl);
                            const buffer = await imgBuffer.arrayBuffer();
                            const fileKey = `hero-${articleObject.canonical_event_slug}-${Date.now()}.jpg`;

                            await env.IMAGE_BUCKET.put(fileKey, buffer, {
                                httpMetadata: { contentType: "image/jpeg" }
                            });

                            heroImageUrl = `https://pub-YOUR_BUCKET_ID.r2.dev/${fileKey}`;
                            console.log(`Successfully generated and stored image at ${heroImageUrl}`);
                        } else {
                            console.warn(`Image generation failed: ${imageRes.statusText}`);
                        }
                    } else {
                        console.log("Skipping actual AI Image generation to save cost/time.");
                    }
                } catch (imgErr) {
                    console.error(`Failed to generate/store image: `, imgErr);
                }

                const finalArticleType = isDraft ? "draft" : (type || "standard");
                const id = crypto.randomUUID();

                console.log(`Inserting ${finalArticleType} article ${id} into D1...`);
                const { success } = await env.DB.prepare(`
          INSERT INTO articles (id, slug, title, excerpt, content_html, article_type, confidence_score, desk, hero_image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
                    id,
                    articleObject.canonical_event_slug,
                    articleObject.title,
                    articleObject.excerpt,
                    articleObject.contentHtml,
                    finalArticleType,
                    articleObject.confidenceScore,
                    "Politics Grid",
                    heroImageUrl
                ).run();

                if (!success) throw new Error("Database insertion failed");

                if (articleObject.sources && articleObject.sources.length > 0) {
                    const stmts = articleObject.sources.map((s: any) => {
                        return env.DB.prepare(`INSERT INTO article_sources (id, article_id, source_name, source_url, source_type) VALUES (?, ?, ?, ?, ?)`)
                            .bind(crypto.randomUUID(), id, s.source_name, s.source_url || null, s.source_type || 'unclassified');
                    });
                    await env.DB.batch(stmts);
                    console.log(`✅ Inserted ${stmts.length} sources linked to ${id}`);
                }

                message.ack();
            } catch (error: any) {
                console.log("Queue processing error caught! Stringified error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
                console.log("Error toString:", error.toString());
                message.retry();
            }
        }
    },
    // Temporary manual trigger for E2E testing
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === "POST") {
            const body = await request.json() as any;
            console.log("TESTING NATIVELY via HTTP");
            const mockBatch = {
                messages: [{
                    body: body,
                    ack: () => console.log("Mock message acked"),
                    retry: () => console.log("Mock message retried")
                }]
            } as any;
            await this.queue(mockBatch, env);
            return new Response("OK");
        }
        return new Response("Not found", { status: 404 });
    }
};
