-- Original Promise Evidence
ALTER TABLE promises ADD COLUMN original_statement_url TEXT;
ALTER TABLE promises ADD COLUMN original_statement_date TEXT;
-- Status Evidence
ALTER TABLE promises ADD COLUMN status_source TEXT;
ALTER TABLE promises ADD COLUMN status_date TEXT;
ALTER TABLE promises ADD COLUMN notes TEXT;

-- New table for raw statement positioning
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    politician_id TEXT,
    topic TEXT,
    stance TEXT, -- Strictly defined taxonomy
    statement_date TEXT,
    source_url TEXT,
    source_excerpt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);

-- Public methodology transparency
CREATE TABLE IF NOT EXISTS methodology_versions (
    id TEXT PRIMARY KEY,
    version_name TEXT,
    description TEXT,
    formula TEXT,
    is_active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Access Pattern Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_id);
CREATE INDEX IF NOT EXISTS idx_positions_composite ON positions(politician_id, topic, statement_date DESC);
