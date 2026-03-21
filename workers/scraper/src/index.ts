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
    { url: 'https://www.usnews.com/rss/education', type: 'education' }, // Backup
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', type: 'entertainment' },
    { url: 'https://www.espn.com/espn/rss/news', type: 'sports' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Crime.xml', type: 'crime' }, // Note: NYT often rolls crime into NY Region or general news, but some feeds exist. Let's add a generic crime one just in case, or Fox News Crime.
    { url: 'https://moxie.foxnews.com/google-publisher/us-crime.xml', type: 'crime' }
];

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(this.runScrapingCycle(env));
    },

    // Allow manual HTTP trigger for E2E testing
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== "POST") {
            return new Response("Method not allowed. POST to trigger scraper.", { status: 405 });
        }
        ctx.waitUntil(this.runScrapingCycle(env));
        return new Response("Sentinel scraping cycle initiated in background.", { status: 202 });
    },

    async runScrapingCycle(env: Env) {
        console.log(`[Sentinel] Waking up. Processing ${RSS_FEEDS.length} feeds...`);
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

                // Only process the 4 most recent articles per feed per hour to prevent AI API rate limiting
                const recentItems = items.slice(0, 4);

                for (const itemXml of recentItems) {
                    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
                    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
                    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);

                    if (!titleMatch || !linkMatch) continue;

                    const title = titleMatch[1].trim();
                    const link = linkMatch[1].trim();
                    let rawContent = descMatch ? descMatch[1].trim() : "No description provided.";

                    // Strip HTML from description if present
                    rawContent = rawContent.replace(/<[^>]*>?/gm, '');

                    // Check deduplication cache
                    const urlHash = await this.hashString(link);
                    const isCached = await env.SENTINEL_CACHE.get(`seen_${urlHash}`);

                    if (isCached) {
                        skippedArticles++;
                        continue;
                    }

                    // Dispatch to the Daily Borg Ingest Queue
                    await env.INGEST_QUEUE.send({
                        sourceUrl: link,
                        title: title,
                        rawContent: rawContent,
                        type: feed.type,
                        timestamp: Date.now()
                    });

                    // Mark as seen for 24 hours to prevent re-processing
                    await env.SENTINEL_CACHE.put(`seen_${urlHash}`, '1', { expirationTtl: 86400 });
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
