-- Migration 0005: Politician Requests & Global Architecture

-- 1. Add Global Architecture (US Umbrella) taxonomy to the core politicians table
ALTER TABLE politicians ADD COLUMN country TEXT DEFAULT 'US';
ALTER TABLE politicians ADD COLUMN region_level TEXT DEFAULT 'Federal';

-- 2. Create the Politician Request Engine queue
CREATE TABLE IF NOT EXISTS politician_requests (
    id TEXT PRIMARY KEY,
    requested_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    reference_link TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Verified, Rejected, Generated
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_requests_status ON politician_requests(status);
CREATE INDEX IF NOT EXISTS idx_politicians_country ON politicians(country);
