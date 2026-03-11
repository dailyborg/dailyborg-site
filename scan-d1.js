const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const d1Path = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

const files = fs.readdirSync(d1Path).filter(f => f.endsWith('.sqlite') && !f.includes('-'));

console.log("Found SQLite files:");
for (const f of files) {
    try {
        const db = new sqlite3(path.join(d1Path, f));
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        console.log(`- ${f}: [${tables.join(', ')}]`);
        db.close();
    } catch (e) {
        console.error(`Error reading ${f}: ${e.message}`);
    }
}
