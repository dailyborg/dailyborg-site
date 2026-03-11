const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const d1Path = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

const files = fs.readdirSync(d1Path)
    .filter(f => f.endsWith('.sqlite') && !f.includes('-wal') && !f.includes('-shm'))
    .map(f => ({ name: f, time: fs.statSync(path.join(d1Path, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

if (files.length === 0) {
    console.error("No SQLite database found.");
    process.exit(1);
}

let activeDbFile = null;
let db = null;

for (const f of files) {
    const tempDb = new sqlite3(path.join(d1Path, f.name));
    try {
        const check = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='politicians'").get();
        if (check) {
            activeDbFile = f.name;
            db = tempDb;
            break;
        } else {
            tempDb.close();
        }
    } catch (e) {
        tempDb.close();
    }
}

if (!activeDbFile || !db) {
    console.error("Could not find the core Daily Borg SQLite database (missing generic politicians table).");
    process.exit(1);
}

console.log(`Verified core DB match: ${activeDbFile}`);
const sql = fs.readFileSync(path.join(process.cwd(), 'src', 'migrations', '0005_politician_requests.sql'), 'utf8');

try {
    db.exec(sql);
    console.log("Migration 0005 successfully applied to the local D1 emulator.");
} catch (e) {
    if (e.message.includes("duplicate column name")) {
        console.log("Migration partially already run (columns exist), creating table if missing...");
        db.exec(`
            CREATE TABLE IF NOT EXISTS politician_requests (
                id TEXT PRIMARY KEY,
                requested_name TEXT NOT NULL,
                user_email TEXT NOT NULL,
                reference_link TEXT,
                status TEXT DEFAULT 'Pending',
                verification_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } else {
        console.error("Migration Failed:", e.message);
    }
}
