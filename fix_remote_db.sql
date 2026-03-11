CREATE TABLE IF NOT EXISTS ingestion_logs (
    id TEXT PRIMARY KEY,
    event_slug TEXT,
    status TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);

-- Wrapped in try/catch-like behavior by ignoring if it fails (SQLite doesn't natively support ADD COLUMN IF NOT EXISTS easily)
ALTER TABLE articles ADD COLUMN approval_status TEXT DEFAULT 'pending';
ALTER TABLE subscribers ADD COLUMN tracked_politicians TEXT DEFAULT '[]';
