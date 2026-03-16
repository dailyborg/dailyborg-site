import { NextRequest, NextResponse } from "next/server";
import { extractClaimsFromText, detectStanceChange } from "@/lib/gemini";

import { getRequestContext } from '@cloudflare/next-on-pages';
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

        const { env } = getRequestContext();
        const d1 = env.DB as unknown as D1Database | undefined;
        const vectorize = env.VECTORIZE as unknown as VectorizeIndex | undefined;
        const ai = env.AI as unknown as any | undefined;

        if (!d1 && !vectorize) {
            console.warn("D1/Vectorize bindings not found in context. env keys:", Object.keys(env));
        }

        const insertedClaims = [];

        // 2. Process each claim
        for (const claim of extraction.claims) {
            const claimId = crypto.randomUUID();

            // Store in D1
            if (d1) {
                await d1.prepare(
                    `INSERT INTO claims (id, politician_id, type, content, date, context) VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(claimId, body.politician_id, claim.claim_type, claim.claim_text, claim.date_said, claim.context).run();

                const evidenceId = crypto.randomUUID();
                await d1.prepare(
                    `INSERT INTO evidence (id, claim_id, url, source_name) VALUES (?, ?, ?, ?)`
                ).bind(evidenceId, claimId, body.source_url, body.source_name).run();
            }

            insertedClaims.push({ id: claimId, ...claim });

            // 3. Generate Embeddings & Vectorize using Cloudflare Workers AI
            let vector: number[] = [];
            if (ai) {
                const embeddingResponse = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [claim.claim_text] });
                // AI bindings often return data in shape { shape: [...], data: [...] }
                vector = embeddingResponse.data?.[0] || embeddingResponse.data;

                if (vectorize && vector && vector.length > 0) {
                    await vectorize.upsert([
                        {
                            id: claimId,
                            values: vector,
                            metadata: { politician_id: body.politician_id, type: claim.claim_type }
                        }
                    ]);
                }
            }

            // 4. Contradiction Detection (Vector Search)
            if (vectorize && vector && vector.length > 0) {
                // Search for similar statements by the same politician
                const matches = await vectorize.query(vector, { topK: 5, filter: { politician_id: body.politician_id } });

                for (const match of matches.matches) {
                    if (match.score > 0.85 && match.id !== claimId) { // High similarity threshold
                        // Fetch older claim text from DB
                        const olderClaim = await d1.prepare('SELECT content, topic FROM claims WHERE id = ?').bind(match.id).first();

                        if (olderClaim) {
                            // Compare using Gemini
                            const comparison = await detectStanceChange(olderClaim.content as string, claim.claim_text, olderClaim.topic as string || "Policy Issue");

                            if (comparison && comparison.has_changed) {
                                const changeId = crypto.randomUUID();
                                await d1.prepare(
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
