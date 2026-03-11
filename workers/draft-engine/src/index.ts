export interface Env {
    DB: D1Database;
    AIML_API_KEY: string;
    RESEND_API_KEY: string;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(processPendingRequests(env));
    },

    // Optional HTTP handler to force-trigger the process during development/testing
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (new URL(request.url).pathname === '/__force_draft') {
            await processPendingRequests(env);
            return new Response('Draft Engine Pass Complete', { status: 200 });
        }
        return new Response('Draft Engine Active', { status: 200 });
    }
};

async function processPendingRequests(env: Env) {
    try {
        // Grab a small batch to ensure we don't hit 30s execution timeouts easily
        const { results: pending } = await env.DB.prepare(
            `SELECT * FROM politician_requests WHERE status = 'Pending' LIMIT 3`
        ).all();

        if (!pending || pending.length === 0) {
            console.log("No pending politician requests.");
            return;
        }

        console.log(`Processing ${pending.length} pending requests...`);

        for (const request of pending as any[]) {
            const { id, requested_name, user_email, reference_link } = request;

            console.log(`Evaluating: ${requested_name}`);

            // STEP 1: AI Verification
            const aiPrompt = `
You are the verification engine for an authoritative US political database.
The user has requested to add the following politician to our database:
Name: "${requested_name}"
Reference Link Provided: "${reference_link || 'None'}"

Is this person a verifiable, notable political figure (current or historical) in the United States? 
If YES, you must provide their standardized name, a URL-friendly slug, their party, the primary office they held/hold, their state/district, and a formatted time in office.
If NO, set verified to false.

Respond ONLY with valid JSON matching this schema:
{
  "verified": boolean,
  "standardized_name": string,
  "slug": string (e.g. "smith-john"),
  "party": "Democrat" | "Republican" | "Independent" | "Other",
  "office_held": string,
  "district_state": string (e.g. "CA" or "NY-14"),
  "time_in_office": string (e.g. "2010-Present" or "4 Years")
}
`;

            let generatedData = null;
            try {
                const aiRes = await fetch("https://api.aimlapi.com/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.AIML_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "gemini-3-flash-preview",
                        messages: [{ role: "user", content: aiPrompt }],
                        response_format: { type: "json_object" }
                    })
                });

                if (aiRes.ok) {
                    const data = await aiRes.json() as any;
                    const content = data.choices[0].message.content;
                    generatedData = JSON.parse(content);
                } else {
                    console.error("AI API Error:", await aiRes.text());
                }
            } catch (e) {
                console.error("Failed to execute AI verification", e);
            }

            // STEP 2: Database Insertion / Rejection
            if (!generatedData || !generatedData.verified) {
                await env.DB.prepare(
                    `UPDATE politician_requests SET status = 'Rejected', verification_notes = 'Failed AI Verification or Not Found' WHERE id = ?`
                ).bind(id).run();
                console.log(`Rejected: ${requested_name}`);
                continue;
            }

            // Validated! Insert into politicians table
            const polId = `pol_${crypto.randomUUID()}`;
            try {
                await env.DB.batch([
                    env.DB.prepare(`
                        INSERT INTO politicians (id, slug, name, office_held, party, district_state, time_in_office, country, region_level)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'US', 'Federal')
                    `).bind(
                        polId,
                        generatedData.slug,
                        generatedData.standardized_name,
                        generatedData.office_held,
                        generatedData.party,
                        generatedData.district_state,
                        generatedData.time_in_office
                    ),
                    env.DB.prepare(`
                        UPDATE politician_requests SET status = 'Generated', verification_notes = 'Successfully seeded by AI' WHERE id = ?
                    `).bind(id)
                ]);
                console.log(`Generated and Seeding: ${generatedData.standardized_name}`);

                // STEP 3: Dispatch Success Email via Resend
                await sendNotificationEmail(env, user_email, generatedData);

            } catch (dbErr) {
                console.error(`Database insertion failed for ${requested_name}:`, dbErr);
                await env.DB.prepare(
                    `UPDATE politician_requests SET status = 'Pending', verification_notes = 'Database error, retrying later' WHERE id = ?`
                ).bind(id).run();
            }
        }
    } catch (e) {
        console.error("Draft Engine Critical Error:", e);
    }
}

async function sendNotificationEmail(env: Env, email: string, politicianData: any) {
    if (!env.RESEND_API_KEY) {
        console.warn("RESEND_API_KEY missing - skipping email dispatch");
        return;
    }

    const htmlContent = `
        <div style="font-family: serif; max-width: 600px; margin: 0 auto; color: #111; border: 2px solid #111; padding: 32px;">
            <p style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; border-bottom: 1px solid #111; padding-bottom: 8px;">The Daily Borg • Public Record Network</p>
            <h1 style="font-size: 32px; font-weight: 900; margin: 0 0 16px 0;">Profile Authorized.</h1>
            <p style="font-family: sans-serif; font-size: 16px; line-height: 1.6; color: #444;">
                Our algorithmic engines have successfully verified your request and initialized a new Public Record matrix for <strong>${politicianData.standardized_name}</strong>.
            </p>
            <div style="background-color: #f5f5f5; padding: 16px; margin: 24px 0; border-left: 4px solid #111;">
                <p style="margin: 0; font-family: sans-serif; font-size: 14px; text-transform: uppercase;">
                    <strong>Office:</strong> ${politicianData.office_held} • ${politicianData.district_state}<br>
                    <strong>Party Identification:</strong> ${politicianData.party}
                </p>
            </div>
            <a href="https://dailyborg.com/borg-record/politicians/${politicianData.slug}" style="display: inline-block; background-color: #111; color: #fff; text-decoration: none; padding: 16px 24px; font-family: sans-serif; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 16px;">
                View The Record
            </a>
            <p style="font-family: sans-serif; font-size: 12px; color: #888; margin-top: 48px; text-align: center;">
                You are receiving this alert because you initialized this request. The system immediately tracked your submission.
            </p>
        </div>
    `;

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'The Daily Borg <notifications@dailyborg.com>',
                to: [email],
                subject: 'Your requested politician profile is active.',
                html: htmlContent
            })
        });

        if (!res.ok) {
            console.error("Resend API rejected the email", await res.text());
        } else {
            console.log(`Success email dispatched to ${email}`);
        }
    } catch (e) {
        console.error("Network error sending notification email", e);
    }
}
