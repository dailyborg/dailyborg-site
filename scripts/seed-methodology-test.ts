import fs from "fs";
import path from "path";
import Database from 'better-sqlite3';

function getLocalDB() {
    const d1Dir = path.join(process.cwd(), "workers", "ingest", ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
    const files = fs.readdirSync(d1Dir)
        .filter(f => f.endsWith(".sqlite"))
        .map(name => ({ name, time: fs.statSync(path.join(d1Dir, name)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
    const sqlitePath = path.join(d1Dir, files[0].name);
    return new Database(sqlitePath);
}

function runRawSQL(db: any, sql: string) {
    try {
        db.exec(sql);
    } catch (err) {
        console.error("SQL Execution Error:", err);
    }
}

async function seedDeterministically() {
    console.log("🌱 Starting Deterministic Methodology Seeding...");
    const db = getLocalDB();

    // 1. Clear testing data
    runRawSQL(db, `DELETE FROM methodology_versions; DELETE FROM positions; DELETE FROM promises; DELETE FROM politicians WHERE slug = 'eleanor-vance';`);

    // 2. Insert Base Politician
    runRawSQL(db, `
        INSERT INTO politicians (id, slug, name, office_held, party, district_state, time_in_office)
        VALUES ('vance-001', 'eleanor-vance', 'Eleanor Vance', 'U.S. Senate', 'Democrat', 'Ohio', '8 Years');
    `);

    // 3. Insert Methodology V1
    runRawSQL(db, `
        INSERT INTO methodology_versions (id, version_name, description, formula, is_active)
        VALUES ('m-v1', 'Public Statements Consistency (v1.0.0)', 'This consistency methodology isolates verified public stances regarding established policy topics over time. It objectively calculates directional contradiction shifts against the total tracked policy ledger.', 'Score = 100 - ((Contradictions * 15) / Distinct Policy Topics)', 1);
    `);

    // 4. Insert Deterministic Promises (4 scored: 3 Fulfilled, 1 Broken, 2 In Progress ignored) -> EXPECTED 75%
    runRawSQL(db, `
        INSERT INTO promises (id, politician_id, promise_text, date_said, issue_area, status, original_statement_url) VALUES 
        ('pr-1', 'vance-001', 'Expand broadband access to rural Ohio', '2024-03-01', 'Infrastructure', 'Fulfilled', 'https://example.com/pr1'),
        ('pr-2', 'vance-001', 'Reject PAC money for re-election campaign', '2022-10-15', 'Campaign Finance', 'Broken', 'https://example.com/pr2'),
        ('pr-3', 'vance-001', 'Cap prescription drug costs at $35/month', '2024-05-10', 'Healthcare', 'Fulfilled', 'https://example.com/pr3'),
        ('pr-4', 'vance-001', 'Sponsor the new EPA enforcement budget', '2023-01-20', 'Environment', 'Fulfilled', 'https://example.com/pr4'),
        ('pr-5', 'vance-001', 'Draft new protections for gig economy workers', '2025-06-01', 'Labor', 'In Progress', 'https://example.com/pr5'),
        ('pr-6', 'vance-001', 'Audit the existing federal highway fund distribution', '2025-09-12', 'Infrastructure', 'In Progress', 'https://example.com/pr6');
    `);

    // 5. Insert Deterministic Positions
    // TOPIC A: Corporate Tax Rate (Strongly Support -> Oppose) [Distance 3, Contradiction]
    runRawSQL(db, `
        INSERT INTO positions (id, politician_id, topic, stance, statement_date, source_excerpt) VALUES 
        ('pos-1', 'vance-001', 'Corporate Tax Rate Adjustment', 'Strongly Support', '2024-01-15', 'We must drastically raise corporate taxes to balance the budget.'),
        ('pos-2', 'vance-001', 'Corporate Tax Rate Adjustment', 'Oppose', '2026-02-10', 'A tax hike now would crush local business growth, I cannot support this.');
    `);

    // TOPIC B: Tech Antitrust Breakup (Support -> Strongly Support) [Distance 1, Evolved]
    runRawSQL(db, `
        INSERT INTO positions (id, politician_id, topic, stance, statement_date, source_excerpt) VALUES 
        ('pos-3', 'vance-001', 'Big Tech Antitrust Measures', 'Support', '2024-06-20', 'I believe we need to look into tech monopolies.'),
        ('pos-4', 'vance-001', 'Big Tech Antitrust Measures', 'Strongly Support', '2025-11-05', 'The time for looking is over. We must forcefully break them up today.');
    `);

    // TOPIC C: Farm Subsidies (Support) [Single Statement -> Ignored from Denominator]
    runRawSQL(db, `
        INSERT INTO positions (id, politician_id, topic, stance, statement_date, source_excerpt) VALUES 
        ('pos-5', 'vance-001', 'Federal Farm Subsidies', 'Support', '2024-08-11', 'Our farmers need to be protected.');
    `);

    console.log("✅ Database seeded deterministically.");
    console.log("EXPECTED PROMISE OUTPUTS: 3 Fulfilled, 1 Broken => 75%");
    console.log("EXPECTED CONSISTENCY OUTPUTS: 2 Eligible Topics, 1 Contradiction (Penalty 15), 1 Evolution => Score 92.5 => 93");
    console.log("Run the service test script to verify.");
}

seedDeterministically();
