-- Admin Dashboard & Monitoring Integrations (Phase 10)

CREATE TABLE IF NOT EXISTS ingestion_logs (
    id TEXT PRIMARY KEY,
    event_slug TEXT,
    status TEXT, -- 'duplicate', 'inserted', 'error'
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);

-- Alter articles table if not already present
-- SQLite doesn't strictly support "ADD COLUMN IF NOT EXISTS" beautifully natively across all versions
-- but wrangler migrations usually handle ADD COLUMN 
ALTER TABLE articles ADD COLUMN approval_status TEXT DEFAULT 'pending';
