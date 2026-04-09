-- Entities & People
CREATE TABLE IF NOT EXISTS politicians (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    photo_url TEXT,
    office_held TEXT,
    party TEXT,
    district_state TEXT,
    time_in_office TEXT,
    country TEXT DEFAULT 'US',
    region_level TEXT DEFAULT 'Federal',
    candidate_status TEXT DEFAULT 'Active', -- Active, Candidate, Former
    trustworthiness_score INTEGER DEFAULT NULL,
    promises_kept INTEGER DEFAULT 0,
    promises_broken INTEGER DEFAULT 0,
    promises_total INTEGER DEFAULT 0,
    popularity_score INTEGER DEFAULT 0,
    last_scored_at TIMESTAMP,
    latest_sync_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trustworthiness Score History (for time-series charts)
CREATE TABLE IF NOT EXISTS trustworthiness_history (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    promises_kept INTEGER DEFAULT 0,
    promises_broken INTEGER DEFAULT 0,
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);
CREATE INDEX IF NOT EXISTS idx_trust_history_politician ON trustworthiness_history(politician_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_date ON trustworthiness_history(scored_at);

CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    bill_id TEXT,
    vote_date TEXT,
    title TEXT,
    result TEXT,
    url TEXT
);

CREATE TABLE IF NOT EXISTS politician_votes (
    politician_id TEXT,
    vote_id TEXT,
    position TEXT,
    rationale TEXT,
    PRIMARY KEY (politician_id, vote_id),
    FOREIGN KEY (politician_id) REFERENCES politicians(id),
    FOREIGN KEY (vote_id) REFERENCES votes(id)
);

CREATE TABLE IF NOT EXISTS committees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS politician_committees (
    politician_id TEXT,
    committee_id TEXT,
    PRIMARY KEY (politician_id, committee_id),
    FOREIGN KEY (politician_id) REFERENCES politicians(id),
    FOREIGN KEY (committee_id) REFERENCES committees(id)
);

-- The Public Record
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    official_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    policy_topic TEXT,
    status TEXT,
    became_law BOOLEAN DEFAULT 0,
    url TEXT
);

CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    bill_id TEXT,
    vote_date TEXT,
    title TEXT,
    result TEXT,
    url TEXT,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS politician_votes (
    politician_id TEXT,
    vote_id TEXT,
    position TEXT,
    rationale TEXT,
    PRIMARY KEY (politician_id, vote_id),
    FOREIGN KEY (politician_id) REFERENCES politicians(id),
    FOREIGN KEY (vote_id) REFERENCES votes(id)
);

CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    politician_id TEXT,
    statement_date TEXT,
    content TEXT NOT NULL,
    source_url TEXT,
    tags TEXT,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    politician_id TEXT,
    topic TEXT,
    stance TEXT,
    statement_date TEXT,
    source_url TEXT,
    source_excerpt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);

CREATE TABLE IF NOT EXISTS promises (
    id TEXT PRIMARY KEY,
    politician_id TEXT,
    promise_text TEXT NOT NULL,
    date_said TEXT,
    source_url TEXT,
    issue_area TEXT,
    status TEXT, -- Fulfilled, Broken, In Progress, Reversed
    status_source TEXT,
    status_date TEXT,
    notes TEXT,
    methodology_note TEXT,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);

CREATE TABLE IF NOT EXISTS methodology_versions (
    id TEXT PRIMARY KEY,
    version_name TEXT,
    description TEXT,
    formula TEXT,
    is_active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_id);
CREATE INDEX IF NOT EXISTS idx_positions_politician ON positions(politician_id);
CREATE INDEX IF NOT EXISTS idx_positions_topic ON positions(topic);

-- Newsroom & Articles
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


CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content_html TEXT NOT NULL,
    author_id TEXT,
    read_time INTEGER,
    article_type TEXT,
    confidence_score INTEGER,
    publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    desk TEXT,
    hero_image_url TEXT,
    social_published BOOLEAN DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE INDEX IF NOT EXISTS idx_articles_social_published ON articles(social_published);

CREATE TABLE IF NOT EXISTS article_sources (
    id TEXT PRIMARY KEY,
    article_id TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT,
    source_type TEXT,
    trust_level INTEGER,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE IF NOT EXISTS article_entities (
    article_id TEXT,
    entity_id TEXT,
    entity_type TEXT, -- "politician" or "bill"
    PRIMARY KEY (article_id, entity_id, entity_type),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

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

-- Verification Engine Schema Additions

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Fact', 'Promise', 'Opinion'
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    context TEXT, -- e.g. "Town Hall May 2024"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    url TEXT NOT NULL,
    archive_url TEXT, -- Link to Wayback Machine or R2 snapshot
    source_name TEXT NOT NULL,
    trust_score INTEGER DEFAULT 0, -- 0-100 scale indicating source reliability
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
);

CREATE TABLE IF NOT EXISTS stance_changes (
    id TEXT PRIMARY KEY,
    politician_id TEXT NOT NULL,
    old_claim_id TEXT NOT NULL,
    new_claim_id TEXT NOT NULL,
    topic TEXT NOT NULL, -- e.g. "Universal Healthcare", "Border Wall"
    shift_description TEXT, -- AI-generated description of the change
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (politician_id) REFERENCES politicians(id),
    FOREIGN KEY (old_claim_id) REFERENCES claims(id),
    FOREIGN KEY (new_claim_id) REFERENCES claims(id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_claims_politician ON claims(politician_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_stance_changes_politician ON stance_changes(politician_id);
CREATE INDEX IF NOT EXISTS idx_stance_changes_topic ON stance_changes(topic);

-- Politician Request Engine
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

CREATE INDEX IF NOT EXISTS idx_requests_status ON politician_requests(status);
CREATE INDEX IF NOT EXISTS idx_politicians_country ON politicians(country);

-- Subscriber preferences mapping
CREATE TABLE IF NOT EXISTS subscriber_politicians (
    subscriber_id TEXT,
    politician_id TEXT,
    pinned BOOLEAN DEFAULT 0, -- Indicates if the dashboard should prioritize this local rep
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscriber_id, politician_id),
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(id),
    FOREIGN KEY (politician_id) REFERENCES politicians(id)
);
