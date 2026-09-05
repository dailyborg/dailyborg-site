/**
 * Claim extraction and stance comparison through the AI/ML API gateway (Gemini 3 Flash).
 * Plain fetch, no SDK, so it bundles cleanly for the edge runtime.
 * Only reachable from admin-authenticated routes (see /api/ingest).
 */
import { readEnv } from "./admin-auth";

const AIML_URL = "https://api.aimlapi.com/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export interface ExtractedFactOrPromise {
    claim_text: string;
    claim_type: "Fact" | "Promise" | "Opinion";
    date_said: string;
    context: string;
}

export interface VerificationResult {
    claims: ExtractedFactOrPromise[];
    summary: string;
}

async function chatJson(prompt: string): Promise<any | null> {
    const key = readEnv("AIML_API_KEY");
    if (!key) {
        console.error("[gemini] AIML_API_KEY is not set");
        return null;
    }
    const res = await fetch(AIML_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.1 }),
    });
    if (!res.ok) {
        console.error("[gemini] AIML returned", res.status);
        return null;
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    try { return JSON.parse(content); } catch { return null; }
}

/** Extracts verifiable claims, promises and strong opinions from text attributed to a named official. */
export async function extractClaimsFromText(text: string, politicianName: string, sourceDate: string | null = null, sourceContext: string | null = null): Promise<VerificationResult | null> {
    const prompt = `
You are an expert political fact-checking assistant. Extract verifiable claims and promises from the following text attributed to ${politicianName}.

Guidelines:
1. Only extract statements presented as Facts (e.g. "crime is down 20%"), Promises (e.g. "I will build a wall"), or strong Policy Opinions (e.g. "taxes must be lowered").
2. Ignore generic rhetoric, greetings and meaningless statements.
3. Keep claim_text as close to the original wording as possible while remaining a complete sentence.

Output valid JSON exactly matching:
{
  "summary": "One sentence summary of the main point of the text.",
  "claims": [
    { "claim_text": "...", "claim_type": "Fact", "date_said": "YYYY-MM-DD or Unknown", "context": "Where or how this was said, or Unknown" }
  ]
}

Source Text:
"""
${text.slice(0, 12000)}
"""`;
    const parsed = await chatJson(prompt);
    if (!parsed || !Array.isArray(parsed.claims)) return null;
    const claims: ExtractedFactOrPromise[] = parsed.claims
        .filter((c: any) => c && typeof c.claim_text === "string" && c.claim_text.trim().length > 0)
        .map((c: any) => ({
            claim_text: String(c.claim_text).trim(),
            claim_type: ["Fact", "Promise", "Opinion"].includes(c.claim_type) ? c.claim_type : "Fact",
            date_said: c.date_said === "Unknown" && sourceDate ? sourceDate : String(c.date_said || sourceDate || "Unknown"),
            context: c.context === "Unknown" && sourceContext ? sourceContext : String(c.context || sourceContext || "Unknown"),
        }));
    return { claims, summary: String(parsed.summary || "") };
}

/** Decides whether two statements by the same official on one topic contradict each other. */
export async function detectStanceChange(olderClaim: string, newerClaim: string, topic: string): Promise<{ has_changed: boolean; shift_description: string | null }> {
    const prompt = `
Analyze these two statements made by the same politician on the topic "${topic}".

Older statement: "${olderClaim}"
Newer statement: "${newerClaim}"

Decide whether the newer statement is a significant contradiction, reversal or shift from the older one.
If they generally agree, has_changed is false.

Output valid JSON exactly matching:
{ "has_changed": true, "shift_description": "One objective sentence describing the shift, or null" }`;
    const parsed = await chatJson(prompt);
    if (!parsed) return { has_changed: false, shift_description: null };
    return { has_changed: !!parsed.has_changed, shift_description: parsed.has_changed ? String(parsed.shift_description || "") : null };
}
