-- Up
CREATE TABLE IF NOT EXISTS site_visits (
    id TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    path TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_visits_ip_date ON site_visits(ip_hash, created_at);

-- Down
DROP TABLE IF EXISTS site_visits;
