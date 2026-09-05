-- 0012: real roll-call votes (House Clerk XML cross-checked with congress.gov; Senate XML cross-checked with the
-- Senate vote menu). Adds identity columns for members, vote metadata, and verification bookkeeping.
-- Applied by: npx wrangler d1 execute dailyborg-db --remote --file src/migrations/0012_roll_call_votes.sql

-- Senators appear in senate.gov vote XML under their LIS id, not their bioguide id.
ALTER TABLE politicians ADD COLUMN lis_id TEXT;
CREATE INDEX IF NOT EXISTS idx_politicians_lis ON politicians(lis_id) WHERE lis_id IS NOT NULL;

ALTER TABLE votes ADD COLUMN chamber TEXT;
ALTER TABLE votes ADD COLUMN congress INTEGER;
ALTER TABLE votes ADD COLUMN session INTEGER;
ALTER TABLE votes ADD COLUMN roll_number INTEGER;
ALTER TABLE votes ADD COLUMN question TEXT;
ALTER TABLE votes ADD COLUMN bill_label TEXT;
ALTER TABLE votes ADD COLUMN vote_type TEXT;
ALTER TABLE votes ADD COLUMN yeas INTEGER;
ALTER TABLE votes ADD COLUMN nays INTEGER;
ALTER TABLE votes ADD COLUMN present INTEGER;
ALTER TABLE votes ADD COLUMN not_voting INTEGER;
ALTER TABLE votes ADD COLUMN source_url_secondary TEXT;
ALTER TABLE votes ADD COLUMN verification TEXT;
ALTER TABLE votes ADD COLUMN verification_note TEXT;
ALTER TABLE votes ADD COLUMN verified_at TEXT;
ALTER TABLE votes ADD COLUMN created_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_roll ON votes(chamber, congress, session, roll_number) WHERE chamber IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(vote_date DESC);
CREATE INDEX IF NOT EXISTS idx_votes_unverified ON votes(verified_at) WHERE verification = 'unverified';

ALTER TABLE politician_votes ADD COLUMN member_key TEXT;
ALTER TABLE politician_votes ADD COLUMN created_at TEXT;
CREATE INDEX IF NOT EXISTS idx_politician_votes_vote ON politician_votes(vote_id);

-- Orphans left by the deleted mock votes.
DELETE FROM politician_votes WHERE vote_id NOT IN (SELECT id FROM votes);
