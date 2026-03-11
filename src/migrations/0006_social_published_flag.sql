ALTER TABLE articles ADD COLUMN social_published BOOLEAN DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_articles_social_published ON articles(social_published);
