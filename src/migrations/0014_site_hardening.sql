-- 0014: site hardening (2026-09-08), written after the back end audit.
-- Applied by: npx wrangler d1 execute dailyborg-db --remote --file src/migrations/0014_site_hardening.sql
-- Safe to run more than once, except the ALTER TABLE line, which SQLite refuses a second time
-- ("duplicate column name"); that error can be ignored.

-- 1. Every subscriber gets a private unsubscribe token. The site sets it at sign-up and the briefing worker
--    fills it in for older rows before it sends anything. No shared secret is needed between the two.
ALTER TABLE subscribers ADD COLUMN unsubscribe_token TEXT;

-- 2. Politician search. The public /api/politicians?q= route used two LIKE scans over the whole table for
--    every distinct query (a few thousand rows read each, unbounded by anyone typing new letters).
--    A case-insensitive index on the full name serves "starts with" searches, and an expression index on
--    the last word of the name serves last-name searches. Queries must use the exact same expression
--    and COLLATE NOCASE so SQLite can use the index.
CREATE INDEX IF NOT EXISTS idx_politicians_name_nocase ON politicians(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_politicians_lastword_nocase ON politicians(substr(name, length(rtrim(name, replace(name, ' ', ''))) + 1) COLLATE NOCASE);
