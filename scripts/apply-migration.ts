import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

function applyMigration() {
    const d1Dir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
    if (!fs.existsSync(d1Dir)) {
        console.error("Local D1 folder not found", d1Dir);
        return;
    }

    const files = fs.readdirSync(d1Dir)
        .filter(f => f.endsWith('.sqlite'))
        .sort((a, b) => fs.statSync(path.join(d1Dir, b)).mtime.getTime() - fs.statSync(path.join(d1Dir, a)).mtime.getTime());

    if (files.length === 0) {
        console.error("No SQLite database found in", d1Dir);
        return;
    }

    const dbPath = path.join(d1Dir, files[0]);
    console.log("Applying to:", dbPath);
    const db = new Database(dbPath);

    const migrationsDir = path.join(process.cwd(), 'src', 'migrations');
    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const sqlFile of sqlFiles) {
        console.log(`\nExecuting ${sqlFile}...`);
        const sqlPath = path.join(migrationsDir, sqlFile);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        let applied = 0;
        for (const stmt of statements) {
            try {
                db.exec(stmt);
                applied++;
            } catch (e: any) {
                // If it's an "already exists" error, we can ignore it since we don't track migration state deeply locally.
                console.log(`  Skipped statement in ${sqlFile} (likely already exists):`, e.message);
            }
        }
        console.log(`  Successfully executed ${applied} / ${statements.length} fragments in ${sqlFile}.`);
    }
}

applyMigration();
