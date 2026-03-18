import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function POST() {
    const results: string[] = [];
    const errors: string[] = [];

    try {
        const db = await getDbBinding();

        // ========== PHASE 1: CREATE ALL TABLES ==========
        const tableStatements = [
            `CREATE TABLE IF NOT EXISTS politicians (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, photo_url TEXT, office_held TEXT, party TEXT, district_state TEXT, time_in_office TEXT, country TEXT DEFAULT 'US', region_level TEXT DEFAULT 'Federal', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS promises (id TEXT PRIMARY KEY, politician_id TEXT, promise_text TEXT NOT NULL, date_said TEXT, source_url TEXT, issue_area TEXT, status TEXT, original_statement_url TEXT, original_statement_date TEXT, status_source TEXT, status_date TEXT, notes TEXT, methodology_note TEXT, FOREIGN KEY (politician_id) REFERENCES politicians(id))`,
            `CREATE TABLE IF NOT EXISTS positions (id TEXT PRIMARY KEY, politician_id TEXT, topic TEXT, stance TEXT, statement_date TEXT, source_url TEXT, source_excerpt TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (politician_id) REFERENCES politicians(id))`,
            `CREATE TABLE IF NOT EXISTS methodology_versions (id TEXT PRIMARY KEY, version_name TEXT, description TEXT, formula TEXT, is_active BOOLEAN DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, excerpt TEXT, content_html TEXT NOT NULL, read_time INTEGER, article_type TEXT, confidence_score INTEGER, publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, desk TEXT, hero_image_url TEXT, social_published BOOLEAN DEFAULT 0, approval_status TEXT DEFAULT 'pending')`,
            `CREATE TABLE IF NOT EXISTS article_sources (id TEXT PRIMARY KEY, article_id TEXT, source_name TEXT NOT NULL, source_url TEXT, source_type TEXT, trust_level INTEGER, FOREIGN KEY (article_id) REFERENCES articles(id))`,
            `CREATE TABLE IF NOT EXISTS subscribers (id TEXT PRIMARY KEY, email TEXT UNIQUE, phone_number TEXT UNIQUE, plan_type TEXT DEFAULT 'free', delivery_channel TEXT DEFAULT 'email', frequency TEXT DEFAULT 'daily', topics TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, stripe_status TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, politician_id TEXT, type TEXT NOT NULL, content TEXT NOT NULL, date TEXT NOT NULL, context TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, url TEXT NOT NULL, archive_url TEXT, source_name TEXT NOT NULL, trust_score INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (claim_id) REFERENCES claims(id))`,
            `CREATE TABLE IF NOT EXISTS stance_changes (id TEXT PRIMARY KEY, politician_id TEXT NOT NULL, old_claim_id TEXT NOT NULL, new_claim_id TEXT NOT NULL, topic TEXT NOT NULL, shift_description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS ingestion_logs (id TEXT PRIMARY KEY, event_slug TEXT, status TEXT, message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS politician_requests (id TEXT PRIMARY KEY, requested_name TEXT NOT NULL, user_email TEXT NOT NULL, reference_link TEXT, status TEXT DEFAULT 'Pending', verification_notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_id)`,
            `CREATE INDEX IF NOT EXISTS idx_claims_politician ON claims(politician_id)`,
            `CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id)`,
            `CREATE INDEX IF NOT EXISTS idx_articles_social_published ON articles(social_published)`,
            `CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_requests_status ON politician_requests(status)`,
        ];

        for (let i = 0; i < tableStatements.length; i++) {
            try { await db.prepare(tableStatements[i]).run(); } catch (e: any) { errors.push(`T${i}: ${e.message}`); }
        }
        results.push(`Tables: ${tableStatements.length} run, ${errors.length} errors`);

        // ========== PHASE 2: SEED DATA ==========
        // Methodology
        try {
            await db.prepare(`INSERT OR IGNORE INTO methodology_versions (id, version_name, description, formula, is_active) VALUES (?, ?, ?, ?, 1)`)
                .bind('mv_prod_v1', 'v1.4 Baseline', 'Positional contradiction detection algorithm.', 'Score = MAX(0, 100 - ((Contradictions * 15) / Topics))').run();
            results.push('Methodology seeded');
        } catch (e: any) { errors.push(`Methodology: ${e.message}`); }

        // Politicians
        const pols = [
            ['pol_001', 'senator-vance', 'Eleanor Vance', 'U.S. Senate', 'Democrat', 'OH', '4 Years'],
            ['pol_002', 'rep-martinez', 'Carlos Martinez', 'U.S. House', 'Republican', 'TX-23', '6 Years'],
            ['pol_003', 'senator-okafor', 'Amara Okafor', 'U.S. Senate', 'Democrat', 'GA', '2 Years'],
            ['pol_004', 'governor-chen', 'David Chen', 'Governor', 'Independent', 'WA', '3 Years'],
        ];
        for (const [id, slug, name, office, party, state, time] of pols) {
            try {
                await db.prepare(`INSERT OR IGNORE INTO politicians (id, slug, name, office_held, party, district_state, time_in_office) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, slug, name, office, party, state, time).run();
            } catch (e: any) { errors.push(`Pol ${id}: ${e.message}`); }
        }
        results.push(`Politicians: ${pols.length} seeded`);

        // Promises
        try {
            await db.prepare(`INSERT OR IGNORE INTO promises (id, politician_id, promise_text, date_said, issue_area, status) VALUES (?, ?, ?, ?, ?, ?)`).bind('p_1', 'pol_001', 'Codify metadata guidelines into federal law', '2022-10-14', 'Tech Policy', 'In Progress').run();
            await db.prepare(`INSERT OR IGNORE INTO promises (id, politician_id, promise_text, date_said, issue_area, status) VALUES (?, ?, ?, ?, ?, ?)`).bind('p_2', 'pol_001', 'Lower corporate tax rates for small syndicates', '2023-01-11', 'Economy', 'Broken').run();
            await db.prepare(`INSERT OR IGNORE INTO promises (id, politician_id, promise_text, date_said, issue_area, status) VALUES (?, ?, ?, ?, ?, ?)`).bind('p_3', 'pol_001', 'Increase funding for algorithmic deployments', '2023-04-05', 'Infrastructure', 'Fulfilled').run();
            results.push('Promises seeded');
        } catch (e: any) { errors.push(`Promises: ${e.message}`); }

        // Articles
        const articles = [
            ['art_001', 'senate-appropriations-clashes-defense', 'Senate Appropriations Committee Clashes Over Defense Budget', 'Deep partisan divides on modernization priorities.', '<p>Washington — The Senate Appropriations Committee heard testimony on autonomous maritime systems.</p>', 'Politics', 'analysis', 7, 94],
            ['art_002', 'cybercrime-ring-dismantled-12-countries', 'Major Cybercrime Ring Dismantled in 12-Country Operation', 'Law enforcement arrested 47 suspects in coordinated takedown.', '<p>A coordinated operation spanning 12 countries dismantled a prolific ransomware network.</p>', 'Crime', 'breaking', 5, 97],
            ['art_003', 'market-recovers-cpi-data', 'Market Recovers Sharply Following CPI Data Release', 'Core inflation met expectations, cooling rate hike fears.', '<p>Markets surged following CPI data showing core inflation at 3.1%.</p>', 'Business', 'analysis', 4, 91],
            ['art_004', 'indie-studio-sweeps-film-festival', 'Independent Studio Sweeps International Film Festival', 'Psychological thriller wins Best Picture in historic upset.', '<p>Independent studio Meridian Films swept major categories at Toronto Film Festival.</p>', 'Entertainment', 'feature', 6, 88],
            ['art_005', 'nasa-artemis-iv-lunar-gateway', 'NASA Artemis IV Deploys Lunar Gateway Module', 'First habitable module enters lunar orbit.', '<p>NASA confirmed successful deployment of the Lunar Gateway PPE module.</p>', 'Science', 'breaking', 5, 99],
            ['art_006', 'bipartisan-privacy-legislation', 'Bipartisan Coalition Proposes Sweeping Privacy Bill', 'Draft bill unifies state patchwork into federal framework.', '<p>A bipartisan coalition unveiled the American Data Privacy Act.</p>', 'Politics', 'analysis', 6, 92],
            ['art_007', 'underdog-championship-overtime', 'Underdog Franchise Wins Championship in Overtime', 'Buzzer-beater three-pointer secures first title in 30 years.', '<p>The underdog franchise secured their first championship in 30 years.</p>', 'Sports', 'breaking', 4, 96],
            ['art_008', 'stem-curriculum-overhaul', 'National Board Overhauls STEM Curriculum Standards', 'New guidelines emphasize computational thinking over rote learning.', '<p>The Education Standards Board announced a comprehensive STEM curriculum overhaul.</p>', 'Education', 'analysis', 8, 90],
        ];

        for (const [id, slug, title, excerpt, html, desk, type, time, score] of articles) {
            try {
                await db.prepare(`INSERT OR IGNORE INTO articles (id, slug, title, excerpt, content_html, desk, article_type, read_time, confidence_score, approval_status, publish_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`)
                    .bind(id, slug, title, excerpt, html, desk, type, time, score).run();
            } catch (e: any) { errors.push(`Art ${id}: ${e.message}`); }
        }
        results.push(`Articles: ${articles.length} seeded`);

        return NextResponse.json({ success: true, results, errors });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack, results, errors }, { status: 500 });
    }
}
