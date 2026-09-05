-- Migration 0010: takeover hardening (2026-09-05)
-- Purpose:
--   0. Create every table the code relies on if it is missing (idempotent). Two legacy migrations
--      dropped tables they had just created, and several tables were only ever created ad hoc.
--   1. Give every politician row an authoritative external id so intake never guesses by last name again.
--   2. Add the indexes that the site and workers need so D1 stops scanning whole tables.
--   3. Remove data that was fabricated by the old workers (random trust scores, mock votes, demo rows).
-- Run once on production with:
--   npx wrangler d1 execute dailyborg-db --remote --file=src/migrations/0010_takeover_hardening.sql
-- (see docs/DEPLOY-RUNBOOK.md; the ALTER TABLE lines fail harmlessly if the column already exists,
--  in which case run the file again with those lines removed.)

-- ---------------------------------------------------------------
-- 0. Tables that must exist
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id TEXT PRIMARY KEY,
    event_slug TEXT,
    status TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    plan_type TEXT DEFAULT 'free',
    delivery_channel TEXT DEFAULT 'email',
    frequency TEXT DEFAULT 'daily',
    topics TEXT,
    tracked_politicians TEXT DEFAULT '[]',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_visits (
    id TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    path TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL,
    subscriber_email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    page_type TEXT NOT NULL,
    page_slug TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fact_checks (
    id TEXT PRIMARY KEY,
    politician_slug TEXT NOT NULL,
    statement TEXT NOT NULL,
    rating TEXT NOT NULL,
    analysis_text TEXT,
    source_url TEXT,
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS politician_requests (
    id TEXT PRIMARY KEY,
    requested_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    reference_link TEXT,
    status TEXT DEFAULT 'Pending',
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trustworthiness_history (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    promises_kept INTEGER DEFAULT 0,
    promises_broken INTEGER DEFAULT 0,
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    url TEXT NOT NULL,
    archive_url TEXT,
    source_name TEXT NOT NULL,
    trust_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stance_changes (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    old_claim_id TEXT NOT NULL,
    new_claim_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    shift_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS methodology_versions (
    id TEXT PRIMARY KEY,
    version_name TEXT,
    description TEXT,
    formula TEXT,
    is_active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    bill_id TEXT,
    vote_date TEXT,
    title TEXT,
    result TEXT,
    url TEXT
);

CREATE TABLE IF NOT EXISTS politician_votes (
    politician_id TEXT,
    vote_id TEXT,
    position TEXT,
    rationale TEXT,
    PRIMARY KEY (politician_id, vote_id)
);

CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    politician_id TEXT,
    statement_date TEXT,
    content TEXT NOT NULL,
    source_url TEXT,
    tags TEXT
);

CREATE TABLE IF NOT EXISTS politician_committees (
    politician_id TEXT,
    committee_id TEXT,
    PRIMARY KEY (politician_id, committee_id)
);

CREATE TABLE IF NOT EXISTS subscriber_politicians (
    subscriber_id TEXT,
    politician_id TEXT,
    pinned BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscriber_id, politician_id)
);

-- (production's methodology_versions table has no is_active column, so it is not referenced here)
INSERT OR IGNORE INTO methodology_versions (id, version_name, description, formula)
VALUES ('mv_2026_09', 'v2.0 Public Record', 'Trust from published PolitiFact rulings; consistency from dated position statements. No model-generated scores.', 'Trust = 100 - 100 * mean(falseness); Consistency = MAX(0, 100 - (Contradictions * 15) / Eligible Topics)');

-- ---------------------------------------------------------------
-- 1. Identity and provenance columns
-- ---------------------------------------------------------------
ALTER TABLE politicians ADD COLUMN bioguide_id TEXT;
ALTER TABLE politicians ADD COLUMN openstates_id TEXT;
ALTER TABLE politicians ADD COLUMN wikidata_id TEXT;
ALTER TABLE politicians ADD COLUMN wikipedia_title TEXT;
ALTER TABLE politicians ADD COLUMN state TEXT;
ALTER TABLE politicians ADD COLUMN source TEXT;
ALTER TABLE politicians ADD COLUMN term_start TEXT;
ALTER TABLE politicians ADD COLUMN term_end TEXT;
ALTER TABLE politicians ADD COLUMN photo_source TEXT;
ALTER TABLE politicians ADD COLUMN popularity_scored_at TIMESTAMP;

-- Backfill the two-letter state from the old district_state value ("NY-14" -> "NY", "OH" -> "OH").
UPDATE politicians
SET state = upper(substr(district_state, 1, 2))
WHERE state IS NULL
  AND district_state IS NOT NULL
  AND length(district_state) >= 2
  AND upper(substr(district_state, 1, 2)) GLOB '[A-Z][A-Z]'
  AND (length(district_state) = 2 OR substr(district_state, 3, 1) = '-');

-- Rows that came in through the OpenStates path used a "p-" slug prefix.
UPDATE politicians SET source = 'openstates' WHERE source IS NULL AND slug LIKE 'p-%';
UPDATE politicians SET source = 'legacy' WHERE source IS NULL;

-- ---------------------------------------------------------------
-- 2. Indexes (these are what bring D1 rows_read down)
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articles_approved_date ON articles(approval_status, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_desk_date ON articles(desk, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author_date ON articles(author_id, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_missing_hero ON articles(publish_date DESC) WHERE hero_image_url IS NULL OR hero_image_url = '';

CREATE INDEX IF NOT EXISTS idx_politicians_level_status_name ON politicians(region_level, candidate_status, name);
CREATE INDEX IF NOT EXISTS idx_politicians_state_level ON politicians(state, region_level, candidate_status);
CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians(name);
CREATE INDEX IF NOT EXISTS idx_politicians_source ON politicians(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_politicians_bioguide ON politicians(bioguide_id) WHERE bioguide_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_politicians_openstates ON politicians(openstates_id) WHERE openstates_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_politicians_popularity_scored ON politicians(popularity_scored_at);

CREATE INDEX IF NOT EXISTS idx_fact_checks_politician_date ON fact_checks(politician_slug, date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_checks_source_url ON fact_checks(source_url) WHERE source_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_visits_created ON site_visits(created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_ip_date ON site_visits(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status_created ON ingestion_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_page_status_created ON comments(page_type, page_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_politician_votes_politician ON politician_votes(politician_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_frequency ON subscribers(frequency);
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON politician_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_trust_history_politician ON trustworthiness_history(politician_id);
CREATE INDEX IF NOT EXISTS idx_claims_politician ON claims(politician_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_stance_changes_politician ON stance_changes(politician_id);
CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_id);
CREATE INDEX IF NOT EXISTS idx_positions_politician ON positions(politician_id);

-- ---------------------------------------------------------------
-- 3. Remove fabricated data
-- ---------------------------------------------------------------
-- Trust scores were Math.random() * 20 + 70 written by the old discovery worker. None of them are real.
UPDATE politicians SET trustworthiness_score = NULL, last_scored_at = NULL;
DELETE FROM trustworthiness_history;

-- Mock votes the old worker attached to every politician.
DELETE FROM politician_votes WHERE vote_id IN ('v_hr1-118', 'v_s870-118', 'v_hr3746-118') OR vote_id LIKE 'v_1%_1' OR vote_id LIKE 'v_1%_2';
DELETE FROM votes WHERE id IN ('v_hr1-118', 'v_s870-118', 'v_hr3746-118');

-- Demo politicians from the seed scripts (Eleanor Vance and friends) and their children.
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE slug IN ('sample-slug', 'senator-vance', 'rep-martinez', 'senator-okafor', 'governor-chen') OR name IN ('Eleanor Vance', 'Carlos Martinez', 'Amara Okafor'));
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE slug IN ('sample-slug', 'senator-vance', 'rep-martinez', 'senator-okafor', 'governor-chen') OR name IN ('Eleanor Vance', 'Carlos Martinez', 'Amara Okafor'));
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE slug IN ('sample-slug', 'senator-vance', 'rep-martinez', 'senator-okafor', 'governor-chen') OR name IN ('Eleanor Vance', 'Carlos Martinez', 'Amara Okafor'));
DELETE FROM politicians WHERE slug IN ('sample-slug', 'senator-vance', 'rep-martinez', 'senator-okafor', 'governor-chen') OR name IN ('Eleanor Vance', 'Carlos Martinez', 'Amara Okafor');

-- Demo articles from the admin seed route.
DELETE FROM article_sources WHERE article_id IN ('art_001','art_002','art_003','art_004','art_005','art_006','art_007','art_008');
DELETE FROM articles WHERE id IN ('art_001','art_002','art_003','art_004','art_005','art_006','art_007','art_008');

-- "Requests" that the ingest worker auto-generated from names an AI spotted in articles.
-- They were never requested by a person and were the main source of hallucinated politicians.
DELETE FROM politician_requests WHERE user_email = 'sentinel@dailyborg.com';

-- Old sentinel health rows (one every 15 minutes since April). Keep 30 days.
DELETE FROM ingestion_logs WHERE event_slug = 'sentinel-health' AND created_at < datetime('now', '-30 days');
