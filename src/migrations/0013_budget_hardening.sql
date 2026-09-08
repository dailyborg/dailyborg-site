-- 0013: budget hardening (2026-09-08). Written after two Free plan limits were exceeded on 2026-09-06 and 2026-09-07:
-- Workers KV writes (1,000 per day, the scraper's link dedup) and D1 rows written (100,000 per day, mostly the
-- roll-call vote backfill, where every member row also wrote four index rows).
-- Applied by: npx wrangler d1 execute dailyborg-db --remote --file src/migrations/0013_budget_hardening.sql
-- Safe to run more than once.

-- 1. The scraper's link dedup moves from Workers KV to D1. One row per story ever queued (the scraper writes
--    at most the daily article cap per day); sentinel prunes rows older than 30 days.
CREATE TABLE IF NOT EXISTS seen_links (
    url_hash TEXT PRIMARY KEY,
    link TEXT NOT NULL,
    feed_type TEXT,
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_seen_links_queued_at ON seen_links(queued_at);

-- 2. Redundant indexes. Each index costs one extra row written for every insert or update that touches its columns.
--    politician_votes has PRIMARY KEY (politician_id, vote_id), which already serves the profile page lookup by
--    politician_id, so the two single-column indexes on politician_id were pure write cost (a House roll call is
--    about 435 member rows, so each one cost 870 needless index rows).
DROP INDEX IF EXISTS idx_politician_votes_pol;
DROP INDEX IF EXISTS idx_politician_votes_politician;

--    Every politician row has country = 'US' and no query filters on it.
DROP INDEX IF EXISTS idx_politicians_country;

--    social_published belonged to the retired publisher worker. Nothing reads or writes it now, and the index
--    cost one row on every article insert.
DROP INDEX IF EXISTS idx_articles_social_published;
