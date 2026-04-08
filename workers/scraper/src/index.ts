export interface Env {
    INGEST_QUEUE: Queue<any>;
    SENTINEL_CACHE: KVNamespace;
}

const RSS_FEEDS = [
    // === POLITICS (2 feeds) ===
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', type: 'politics' },
    { url: 'https://feeds.npr.org/1014/rss.xml', type: 'politics' },

    // === CRIME (2 feeds — VERIFIED LIVE) ===
    { url: 'https://www.cbsnews.com/latest/rss/crime', type: 'crime' },
    { url: 'https://feeds.nbcnews.com/nbcnews/public/news', type: 'crime' },

    // === BUSINESS (2 feeds) ===
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', type: 'business' },
    { url: 'https://feeds.npr.org/1006/rss.xml', type: 'business' },

    // === ENTERTAINMENT (2 feeds) ===
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', type: 'entertainment' },
    { url: 'https://www.cbsnews.com/latest/rss/entertainment', type: 'entertainment' },

    // === SPORTS (1 feed) ===
    { url: 'https://www.espn.com/espn/rss/news', type: 'sports' },

    // === SCIENCE (2 feeds) ===
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', type: 'science' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', type: 'science' },

    // === EDUCATION (2 feeds) ===
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', type: 'education' },
    { url: 'https://www.usnews.com/rss/education', type: 'education' },

    // === GENERAL / WORLD ===
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'standard' }
];

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(this.runScrapingCycle(env, false));
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== "POST") {
            return new Response("Method not allowed. POST to trigger scraper.", { status: 405 });
        }
        
        const body = await request.json().catch(() => ({})) as any;
        const isDeep = body.deep === true;
        const category = body.category || null;
        const amount = body.amount ? parseInt(body.amount, 10) : null;
        
        ctx.waitUntil(this.runScrapingCycle(env, isDeep, category, amount));
        return new Response(`Sentinel scraping cycle (Deep: ${isDeep}, Category: ${category || 'all'}, Amount: ${amount || 'default'}) initiated in background.`, { status: 202 });
    },

    async runScrapingCycle(env: Env, isDeep: boolean = false, targetCategory: string | null = null, targetAmount: number | null = null) {
        const feedsToProcess = targetCategory && targetCategory.toLowerCase() !== 'all' 
            ? RSS_FEEDS.filter(f => f.type.toLowerCase() === targetCategory.toLowerCase())
            : RSS_FEEDS;

        console.log(`[Sentinel] Waking up (Deep Mode: ${isDeep}, Category: ${targetCategory}, Limit: ${targetAmount}). Processing ${feedsToProcess.length} feeds...`);
        let queuedArticles = 0;
        let skippedArticles = 0;

        for (const feed of feedsToProcess) {
            console.log(`[Sentinel] Fetching: ${feed.url}`);
            try {
                const response = await fetch(feed.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });

                if (!response.ok) {
                    console.warn(`[Sentinel] Failed to fetch ${feed.url}: ${response.statusText}`);
                    continue;
                }

                const xmlData = await response.text();
                // Simple regex parser to extract <item> blocks from RSS XML without relying on heavy external parsers
                const items = xmlData.match(/<item>([\s\S]*?)<\/item>/g) || [];

                const targetLimit = targetAmount ? targetAmount : (isDeep ? 15 : 4);
                let newlyDiscoveredCount = 0;

                for (const itemXml of items) {
                    if (newlyDiscoveredCount >= targetLimit) break; // Reached queue quota for this specific feed

                    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
                    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
                    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
                    const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

                    if (!titleMatch || !linkMatch) continue;

                    const title = titleMatch[1].trim();
                    const link = linkMatch[1].trim();
                    let rawContent = descMatch ? descMatch[1].trim() : "No description provided.";

                    // Strip HTML from description if present
                    rawContent = rawContent.replace(/<[^>]*>?/gm, '');

                    // Check deduplication cache
                    const urlHash = await this.hashString(link);
                    const isCached = await env.SENTINEL_CACHE.get(`seen_${urlHash}`);

                    if (isCached && !isDeep) {
                        skippedArticles++;
                        continue;
                    }

                    // Date parsing for backfill accuracy
                    let publishTimestamp = Date.now();
                    if (dateMatch) {
                        const parsedDate = Date.parse(dateMatch[1]);
                        if (!isNaN(parsedDate)) publishTimestamp = parsedDate;
                    }

                    // Dispatch to the Daily Borg Ingest Queue
                    await env.INGEST_QUEUE.send({
                        sourceUrl: link,
                        title: title,
                        rawContent: rawContent,
                        type: feed.type,
                        timestamp: publishTimestamp
                    });

                    // Mark as seen for 72 hours in Deep Mode to prevent re-processing during backfill
                    const ttl = isDeep ? 259200 : 86400;
                    await env.SENTINEL_CACHE.put(`seen_${urlHash}`, '1', { expirationTtl: ttl });
                    
                    newlyDiscoveredCount++;
                    queuedArticles++;
                    console.log(`[Sentinel] Queued -> ${title}`);
                }

            } catch (err: any) {
                console.error(`[Sentinel] Error parsing feed ${feed.url}:`, err.message);
            }
        }

        console.log(`[Sentinel] Cycle Complete. Queued: ${queuedArticles} | Skipped (Cached): ${skippedArticles}`);
    },

    async hashString(str: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};
