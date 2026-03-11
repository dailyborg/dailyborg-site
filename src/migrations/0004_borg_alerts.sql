-- User Authentication & Subscriptions (Phase 11)
-- Adding specific politician tracking to the subscribers schema

ALTER TABLE subscribers ADD COLUMN tracked_politicians TEXT DEFAULT '[]';
