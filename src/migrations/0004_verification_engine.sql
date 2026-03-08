-- Verification Engine Schema Additions

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Fact', 'Promise', 'Opinion'
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    context TEXT, -- e.g. "Town Hall May 2024"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    url TEXT NOT NULL,
    archive_url TEXT, -- Link to Wayback Machine or R2 snapshot
    source_name TEXT NOT NULL,
    trust_score INTEGER DEFAULT 0, -- 0-100 scale indicating source reliability
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
);

CREATE TABLE IF NOT EXISTS stance_changes (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    old_claim_id TEXT NOT NULL,
    new_claim_id TEXT NOT NULL,
    topic TEXT NOT NULL, -- e.g. "Universal Healthcare", "Border Wall"
    shift_description TEXT, -- AI-generated description of the change
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id),
    FOREIGN KEY (old_claim_id) REFERENCES claims(id),
    FOREIGN KEY (new_claim_id) REFERENCES claims(id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_claims_politician ON claims(politician_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_stance_changes_politician ON stance_changes(politician_id);
CREATE INDEX IF NOT EXISTS idx_stance_changes_topic ON stance_changes(topic);