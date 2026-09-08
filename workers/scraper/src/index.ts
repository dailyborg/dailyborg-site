/**
 * dailyborg-scraper
 *
 * Reads the RSS feed list every two hours and queues fresh stories into ingest-queue.
 *
 * Everything this worker remembers now lives in D1. Workers KV was removed on 2026-09-08, after one
 * KV write per queued link nearly exhausted the Free plan allowance of 1,000 writes a day.
 *
 *   1. Budget. Every run reads the daily article cap from system_settings (daily_article_cap, then
 *      cloudflare_daily_operations_cap, then 40), counts the links already queued today in seen_links,
 *      and spreads what is left over the cron runs still to come today. The scraper never queues more
 *      stories than the ingest worker is allowed to publish, so nothing is queued only to be thrown away.
 *   2. Dedup. Every queued link is recorded in seen_links (url_hash is the primary key). One indexed
 *      lookup per feed asks which of that feed's newest links were queued before. Deep mode only looks
 *      further down a feed, 8 items instead of 3. It never re-queues a link that was seen before.
 *   3. Fairness. The feed order rotates every two hours, and stories are taken round robin, one from
 *      each feed per pass, so the feeds at the top of the list do not eat the whole allowance.
 *   4. Manual triggers. POST runs a cycle in the background and is locked to one run every ten minutes
 *      through the kv_store table (key scraper_manual_lock_until). GET answers 405.
 *   5. Logging. Console lines every run, plus exactly one ingestion_logs row per run, and only when at
 *      least one story was queued.
 *
 * Bindings: INGEST_QUEUE (queue producer) and DB (dailyborg-db). No KV, no secrets.
 */

export interface Env {
    INGEST_QUEUE: Queue<any>;
    DB: D1Database;
}

const RSS_FEEDS = [
    // === POLITICS (2 feeds) ===
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', type: 'politics' },
    { url: 'https://feeds.npr.org/1014/rss.xml', type: 'politics' },

    // === CRIME (2 feeds) ===
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
    { url: 'https://feeds.npr.org/1013/rss.xml', type: 'education' },   // usnews.com/rss/education stopped answering in 2026

    // === GENERAL / WORLD ===
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'standard' }
];

const DEFAULT_DAILY_CAP = 40;
const MAX_ITEMS_PER_FEED = 8;          // also the largest number of placeholders in the dedup lookup
const MANUAL_LOCK_KEY = "scraper_manual_lock_until";
const MANUAL_LOCK_MINUTES = 10;
const FEED_TIMEOUT_MS = 15000;

interface Candidate {
    urlHash: string;
    link: string;
    title: string;
    rawContent: string;
    type: string;
    timestamp: number;
}

interface Budget {
    cap: number;
    queuedToday: number;
    allowance: number;
}

// Small key/value helpers on top of the kv_store table, the same pattern sentinel-engine uses.
async function kvGet(env: Env, key: string): Promise<string | null> {
    const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first<{ value: string }>();
    return row?.value ?? null;
}

async function kvSet(env: Env, key: string, value: string): Promise<void> {
    await env.DB.prepare("INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, value).run();
}

/**
 * How many stories this run is allowed to queue. Two index backed reads: the settings row by primary
 * key, and today's link count on idx_seen_links_queued_at.
 */
async function readBudget(env: Env): Promise<Budget> {
    let cap = DEFAULT_DAILY_CAP;
    const settings = await env.DB.prepare(
        "SELECT key, value FROM system_settings WHERE key IN ('daily_article_cap', 'cloudflare_daily_operations_cap')"
    ).all<{ key: string; value: string }>();
    const map = new Map((settings.results || []).map(r => [r.key, r.value]));
    const raw = map.get('daily_article_cap') ?? map.get('cloudflare_daily_operations_cap');
    if (raw) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed)) cap = parsed;
    }
    cap = Math.min(Math.max(cap, 1), 500);

    const counted = await env.DB.prepare("SELECT COUNT(*) AS n FROM seen_links WHERE queued_at >= date('now')").first<{ n: number }>();
    const queuedToday = counted?.n ?? 0;

    const remaining = cap - queuedToday;
    if (remaining <= 0) return { cap, queuedToday, allowance: 0 };

    // The cron fires every two hours. Spread what is left over the runs still to come today, but let an
    // early run take at least four so a quiet morning does not stall the newsroom.
    const runsLeft = Math.max(1, Math.ceil((24 - new Date().getUTCHours()) / 2));
    const allowance = Math.min(remaining, Math.max(4, Math.ceil(remaining / runsLeft)));
    return { cap, queuedToday, allowance };
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(this.runScrapingCycle(env, false));
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method !== "POST") {
            return new Response("Method not allowed. POST to trigger scraper.", { status: 405 });
        }

        // Manual triggers (admin panel, sentinel) are limited to one every 10 minutes so a stray
        // caller cannot flood the ingest queue and the AIML bill. The lock is a timestamp in kv_store.
        try {
            const lockedUntil = await kvGet(env, MANUAL_LOCK_KEY);
            if (lockedUntil) {
                const t = Date.parse(lockedUntil);
                if (!isNaN(t) && t > Date.now()) {
                    return new Response("Scraper was triggered less than 10 minutes ago. Try again later.", { status: 429 });
                }
            }
            await kvSet(env, MANUAL_LOCK_KEY, new Date(Date.now() + MANUAL_LOCK_MINUTES * 60000).toISOString());
        } catch (err: any) {
            // A D1 hiccup must not break the manual trigger. The daily budget read still guards the run.
            console.error("[Sentinel] Manual trigger lock unavailable:", err?.message || err);
        }

        const body = await request.json().catch(() => ({})) as any;
        const isDeep = body.deep === true;
        const category = body.category || null;
        const amountRaw = body.amount ? parseInt(body.amount, 10) : null;
        const amount = amountRaw && Number.isFinite(amountRaw) ? Math.min(Math.max(amountRaw, 1), 10) : null;

        ctx.waitUntil(this.runScrapingCycle(env, isDeep, category, amount));
        return new Response(`Sentinel scraping cycle (Deep: ${isDeep}, Category: ${category || 'all'}, Amount: ${amount || 'default'}) initiated in background.`, { status: 202 });
    },

    async runScrapingCycle(env: Env, isDeep: boolean = false, targetCategory: string | null = null, targetAmount: number | null = null) {
        // The one step that is allowed to end the run. Without a budget the scraper would queue blind.
        let budget: Budget;
        try {
            budget = await readBudget(env);
        } catch (err: any) {
            console.error("[Sentinel] Budget read failed, queuing nothing this run:", err?.message || err);
            return;
        }

        if (budget.allowance <= 0) {
            console.log(`[Sentinel] Daily cap reached (${budget.queuedToday} of ${budget.cap} queued today). Nothing to do.`);
            return;
        }

        const filtered = targetCategory && targetCategory.toLowerCase() !== 'all'
            ? RSS_FEEDS.filter(f => f.type.toLowerCase() === targetCategory.toLowerCase())
            : RSS_FEEDS;

        if (filtered.length === 0) {
            console.warn(`[Sentinel] No feeds match category "${targetCategory}". Nothing to do.`);
            return;
        }

        // Rotate the starting feed every two hours so the top of the list does not always go first.
        const rotation = Math.floor(Date.now() / 7200000) % filtered.length;
        const feedsToProcess = filtered.slice(rotation).concat(filtered.slice(0, rotation));

        // How far down a feed we hunt for unseen stories, and how many one feed may contribute.
        const scanWindow = isDeep ? 8 : 3;
        const perFeedMax = targetAmount ? targetAmount : (isDeep ? 8 : 3);

        console.log(`[Sentinel] Waking up (Deep Mode: ${isDeep}, Category: ${targetCategory || 'all'}, Per feed: ${perFeedMax}). Allowance ${budget.allowance}, cap ${budget.cap}, ${budget.queuedToday} queued earlier today. Processing ${feedsToProcess.length} feeds...`);

        // ---- Pass one: read each feed once and work out which of its newest links are new to us. ----
        const freshPerFeed: Candidate[][] = [];
        let feedsRead = 0;
        let skippedArticles = 0;

        for (const feed of feedsToProcess) {
            const parsed = await this.readFeed(feed);
            if (parsed === null) {
                freshPerFeed.push([]);
                continue;
            }
            feedsRead++;

            const window = parsed.slice(0, scanWindow);
            if (window.length === 0) {
                freshPerFeed.push([]);
                continue;
            }

            // One indexed lookup per feed instead of one per story.
            let seen: Set<string>;
            try {
                const placeholders = window.map(() => '?').join(', ');
                const { results } = await env.DB.prepare(`SELECT url_hash FROM seen_links WHERE url_hash IN (${placeholders})`)
                    .bind(...window.map(c => c.urlHash))
                    .all<{ url_hash: string }>();
                seen = new Set((results || []).map(r => r.url_hash));
            } catch (err: any) {
                // Skip this feed rather than queue duplicates. The rest of the run carries on.
                console.error(`[Sentinel] Dedup lookup failed for ${feed.url}, skipping this feed:`, err?.message || err);
                freshPerFeed.push([]);
                continue;
            }

            const fresh = window.filter(c => !seen.has(c.urlHash));
            skippedArticles += window.length - fresh.length;
            freshPerFeed.push(fresh);
        }

        // ---- Pass two: take stories round robin, one from each feed per pass, until the allowance is gone. ----
        const queuedStories: Candidate[] = [];
        const takenPerFeed: number[] = freshPerFeed.map(() => 0);

        for (let pass = 0; pass < scanWindow && queuedStories.length < budget.allowance; pass++) {
            let tookOne = false;
            for (let f = 0; f < freshPerFeed.length && queuedStories.length < budget.allowance; f++) {
                if (takenPerFeed[f] >= perFeedMax) continue;
                const story = freshPerFeed[f][pass];
                if (!story) continue;

                try {
                    await env.INGEST_QUEUE.send({
                        sourceUrl: story.link,
                        title: story.title,
                        rawContent: story.rawContent,
                        type: story.type,
                        timestamp: story.timestamp
                    });
                } catch (err: any) {
                    console.error(`[Sentinel] Queue send failed for ${story.link}:`, err?.message || err);
                    continue;
                }

                takenPerFeed[f]++;
                queuedStories.push(story);
                tookOne = true;
                console.log(`[Sentinel] Queued -> ${story.title}`);
            }
            if (!tookOne) break;
        }

        // ---- Record what went out. One batch, INSERT OR IGNORE so a retry can never duplicate a row. ----
        if (queuedStories.length > 0) {
            try {
                const stmt = env.DB.prepare("INSERT OR IGNORE INTO seen_links (url_hash, link, feed_type) VALUES (?, ?, ?)");
                await env.DB.batch(queuedStories.map(c => stmt.bind(c.urlHash, c.link, c.type)));
            } catch (err: any) {
                // The ingest worker also dedups by slug, so a lost record costs one duplicate at worst.
                console.error("[Sentinel] Could not record queued links in seen_links:", err?.message || err);
            }
        }

        console.log(`[Sentinel] Cycle complete. Queued: ${queuedStories.length} of ${budget.allowance} allowed | Skipped (already seen): ${skippedArticles} | Feeds read: ${feedsRead} of ${feedsToProcess.length}`);

        // Exactly one log row per run, and only when the run actually did something.
        if (queuedStories.length > 0) {
            try {
                const message = `Scraper queued ${queuedStories.length} of ${budget.allowance} allowed (cap ${budget.cap}, ${budget.queuedToday} queued earlier today), skipped ${skippedArticles} already seen, ${feedsRead} feeds read`;
                await env.DB.prepare("INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, 'scraper', 'healthy', ?)")
                    .bind(crypto.randomUUID(), message.slice(0, 500))
                    .run();
            } catch (err: any) {
                console.error("[Sentinel] Could not write the run log:", err?.message || err);
            }
        }
    },

    /**
     * Fetches one feed and returns its newest items, or null when the feed could not be read.
     * At most MAX_ITEMS_PER_FEED items come back, which is also the cap on the dedup placeholders.
     */
    async readFeed(feed: { url: string; type: string }): Promise<Candidate[] | null> {
        console.log(`[Sentinel] Fetching: ${feed.url}`);
        let xmlData: string;
        try {
            const response = await fetch(feed.url, {
                // A plain named agent. ESPN answers a browser agent with an empty 202; every feed answers this one.
                headers: { 'User-Agent': 'DailyBorg/2.0 (+https://dailyborg.com; pressroom@dailyborg.com)' },
                signal: AbortSignal.timeout(FEED_TIMEOUT_MS)
            });

            if (!response.ok) {
                console.warn(`[Sentinel] Failed to fetch ${feed.url}: ${response.statusText}`);
                return null;
            }

            xmlData = await response.text();
        } catch (err: any) {
            console.error(`[Sentinel] Feed ${feed.url} failed or timed out:`, err?.message || err);
            return null;
        }

        // Simple regex parser to extract <item> blocks from RSS XML without relying on heavy external parsers
        const items = xmlData.match(/<item>([\s\S]*?)<\/item>/g) || [];
        const candidates: Candidate[] = [];

        for (const itemXml of items) {
            if (candidates.length >= MAX_ITEMS_PER_FEED) break;

            const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
            const linkMatch = itemXml.match(/<link>\s*(?:<!\[CDATA\[)?\s*(.*?)\s*(?:\]\]>)?\s*<\/link>/);
            const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
            const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

            if (!titleMatch || !linkMatch) continue;

            const title = titleMatch[1].trim();
            const link = linkMatch[1].trim();
            let rawContent = descMatch ? descMatch[1].trim() : "No description provided.";

            // Strip HTML from description if present
            rawContent = rawContent.replace(/<[^>]*>?/gm, '');

            // Date parsing for backfill accuracy
            let publishTimestamp = Date.now();
            if (dateMatch) {
                const parsedDate = Date.parse(dateMatch[1]);
                if (!isNaN(parsedDate)) publishTimestamp = parsedDate;
            }

            candidates.push({
                urlHash: await this.hashString(link),
                link: link,
                title: title,
                rawContent: rawContent,
                type: feed.type,
                timestamp: publishTimestamp
            });
        }

        return candidates;
    },

    async hashString(str: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};
