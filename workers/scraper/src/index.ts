export interface Env {
    INGEST_QUEUE: Queue<any>;
    SENTINEL_CACHE: KVNamespace;
}

const RSS_FEEDS = [
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'standard' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=120000000&id=10000115', type: 'business' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', type: 'politics' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', type: 'science' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', type: 'education' },
    { url: 'https://www.usnews.com/rss/education', type: 'education' }, 
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', type: 'entertainment' },
    { url: 'https://www.espn.com/espn/rss/news', type: 'sports' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Crime.xml', type: 'crime' }, 
    { url: 'https://moxie.foxnews.com/google-publisher/us-crime.xml', type: 'crime' }
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
        
        ctx.waitUntil(this.runScrapingCycle(env, isDeep));
        return new Response(`Sentinel scraping cycle (Deep: ${isDeep}) initiated in background.`, { status: 202 });
    },

    async runScrapingCycle(env: Env, isDeep: boolean = false) {
        console.log(`[Sentinel] Waking up (Deep Mode: ${isDeep}). Processing ${RSS_FEEDS.length} feeds...`);
        let queuedArticles = 0;
        let skippedArticles = 0;

        for (const feed of RSS_FEEDS) {
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

                // In Deep Mode, we process up to 15 articles per feed to catch historical gaps
                const itemsToProcess = isDeep ? items.slice(0, 15) : items.slice(0, 4);

                for (const itemXml of itemsToProcess) {
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
