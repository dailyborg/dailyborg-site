-- Migration 0006: Add Authors table for Google News compliance
CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    bio TEXT,
    email TEXT,
    avatar_url TEXT,
    twitter_handle TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: SQLite does not support adding FOREIGN KEY constraints to existing tables via ALTER TABLE easily.
-- We will just add the column for now. The foreign key constraint is enforced in the app logic and future inserts.
ALTER TABLE articles ADD COLUMN author_id TEXT;
