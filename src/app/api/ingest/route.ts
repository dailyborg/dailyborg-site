import { NextRequest, NextResponse } from "next/server";
import { extractClaimsFromText, detectStanceChange } from "@/lib/gemini";

// Assuming we have a getRequestContext from OpenNext/Cloudflare runtime
// We'll define a basic type for the Cloudflare execution context
export const runtime = "edge";

interface IngestPayload {
    politician_id: string; // The ID of the politician in D1
    politician_name: string; // Needed for the LLM prompt
    raw_text: string;
    source_url: string;
    source_name: string;
    source_date?: string;
    source_context?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: IngestPayload = await req.json();

        if (!body.raw_text || !body.politician_id || !body.politician_name || !body.source_url || !body.source_name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Extract Claims using Gemini
        const extraction = await extractClaimsFromText(
            body.raw_text,
            body.politician_name,
            body.source_date,
            body.source_context
        );

        if (!extraction || extraction.claims.length === 0) {
            return NextResponse.json({ message: "No relevant claims found in the provided text." }, { status: 200 });
        }

        // We need to access Cloudflare bindings (D1, Vectorize, Cache)
        // In Next.js App Router on Cloudflare, bindings are usually available via the standard request context 
        // provided by whatever adapter is being used (e.g., next-on-pages or open-next). 
        // We will assume `req.cf` or a custom context property holds `env`. 
        // For standard local dev, we might need a fallback, but we'll assume Cloudflare Env is exposed globally or via context.
        // As per standard @cloudflare/next-on-pages or similar bindings injection:
        const d1 = (process.env as any).DB as D1Database | undefined;
        const vectorize = (process.env as any).VECTORIZE as VectorizeIndex | undefined;

        // Let's use `process.env` as a fallback, but properly Next.js edge runtime usually binds to `process.env` or a request context.
        // Note: For open-next, bindings might be on the global `env` object or `request.cf`.

        if (!process.env.DB && !process.env.VECTORIZE) {
            // Log a warning, but we cannot proceed dynamically without DB.
            console.warn("D1/Vectorize bindings not found in process.env. Proceeding with dummy response for testing.");
        }

        const insertedClaims = [];

        // 2. Process each claim
        for (const claim of extraction.claims) {
            const claimId = crypto.randomUUID();

            // Store in D1
            if (process.env.DB) {
                const db = process.env.DB as any as D1Database;
                await db.prepare(
                    `INSERT INTO claims (id, politician_id, type, content, date, context) VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(claimId, body.politician_id, claim.claim_type, claim.claim_text, claim.date_said, claim.context).run();

                const evidenceId = crypto.randomUUID();
                await db.prepare(
                    `INSERT INTO evidence (id, claim_id, url, source_name) VALUES (?, ?, ?, ?)`
                ).bind(evidenceId, claimId, body.source_url, body.source_name).run();
            }

            insertedClaims.push({ id: claimId, ...claim });

            // 3. Generate Embeddings & Vectorize using Cloudflare Workers AI
            let vector: number[] = [];
            if (process.env.AI) {
                const embeddingResponse = await (process.env.AI as any).run('@cf/baai/bge-base-en-v1.5', { text: [claim.claim_text] });
                // AI bindings often return data in shape { shape: [...], data: [...] }
                vector = embeddingResponse.data?.[0] || embeddingResponse.data;

                if (process.env.VECTORIZE && vector && vector.length > 0) {
                    await (process.env.VECTORIZE as any).upsert([
                        {
                            id: claimId,
                            values: vector,
                            metadata: { politician_id: body.politician_id, type: claim.claim_type }
                        }
                    ]);
                }
            }

            // 4. Contradiction Detection (Vector Search)
            if (process.env.VECTORIZE && vector && vector.length > 0) {
                // Search for similar statements by the same politician
                const matches = await (process.env.VECTORIZE as any).query(vector, { topK: 5, filter: { politician_id: body.politician_id } });

                for (const match of matches.matches) {
                    if (match.score > 0.85 && match.id !== claimId) { // High similarity threshold
                        // Fetch older claim text from DB
                        const olderClaim = await (process.env.DB as any as D1Database).prepare('SELECT content, topic FROM claims WHERE id = ?').bind(match.id).first();

                        if (olderClaim) {
                            // Compare using Gemini
                            const comparison = await detectStanceChange(olderClaim.content as string, claim.claim_text, olderClaim.topic as string || "Policy Issue");

                            if (comparison && comparison.has_changed) {
                                const changeId = crypto.randomUUID();
                                await (process.env.DB as any as D1Database).prepare(
                                    `INSERT INTO stance_changes (id, politician_id, old_claim_id, new_claim_id, topic, shift_description) VALUES (?, ?, ?, ?, ?, ?)`
                                ).bind(changeId, body.politician_id, match.id, claimId, olderClaim.topic || "Policy Issue", comparison.shift_description).run();
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            message: "Ingestion and extraction complete",
            summary: extraction.summary,
            claims_processed: insertedClaims.length,
            claims: insertedClaims
        });

    } catch (e: any) {
        console.error("Ingest Error:", e);
        return NextResponse.json({ error: "Internal Server Error", details: e.message }, { status: 500 });
    }
}
