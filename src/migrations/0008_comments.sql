-- Comments System
-- Comments go live instantly; admin can moderate (edit/remove) via dashboard.

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL,
    subscriber_email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    page_type TEXT NOT NULL,
    page_slug TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_type, page_slug);
CREATE INDEX IF NOT EXISTS idx_comments_subscriber ON comments(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
