import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// One-time setup endpoint — creates tables and seeds initial content.
// DELETE THIS FILE after initial setup is complete.
export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { env } = getRequestContext();
        const db = (env as any).DB;

        if (!db) {
            return NextResponse.json({ error: "DB binding not found" }, { status: 500 });
        }

        const results: string[] = [];

        // ========== PHASE 1: CREATE ALL TABLES ==========
        const tableStatements = [
            // Politicians
            `CREATE TABLE IF NOT EXISTS politicians (
                id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
                photo_url TEXT, office_held TEXT, party TEXT, district_state TEXT,
                time_in_office TEXT, country TEXT DEFAULT 'US', region_level TEXT DEFAULT 'Federal',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Promises
            `CREATE TABLE IF NOT EXISTS promises (
                id TEXT PRIMARY KEY, politician_id TEXT, promise_text TEXT NOT NULL,
                date_said TEXT, source_url TEXT, issue_area TEXT, status TEXT,
                original_statement_url TEXT, original_statement_date TEXT,
                status_source TEXT, status_date TEXT, notes TEXT, methodology_note TEXT,
                FOREIGN KEY (politician_id) REFERENCES politicians(id)
            )`,
            // Positions
            `CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY, politician_id TEXT, topic TEXT, stance TEXT,
                statement_date TEXT, source_url TEXT, source_excerpt TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (politician_id) REFERENCES politicians(id)
            )`,
            // Methodology versions
            `CREATE TABLE IF NOT EXISTS methodology_versions (
                id TEXT PRIMARY KEY, version_name TEXT, description TEXT, formula TEXT,
                is_active BOOLEAN DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Articles (the homepage content)
            `CREATE TABLE IF NOT EXISTS articles (
                id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
                excerpt TEXT, content_html TEXT NOT NULL, read_time INTEGER,
                article_type TEXT, confidence_score INTEGER,
                publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                desk TEXT, hero_image_url TEXT, social_published BOOLEAN DEFAULT 0,
                approval_status TEXT DEFAULT 'pending'
            )`,
            // Article sources
            `CREATE TABLE IF NOT EXISTS article_sources (
                id TEXT PRIMARY KEY, article_id TEXT, source_name TEXT NOT NULL,
                source_url TEXT, source_type TEXT, trust_level INTEGER,
                FOREIGN KEY (article_id) REFERENCES articles(id)
            )`,
            // Subscribers
            `CREATE TABLE IF NOT EXISTS subscribers (
                id TEXT PRIMARY KEY, email TEXT UNIQUE, phone_number TEXT UNIQUE,
                plan_type TEXT DEFAULT 'free', delivery_channel TEXT DEFAULT 'email',
                frequency TEXT DEFAULT 'daily', topics TEXT, tracked_politicians TEXT DEFAULT '[]',
                stripe_customer_id TEXT, stripe_subscription_id TEXT, stripe_status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Claims (Verification Engine)
            `CREATE TABLE IF NOT EXISTS claims (
                id TEXT PRIMARY KEY, politician_id TEXT, type TEXT NOT NULL,
                content TEXT NOT NULL, date TEXT NOT NULL, context TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Evidence
            `CREATE TABLE IF NOT EXISTS evidence (
                id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, url TEXT NOT NULL,
                archive_url TEXT, source_name TEXT NOT NULL,
                trust_score INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (claim_id) REFERENCES claims(id)
            )`,
            // Stance changes
            `CREATE TABLE IF NOT EXISTS stance_changes (
                id TEXT PRIMARY KEY, politician_id TEXT NOT NULL,
                old_claim_id TEXT NOT NULL, new_claim_id TEXT NOT NULL,
                topic TEXT NOT NULL, shift_description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Ingestion logs
            `CREATE TABLE IF NOT EXISTS ingestion_logs (
                id TEXT PRIMARY KEY, event_slug TEXT, status TEXT, message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Politician requests
            `CREATE TABLE IF NOT EXISTS politician_requests (
                id TEXT PRIMARY KEY, requested_name TEXT NOT NULL, user_email TEXT NOT NULL,
                reference_link TEXT, status TEXT DEFAULT 'Pending', verification_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            // Indexes
            `CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_id)`,
            `CREATE INDEX IF NOT EXISTS idx_positions_composite ON positions(politician_id, topic, statement_date DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_claims_politician ON claims(politician_id)`,
            `CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id)`,
            `CREATE INDEX IF NOT EXISTS idx_stance_changes_politician ON stance_changes(politician_id)`,
            `CREATE INDEX IF NOT EXISTS idx_articles_social_published ON articles(social_published)`,
            `CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_requests_status ON politician_requests(status)`,
        ];

        for (const sql of tableStatements) {
            await db.prepare(sql).run();
        }
        results.push(`✅ Created ${tableStatements.length} tables/indexes`);

        // ========== PHASE 2: SEED METHODOLOGY ==========
        await db.prepare(`INSERT OR IGNORE INTO methodology_versions (id, version_name, description, formula, is_active) VALUES (?, ?, ?, ?, 1)`)
            .bind('mv_prod_v1', 'v1.4 — Baseline',
                'Standard algorithmic ingestion weightings for positional contradiction detection. Scores are computed from a combination of promise fulfillment rates and stance consistency over time.',
                'Score = MAX(0, 100 - ((Contradictions × 15) / Eligible Topics))'
            ).run();
        results.push('✅ Seeded methodology version');

        // ========== PHASE 3: SEED POLITICIANS ==========
        const politicians = [
            ['pol_001', 'senator-vance', 'Eleanor Vance', 'U.S. Senate', 'Democrat', 'OH', '4 Years, 2 Months'],
            ['pol_002', 'rep-martinez', 'Carlos Martinez', 'U.S. House', 'Republican', 'TX-23', '6 Years'],
            ['pol_003', 'senator-okafor', 'Amara Okafor', 'U.S. Senate', 'Democrat', 'GA', '2 Years, 8 Months'],
            ['pol_004', 'governor-chen', 'David Chen', 'Governor', 'Independent', 'WA', '3 Years, 5 Months'],
        ];

        for (const [id, slug, name, office, party, state, time] of politicians) {
            await db.prepare(`INSERT OR IGNORE INTO politicians (id, slug, name, office_held, party, district_state, time_in_office) VALUES (?, ?, ?, ?, ?, ?, ?)`)
                .bind(id, slug, name, office, party, state, time).run();
        }
        results.push(`✅ Seeded ${politicians.length} politicians`);

        // Seed promises for Vance
        const promises = [
            ['p_1', 'pol_001', 'Codify structural metadata guidelines into federal law', '2022-10-14', 'Tech Policy', 'In Progress'],
            ['p_2', 'pol_001', 'Lower corporate tax rates for syndicates under $50M revenue', '2023-01-11', 'Economy', 'Broken'],
            ['p_3', 'pol_001', 'Increase funding for national algorithmic deployments', '2023-04-05', 'Infrastructure', 'Fulfilled'],
        ];
        for (const [id, pid, text, date, area, status] of promises) {
            await db.prepare(`INSERT OR IGNORE INTO promises (id, politician_id, promise_text, date_said, issue_area, status) VALUES (?, ?, ?, ?, ?, ?)`)
                .bind(id, pid, text, date, area, status).run();
        }
        results.push('✅ Seeded promises');

        // Seed positions for consistency tracker
        const positions = [
            ['pos_1', 'pol_001', 'Digital Privacy Expansion', 'Support', '2021-11-04', 'Vance stated early support during campaign trail.'],
            ['pos_2', 'pol_001', 'Digital Privacy Expansion', 'Strongly Oppose', '2024-02-15', 'Vance reversed course voting against the 2024 Privacy Act.'],
            ['pos_3', 'pol_001', 'Defense Spending Reduction', 'Neutral', '2022-05-10', 'Refused to take a hard stance on cutting military budget.'],
            ['pos_4', 'pol_001', 'Defense Spending Reduction', 'Support', '2023-09-22', 'Signed a letter backing 5% cuts to standard procurement.'],
        ];
        for (const [id, pid, topic, stance, date, excerpt] of positions) {
            await db.prepare(`INSERT OR IGNORE INTO positions (id, politician_id, topic, stance, statement_date, source_excerpt) VALUES (?, ?, ?, ?, ?, ?)`)
                .bind(id, pid, topic, stance, date, excerpt).run();
        }
        results.push('✅ Seeded positions');

        // ========== PHASE 4: SEED ARTICLES (for homepage) ==========
        const articles = [
            {
                id: 'art_001',
                slug: 'senate-appropriations-clashes-defense-budget',
                title: 'Senate Appropriations Committee Clashes Over Defense Budget Allocations',
                excerpt: 'Hours of testimony revealed deep partisan divides on modernization priorities, with specific focus on maritime autonomous systems and strategic defensive infrastructure.',
                content_html: '<p>Washington — In a session that stretched well past midnight, the Senate Appropriations Committee heard testimony from defense officials and policy analysts on the proposed modernization of autonomous maritime systems. The debate exposed a growing rift between traditional defense hawks and a new coalition pushing for strategic restraint.</p><p>Senator Eleanor Vance (D-OH) led the questioning, pressing witnesses on whether current procurement contracts adequately addressed cybersecurity vulnerabilities in next-generation naval platforms.</p>',
                desk: 'Politics',
                article_type: 'analysis',
                read_time: 7,
                confidence_score: 94,
            },
            {
                id: 'art_002',
                slug: 'major-cybercrime-ring-dismantled-multi-agency',
                title: 'Major Cybercrime Ring Dismantled in Multi-Agency Operation Spanning 12 Countries',
                excerpt: 'Law enforcement agencies across three continents coordinated to arrest 47 suspects tied to a sophisticated ransomware network responsible for hundreds of corporate breaches.',
                content_html: '<p>A coordinated law enforcement operation spanning 12 countries resulted in the dismantling of one of the most prolific ransomware networks in recent history. The operation, codenamed "Operation Iron Web," led to the arrest of 47 suspects and the seizure of over $120 million in cryptocurrency assets.</p><p>Officials say the network was responsible for attacks on more than 300 corporate targets, including critical infrastructure providers in the energy and healthcare sectors.</p>',
                desk: 'Crime',
                article_type: 'breaking',
                read_time: 5,
                confidence_score: 97,
            },
            {
                id: 'art_003',
                slug: 'market-recovers-cpi-data-release',
                title: 'Market Recovers Sharply Following Better-Than-Expected CPI Data Release',
                excerpt: 'Core inflation met expectations, cooling fears of an aggressive rate hike in the upcoming FOMC meeting and sending tech shares to a four-week high.',
                content_html: '<p>Markets surged across the board following the release of Consumer Price Index data that showed core inflation holding steady at 3.1%, in line with analyst expectations. The S&P 500 gained 1.8% on the day, with technology and consumer discretionary sectors leading the advance.</p><p>Federal Reserve watchers interpreted the data as a signal that the central bank may hold rates steady at its upcoming meeting, a relief for investors who had been pricing in a potential 25-basis-point increase.</p>',
                desk: 'Business',
                article_type: 'analysis',
                read_time: 4,
                confidence_score: 91,
            },
            {
                id: 'art_004',
                slug: 'independent-studio-sweeps-film-festival',
                title: 'Independent Studio Sweeps Major Categories at International Film Festival',
                excerpt: 'The psychological thriller captivated judges, securing Best Picture and Best Director in a historic upset against major Hollywood productions.',
                content_html: '<p>In what critics are calling the biggest upset in festival history, independent studio Meridian Films swept the major categories at this year\'s International Film Festival in Toronto. Their psychological thriller "The Weight of Silence" took home Best Picture, Best Director, and Best Original Screenplay.</p><p>The film, made on a budget of $4.2 million, outperformed entries from major studios with budgets exceeding $100 million, sparking renewed conversation about the future of independent cinema.</p>',
                desk: 'Entertainment',
                article_type: 'feature',
                read_time: 6,
                confidence_score: 88,
            },
            {
                id: 'art_005',
                slug: 'nasa-artemis-iv-lunar-gateway-module',
                title: "NASA's Artemis IV Mission Successfully Deploys Lunar Gateway Module",
                excerpt: 'The first habitable module of the Lunar Gateway was deployed into orbit around the Moon, marking a critical milestone in humanity\'s return to deep space exploration.',
                content_html: '<p>NASA confirmed the successful deployment of the Power and Propulsion Element (PPE) of the Lunar Gateway, the first permanent human outpost in lunar orbit. The module, launched aboard a SpaceX Falcon Heavy, entered its target near-rectilinear halo orbit after a four-month transit from Earth.</p><p>The Gateway will serve as a staging point for future crewed missions to the lunar surface and, eventually, as a waypoint for missions to Mars.</p>',
                desk: 'Science',
                article_type: 'breaking',
                read_time: 5,
                confidence_score: 99,
            },
            {
                id: 'art_006',
                slug: 'bipartisan-coalition-sweeping-privacy-legislation',
                title: 'Bipartisan Coalition Proposes Sweeping Privacy Legislation',
                excerpt: 'The draft bill aims to unify state patchwork laws into a cohesive federal framework, establishing baseline data protection standards for all Americans.',
                content_html: '<p>A rare bipartisan coalition in the Senate unveiled the American Data Privacy Act, a comprehensive federal privacy bill that would override the current patchwork of state-level regulations. The legislation establishes baseline data protection rights for consumers, including the right to access, correct, and delete personal data held by companies.</p><p>The bill has the backing of key committee chairs from both parties, giving it a realistic path to a floor vote before the end of the session.</p>',
                desk: 'Politics',
                article_type: 'analysis',
                read_time: 6,
                confidence_score: 92,
            },
            {
                id: 'art_007',
                slug: 'underdog-franchise-championship-overtime',
                title: 'Underdog Franchise Secures Championship Following Dramatic Overtime Victory',
                excerpt: 'In a series that defined the season, the team executed a flawless final play to break the deadlock and secure their first title in three decades.',
                content_html: '<p>In a game that will be remembered for generations, the underdog franchise secured their first championship in 30 years with a dramatic overtime victory. The final score, 114-112, came on a buzzer-beating three-pointer that silenced the opposing crowd and sent fans into a historic celebration.</p><p>The victory caps an improbable run that saw the team overcome a 3-1 series deficit, becoming only the fourth franchise in league history to achieve the comeback.</p>',
                desk: 'Sports',
                article_type: 'breaking',
                read_time: 4,
                confidence_score: 96,
            },
            {
                id: 'art_008',
                slug: 'national-board-stem-curriculum-overhaul',
                title: 'National Board Introduces Comprehensive Overhaul of STEM Curriculum Standards',
                excerpt: 'The new guidelines focus on computational thinking and data literacy, shifting away from rote memorization toward project-based applied learning architectures.',
                content_html: '<p>The National Education Standards Board announced a comprehensive overhaul of STEM curriculum standards for K-12 education, the first major revision in over a decade. The new framework emphasizes computational thinking, data literacy, and project-based learning over traditional rote memorization approaches.</p><p>Education Secretary noted that the reforms are designed to prepare students for an economy increasingly shaped by artificial intelligence and automation.</p>',
                desk: 'Education',
                article_type: 'analysis',
                read_time: 8,
                confidence_score: 90,
            },
        ];

        for (const article of articles) {
            await db.prepare(
                `INSERT OR IGNORE INTO articles (id, slug, title, excerpt, content_html, desk, article_type, read_time, confidence_score, approval_status, publish_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', datetime('now'))`
            ).bind(
                article.id, article.slug, article.title, article.excerpt,
                article.content_html, article.desk, article.article_type,
                article.read_time, article.confidence_score
            ).run();
        }
        results.push(`✅ Seeded ${articles.length} articles with approval_status = 'approved'`);

        // Seed article sources
        const sources = [
            ['src_001', 'art_001', 'Congressional Record', 'https://congress.gov', 'Official', 98],
            ['src_002', 'art_001', 'Reuters Wire', 'https://reuters.com', 'Wire Service', 95],
            ['src_003', 'art_002', 'Europol Official Statement', 'https://europol.europa.eu', 'Official', 99],
            ['src_004', 'art_003', 'Bureau of Labor Statistics', 'https://bls.gov', 'Official', 99],
            ['src_005', 'art_005', 'NASA Press Release', 'https://nasa.gov', 'Official', 100],
        ];
        for (const [id, aid, name, url, type, trust] of sources) {
            await db.prepare(`INSERT OR IGNORE INTO article_sources (id, article_id, source_name, source_url, source_type, trust_level) VALUES (?, ?, ?, ?, ?, ?)`)
                .bind(id, aid, name, url, type, trust).run();
        }
        results.push('✅ Seeded article sources');

        return NextResponse.json({
            success: true,
            message: 'Database setup and seeding complete',
            results
        });

    } catch (error: any) {
        console.error('Seed Error:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
