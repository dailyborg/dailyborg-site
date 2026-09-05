-- Up
CREATE TABLE IF NOT EXISTS site_visits (
    id TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    path TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_visits_ip_date ON site_visits(ip_hash, created_at);

-- (The original file had a '-- Down' section here that dropped the table it had just created.
--  It was removed on 2026-09-05 because wrangler runs the whole file.)
