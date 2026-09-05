# workers/scraper (dailyborg-scraper)

Reads the RSS feed list in src/index.ts every two hours and queues new stories to ingest-queue (3 per feed, 8 in deep mode). KV SENTINEL_CACHE dedups links for 24 hours (72 in deep mode). Manual POST triggers are rate limited to one per ten minutes.
