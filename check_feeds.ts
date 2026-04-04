import Parser from 'rss-parser';

const RSS_FEEDS = [
    { url: 'https://feeds.npr.org/1014/rss.xml', type: 'standard' },
    { url: 'https://rss.politico.com/politics-news.xml', type: 'politics' },
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'standard' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', type: 'politics' }
];

async function testFeeds() {
    const parser = new Parser();
    console.log("Checking RSS feed dates...");
    for (const feed of RSS_FEEDS) {
        try {
            const data = await parser.parseURL(feed.url);
            console.log(`\nFeed: ${feed.url} (${data.title})`);
            const firstItem = data.items[0];
            if (firstItem) {
                console.log(`  Last Item: ${firstItem.title}`);
                console.log(`  Date: ${firstItem.isoDate || firstItem.pubDate}`);
            } else {
                console.log("  No items found.");
            }
        } catch (err) {
            console.log(`  Error: ${(err as Error).message}`);
        }
    }
}

testFeeds();
