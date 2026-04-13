-- Migration: 0009_kv_store
-- Purpose: Adds the missing key-value store for background chunking state tracking.

CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
