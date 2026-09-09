-- 0015: per-official vote counters (2026-09-09).
-- Why: the profile page counted every stored vote row for an official on each cache miss (about 220 rows today,
-- growing with every roll call), and crawlers load thousands of profiles a day: 2.5 million rows read on
-- 2026-09-09 against a Free plan limit of 5 million. Four running totals on the politicians row cost one written
-- row per member per roll call and make the attendance figures a single-row read.
-- Applied by: one statement at a time with `wrangler d1 execute dailyborg-db --remote --command`.
-- The ALTER TABLE lines fail with "duplicate column name" if run twice; that is harmless.
ALTER TABLE politicians ADD COLUMN votes_total INTEGER DEFAULT 0;
ALTER TABLE politicians ADD COLUMN votes_missed INTEGER DEFAULT 0;
ALTER TABLE politicians ADD COLUMN votes_yea INTEGER DEFAULT 0;
ALTER TABLE politicians ADD COLUMN votes_nay INTEGER DEFAULT 0;

-- One-time backfill from the rows already stored (reads each federal official's rows through the primary key).
UPDATE politicians SET
    votes_total = (SELECT COUNT(*) FROM politician_votes pv WHERE pv.politician_id = politicians.id),
    votes_missed = (SELECT COUNT(*) FROM politician_votes pv WHERE pv.politician_id = politicians.id AND pv.position = 'Not Voting'),
    votes_yea = (SELECT COUNT(*) FROM politician_votes pv WHERE pv.politician_id = politicians.id AND pv.position = 'Yea'),
    votes_nay = (SELECT COUNT(*) FROM politician_votes pv WHERE pv.politician_id = politicians.id AND pv.position = 'Nay')
WHERE region_level = 'Federal';
