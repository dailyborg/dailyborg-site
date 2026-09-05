-- Up
DROP TABLE IF EXISTS subscriptions;

CREATE TABLE IF NOT EXISTS subscribers (
    id TEXT PRIMARY KEY, -- Moving from INTEGER to UUID for secure auth/Stripe mapping
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE, -- For WhatsApp delivery
    
    -- Subscriptions Preferences
    plan_type TEXT DEFAULT 'free', -- 'free' or 'paid'
    delivery_channel TEXT DEFAULT 'email', -- 'email' or 'whatsapp'
    frequency TEXT DEFAULT 'daily', -- 'daily' or 'weekly'
    topics TEXT, -- JSON array of selected categories (e.g., ["Entertainment", "Crime", "Education"])
    
    -- Stripe Integration (Future Groundwork)
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_status TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- (The original file had a '-- Down' section here that dropped the table it had just created.
--  It was removed on 2026-09-05 because wrangler runs the whole file.)
