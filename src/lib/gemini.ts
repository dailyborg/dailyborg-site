import OpenAI from "openai";

// Initialize the client lazily to avoid crashing Next.js static site generation (which lacks env vars)
function getAIClient() {
    return new OpenAI({
        apiKey: process.env.GEMINI_API_KEY || "dummy_key_for_build",
        baseURL: "https://api.aimlapi.com/v1",
    });
}

export interface ExtractedFactOrPromise {
    claim_text: string;
    claim_type: 'Fact' | 'Promise' | 'Opinion';
    date_said: string;
    context: string;
}

export interface VerificationResult {
    claims: ExtractedFactOrPromise[];
    summary: string;
}

/**
 * Extracts factual claims, promises, and opinions from a given political text.
 * Requires the text context and the politician's name to accurately assign intent.
 */
export async function extractClaimsFromText(
    text: string,
    politicianName: string,
    sourceDate: string | null = null,
    sourceContext: string | null = null
): Promise<VerificationResult | null> {
    try {
        const prompt = `
        You are an expert political fact-checking AI. Your job is to extract verifiable claims and promises from the following text attributed to ${politicianName}.
        
        Guidelines:
        1. Only extract statements that are presented as Facts (e.g., "crime is down 20%"), Promises (e.g., "I will build a wall"), or strong Policy Opinions (e.g., "taxes must be lowered").
        2. Ignore generic rhetoric, greetings, and meaningless statements.
        3. Keep the \`claim_text\` as close to the original quote as possible, but ensure it is a complete, understandable sentence.
        
        Ensure your entire output is valid JSON exactly matching this structure:
        {
          "summary": "A one sentence summary of the main point of the provided text.",
          "claims": [
            {
              "claim_text": "The extracted statement.",
              "claim_type": "Fact", // Must strictly be "Fact", "Promise", or "Opinion"
              "date_said": "The date the statement was made. Use the provided context date if applicable, otherwise 'Unknown'.",
              "context": "A brief description of where/how this was said, e.g., 'Debate 2024'."
            }
          ]
        }

        Source Text:
        """
        ${text}
        """
    `;

        // AIML API routes through the OpenAI SDK structure
        const ai = getAIClient();
        const response = await ai.chat.completions.create({
            model: 'gemini-3-flash-preview',
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1, // Keep it highly deterministic for fact extraction
        });

        const outputString = response.choices[0]?.message?.content;
        if (!outputString) return null;

        const parsed: VerificationResult = JSON.parse(outputString);

        // Apply exact dates/context if provided and the AI failed to guess
        parsed.claims = parsed.claims.map(claim => ({
            ...claim,
            date_said: claim.date_said === 'Unknown' && sourceDate ? sourceDate : claim.date_said,
            context: claim.context === 'Unknown' && sourceContext ? sourceContext : claim.context,
        }));

        return parsed;

    } catch (error) {
        console.error("Error extracting claims with Gemini (AIML API):", error);
        return null;
    }
}

/**
 * Compares two statements to determine if they contradict each other, 
 * representing a 'flip-flop' or change in stance.
 */
export async function detectStanceChange(
    olderClaim: string,
    newerClaim: string,
    topic: string
): Promise<{ has_changed: boolean; shift_description: string | null }> {
    try {
        const prompt = `
        Analyze these two statements made by the same politician regarding the topic: "${topic}".
        
        Older Statement: "${olderClaim}"
        Newer Statement: "${newerClaim}"
        
        Task: 
        Determine if there is a significant contradiction, reversal, or shift in policy stance between the older statement and the newer statement. 
        If there is a change, describe the shift in a short, objective sentence.
        If they generally agree or are just different nuances of the same stance, return has_changed as false.

        Ensure your entire output is valid JSON exactly matching this structure:
        {
            "has_changed": true, // or false
            "shift_description": "If has_changed is true, describe the shift. If false, return null."
        }
    `;

        const ai = getAIClient();
        const response = await ai.chat.completions.create({
            model: 'gemini-3-flash-preview',
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        const outputString = response.choices[0]?.message?.content;
        if (!outputString) return { has_changed: false, shift_description: null };

        const parsed = JSON.parse(outputString);
        return {
            has_changed: parsed.has_changed,
            shift_description: parsed.has_changed ? parsed.shift_description : null
        };

    } catch (error) {
        console.error("Error detecting stance change (AIML API):", error);
        return { has_changed: false, shift_description: null };
    }
}
