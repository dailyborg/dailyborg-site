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

CREATE INDEX IF NOT EXISTS idx_fact_checks_politician ON fact_checks(politician_slug);
CREATE INDEX IF NOT EXISTS idx_fact_checks_rating ON fact_checks(rating);
