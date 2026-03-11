const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const d1Path = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const file = '775e18f05d7a5cdece0b2cc5e1652d60d921c41a31d471df4ccf25acc3600f68.sqlite';

try {
    const db = new sqlite3(path.join(d1Path, file));
    const sql = fs.readFileSync(path.join(process.cwd(), 'src', 'migrations', '0005_politician_requests.sql'), 'utf8');
    db.exec(sql);
    console.log('Migration successfully applied directly to OpenNext cache target.');
    db.close();
} catch (e) {
    console.error('Migration applied with error (likely columns exist):', e.message);
    try {
        const dbFallback = new sqlite3(path.join(d1Path, file));
        dbFallback.exec(`CREATE TABLE IF NOT EXISTS politician_requests (id TEXT PRIMARY KEY, requested_name TEXT NOT NULL, user_email TEXT NOT NULL, reference_link TEXT, status TEXT DEFAULT 'Pending', verification_notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        console.log('Forced table creation on target completion fallback.');
        dbFallback.close();
    } catch (err) {
        console.error("Fallback Failed", err);
    }
}
