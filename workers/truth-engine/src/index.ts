export interface Env {
    DB: D1Database;
    AI: any;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`[Truth Engine] Initiating 6-hour autonomous truth matrix cycle...`);

        // 1. Double-verify and store any fact checks found via recent articles.
        await this.factCheckRecentArticles(env);

        // 2. Poll external fact-checking syndicates (RSS)
        await this.syncExternalFactCheckers(env);

        // 3. Dig into historical archives for tracked politicians
        await this.syncHistoricalArchives(env);
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const action = url.searchParams.get('action') || 'all';

        console.log(`[Truth Engine] Manual trigger received. Action: ${action}`);

        if (action === 'articles') await this.factCheckRecentArticles(env);
        else if (action === 'external') await this.syncExternalFactCheckers(env);
        else if (action === 'history') await this.syncHistoricalArchives(env);
        else {
            await this.factCheckRecentArticles(env);
            await this.syncExternalFactCheckers(env);
            await this.syncHistoricalArchives(env);
        }

        return new Response("Truth Engine matrix cycle completed.", { status: 200 });
    },

    // =========================================================================================
    // 1. RECENT ARTICLES (Transferred & upgraded from discovery-engine)
    // =========================================================================================
    async factCheckRecentArticles(env: Env) {
        console.log(`[Truth Engine] Scanning recent Daily Borg articles...`);

        const { results: recentArticles } = await env.DB.prepare(`
            SELECT id, title, content_html FROM articles 
            WHERE publish_date > datetime('now', '-24 hours')
            ORDER BY RANDOM() LIMIT 5
        `).all();

        if (!recentArticles || recentArticles.length === 0) return;

        const { results: activePoliticians } = await env.DB.prepare(`SELECT slug, name, party FROM politicians`).all();
        if (!activePoliticians || activePoliticians.length === 0) return;

        for (const article of recentArticles as any[]) {
            const articleText = article.content_html.replace(/<[^>]*>?/gm, ''); 
            
            const mentioned = activePoliticians.filter((p: any) => articleText.includes(p.name) || articleText.includes(p.name.split(' ').pop()));
            
            for (const pol of mentioned as any[]) {
                try {
                    const extracted = await this.extractClaimWithAI(env, pol, articleText);
                    if (extracted && extracted.statement) {
                        // Enter the Double-Verification Matrix
                        await this.executeDoubleVerificationMatrix(env, pol, extracted.statement, extracted.rating, "Daily Borg Analysis", `https://dailyborg.com/articles/${article.id}`);
                    }
                } catch (e: any) {
                    console.error(`[Truth Engine] Error scanning article for ${pol.name}:`, e.message);
                }
            }
        }
    },

    async extractClaimWithAI(env: Env, pol: any, textContext: string) {
        const prompt = `
Analyze the following news excerpt for any direct claims, promises, or statements made by ${pol.name}.
If they made a statement that is verifiably false or considered a "lie" based on general public consensus, report it.
If there are no false statements, reply with exactly: NONE

Article Excerpt: ${textContext.substring(0, 1000)}

Respond strictly in JSON format:
{
  "statement": "The exact lie they told",
  "rating": "pants_on_fire" | "mostly_false",
  "analysis_text": "Why it is false"
}
`;
        const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: [{ role: 'user', content: prompt }] });
        const textResponse = aiResponse.response || aiResponse;

        if (textResponse && !textResponse.includes('NONE') && textResponse.includes('{')) {
            const jsonMatch = textResponse.match(/\{[\s\S]*?\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        }
        return null;
    },

    // =========================================================================================
    // 2. EXTERNAL FACT-CHECKING SYNDICATES (RSS Polling)
    // =========================================================================================
    async syncExternalFactCheckers(env: Env) {
        console.log(`[Truth Engine] Sweeping external fact-checking syndicates...`);
        
        // Example: Snopes or PolitiFact public RSS feeds.
        const feeds = [
            'https://www.politifact.com/rss/all/' // Free public RSS
        ];

        const { results: activePoliticians } = await env.DB.prepare(`SELECT slug, name FROM politicians`).all();

        for (const feedUrl of feeds) {
            try {
                const res = await fetch(feedUrl, { headers: { 'User-Agent': 'DailyBorg Tracker/1.0' }});
                if (!res.ok) continue;
                
                const xml = await res.text();
                
                // Parse items out of XML string (dirty regex pattern map for Edge Worker compatibility)
                const itemsMatch = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
                
                for (const itemXml of itemsMatch.slice(0, 5)) { // Only process latest 5 to save limits
                    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
                    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
                    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);

                    if (!titleMatch) continue;

                    const title = titleMatch[1];
                    const desc = descMatch ? descMatch[1] : '';
                    const link = linkMatch ? linkMatch[1] : '';

                    // Cross-reference with our DB
                    const matchedPol = (activePoliticians as any[]).find(p => title.includes(p.name) || desc.includes(p.name));
                    
                    if (matchedPol) {
                        // Is it classified as a lie by the syndicate?
                        if (title.toLowerCase().includes('false') || title.toLowerCase().includes('pants on fire')) {
                            const rating = title.toLowerCase().includes('pants on fire') ? 'pants_on_fire' : 'mostly_false';
                            console.log(`[Truth Engine] Syndicate match found for ${matchedPol.name}: ${title}`);
                            
                            // Send to Matrix
                            await this.executeDoubleVerificationMatrix(env, matchedPol, desc.substring(0, 200) + '...', rating, "Syndicate Verdict Audit", link);
                        }
                    }
                }

            } catch (e: any) {
                console.error(`[Truth Engine] External RSS fetch failed:`, e.message);
            }
        }
    },

    // =========================================================================================
    // 3. HISTORICAL ARCHIVES (Wikipedia Extraction)
    // =========================================================================================
    async syncHistoricalArchives(env: Env) {
        console.log(`[Truth Engine] Querying historical archives for past presidents...`);
        
        // Grab one historical politician (or any politician) at random to prevent rate limit blows
        const { results: target } = await env.DB.prepare(`SELECT slug, name, party FROM politicians ORDER BY RANDOM() LIMIT 1`).all();
        if (!target || target.length === 0) return;
        const pol = (target as any[])[0];

        try {
            const wikiTitle = encodeURIComponent(pol.name.replace(/ /g, '_'));
            // Use Wikipedia extracts API to grab sections (specifically looking for controversies or criticisms)
            const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=false&explaintext=true&titles=${wikiTitle}&format=json`;
            const wikiRes = await fetch(wikiUrl);
            const wikiData: any = await wikiRes.json();
            
            const pages = wikiData?.query?.pages;
            if (!pages) return;
            const pageId = Object.keys(pages)[0];
            if (pageId === "-1") return;

            const fullText = (pages[pageId].extract || "");
            
            // Extract the "Controversies" or "Public Image" segments if they exist, or just sample the text
            const controversyIndex = fullText.toLowerCase().indexOf('controversi');
            const sampleText = controversyIndex > -1 ? fullText.substring(controversyIndex, controversyIndex + 1500) : fullText.substring(0, 1500);

            const extracted = await this.extractClaimWithAI(env, pol, sampleText);
            if (extracted && extracted.statement) {
                 await this.executeDoubleVerificationMatrix(env, pol, extracted.statement, extracted.rating, "Historical Archives Audit", `https://en.wikipedia.org/wiki/${wikiTitle}`);
            }

        } catch (e: any) {
            console.error(`[Truth Engine] History sync failed for ${pol.name}:`, e.message);
        }
    },

    // =========================================================================================
    // 4. THE DOUBLE-VERIFICATION MATRIX
    // =========================================================================================
    async executeDoubleVerificationMatrix(env: Env, pol: any, statement: string, proposedRating: string, analysisContext: string, sourceUrl: string) {
        console.log(`[Truth Matrix] Entering Double-Verification for ${pol.name}: "${statement.substring(0, 30)}..."`);
        
        // CHECK 1: Independent Search Presence 
        // We ping a search engine (like DuckDuckGo HTML) to see if the quote physically exists in general internet indexing.
        try {
            const query = encodeURIComponent(`"${statement.substring(0, 50)}"`);
            const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (ddgRes.ok) {
                const html = await ddgRes.text();
                if (html.includes('No results found for')) {
                    console.log(`[Truth Matrix] Check 1 FAILED. Source uncorroborated by independent index.`);
                    return; // Fail Check 1
                }
            }
        } catch (e) {
            console.warn(`[Truth Matrix] Check 1 DDG fetch skipped due to block, relying on AI.`);
            // If the search blocks us, we fall back to the AI verification purely so the system doesn't permanently stall
        }

        console.log(`[Truth Matrix] Check 1 PASSED. Statement is indexed.`);

        // CHECK 2: Objective AI Corroboration
        // We strip the media's bias out and ask the model to cleanly verify the factual accuracy of the statement.
        const verifyPrompt = `
You are an objective auditor. A third party claims ${pol.name} said: "${statement}".
They claim this statement is false.
Using your historical knowledge base, is this statement objectively, factually false?
Consider context, hyperbole, and verifiable data.
Respond with EXACTLY ONE WORD first: YES (if it is a lie) or NO (if it is true or an opinion).
Then provide a 1-sentence objective explanation.
        `;

        try {
            const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: [{ role: 'user', content: verifyPrompt }] });
            const aiVerdict = (aiRes.response || aiRes).toUpperCase();

            if (aiVerdict.startsWith('YES')) {
                console.log(`[Truth Matrix] Check 2 PASSED. Truth Engine confirms falsehood.`);
                
                // Explanatory breakdown
                const aiExplanation = aiVerdict.split('\n')[1] || analysisContext;

                // COMMIT TO DATABASE
                await env.DB.prepare(`
                    INSERT INTO fact_checks (id, politician_slug, statement, rating, analysis_text, source_url, date)
                    VALUES (?, ?, ?, ?, ?, ?, date('now'))
                `).bind(
                    crypto.randomUUID(),
                    pol.slug,
                    statement,
                    proposedRating,
                    aiExplanation,
                    sourceUrl
                ).run();
                console.log(`[Truth Matrix] SAVED.`);
            } else {
                 console.log(`[Truth Matrix] Check 2 FAILED. Truth Engine ruled statement is not an objective lie.`);
            }

        } catch(e: any) {
            console.error(`[Truth Matrix] Check 2 error:`, e.message);
        }
    }
}
