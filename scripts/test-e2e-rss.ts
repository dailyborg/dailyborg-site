import Parser from 'rss-parser';

// To run: npx tsx scripts/test-e2e-rss.ts

const FEEDS = [
    "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    "https://www.politico.com/rss/politics08.xml" // Standard public feed
];

// In a real Cron process, you'd check everything published since the last run.
// For testing, we look at the last 6 hours.
const RECENCY_THRESHOLD_MS = 6 * 60 * 60 * 1000;

async function runE2E() {
    console.log("=========================================");
    console.log("📰 BORG E2E RSS INGESTION TEST");
    console.log("=========================================");

    console.log(`\n1. CONFIGURATION`);
    console.log(`   Configured Feeds: \n   - ${FEEDS.join('\n   - ')}`);
    console.log(`   Recency Threshold: Last ${RECENCY_THRESHOLD_MS / (1000 * 60 * 60)} hours`);

    const parser = new Parser();
    const now = Date.now();
    let totalFetched = 0;
    let totalRecent = 0;

    // We will only ingest the first recent item we find for the test
    let testItemToIngest: any = null;

    for (const feedUrl of FEEDS) {
        console.log(`\n2. FETCHING: ${feedUrl}`);
        try {
            const feed = await parser.parseURL(feedUrl);
            console.log(`   ✅ Success! Found ${feed.items.length} items.`);
            totalFetched += feed.items.length;

            const recentItems = feed.items.filter((item: any) => {
                if (!item.isoDate) return false;
                const pubDate = new Date(item.isoDate).getTime();
                return (now - pubDate) <= RECENCY_THRESHOLD_MS;
            });

            console.log(`   🕒 Found ${recentItems.length} recent items.`);
            totalRecent += recentItems.length;

            if (recentItems.length > 0 && !testItemToIngest) {
                testItemToIngest = recentItems[0];
                console.log(`   📌 Selecting first recent item for E2E ingestion pipeline test.`);
                console.log(`\n3. SAMPLE PARSED ITEM DATA:`);
                console.log(`   Title: ${testItemToIngest.title}`);
                console.log(`   Link: ${testItemToIngest.link}`);
                console.log(`   Date: ${testItemToIngest.isoDate}`);
                console.log(`   Content Snippet: ${testItemToIngest.contentSnippet?.substring(0, 100)}...`);
            }
        } catch (error) {
            console.error(`   ❌ Failed to parse feed: ${error}`);
        }
    }

    console.log(`\nSUMMARY: Fetched ${totalFetched} total, ${totalRecent} recent.`);

    if (!testItemToIngest) {
        console.log("\n❌ No recent items found to test the API route. Try increasing the RECENCY_THRESHOLD_MS.");
        return;
    }

    console.log("\n=========================================");
    console.log("🚀 TRIGGERING API INGESTION QUEUE");
    console.log("=========================================");

    const payload = {
        sourceUrl: testItemToIngest.link,
        title: testItemToIngest.title,
        rawContent: testItemToIngest.contentSnippet || testItemToIngest.content,
        type: "breaking" // Force type for strict gate evaluation
    };

    console.log(`Dispatching to Local Worker on http://127.0.0.1:8787 ...`);
    try {
        const res = await fetch("http://127.0.0.1:8787/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error(`❌ Next.js API failed with status: ${res.status}`);
            const text = await res.text();
            console.error(`Response: ${text}`);
            return;
        }

        const text = await res.text();
        console.log("✅ Worker API Response:", text);

        console.log("\nNext Steps for Verification:");
        console.log("1. Check your `npm run dev:worker` terminal to see the AI generation, deduplication log, and word-count logs.");
        console.log("2. Check D1 database with `npx wrangler d1 execute dailyborg-db --local --command=\"SELECT slug, article_type FROM articles ORDER BY created_at DESC LIMIT 1\"`");
        console.log("3. Check sources with `npx wrangler d1 execute dailyborg-db --local --command=\"SELECT source_name FROM article_sources ORDER BY id DESC LIMIT 2\"`");

    } catch (err) {
        console.error("Pipeline request failed:", err);
    }
}

runE2E();
