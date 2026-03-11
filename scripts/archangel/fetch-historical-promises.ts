// scripts/archangel/fetch-historical-promises.ts
// PROJECT ARCHANGEL - Bulk Historical Ingestion Pipeline for Promises
import 'dotenv/config';
import sqlite3 from 'better-sqlite3';
import fs from 'fs';
import { resolve } from 'path';

// Find the active D1 sqlite file dumped by Wrangler v3
const DB_DIR = resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files = fs.readdirSync(DB_DIR);
const sqliteFile = files.find(f => f.endsWith('.sqlite') && !f.includes('-wal') && !f.includes('-shm'));

if (!sqliteFile) {
    throw new Error(`Could not find a .sqlite database in ${DB_DIR}. Are you sure Wrangler is running or initialized?`);
}

const DB_PATH = resolve(DB_DIR, sqliteFile);

try {
    const db = new sqlite3(DB_PATH);
    console.log(`[Archangel] Connected to Local Dev D1 at: ${DB_PATH}`);

    async function runPromisesArchangel() {
        console.log("=========================================");
        console.log("   PROJECT ARCHANGEL: PROMISES PIPELINE");
        console.log("=========================================");

        // Historical promises are often scraped from archives like PolitiFact or the Wayback Machine.
        // For this local execution, we are seeding mathematical examples of famous past campaign promises.

        const mockHistoricalPromises = [
            {
                promise_id: 'promise-obama-gitmo',
                politician_id: 'pid-obama',
                promise_text: 'Close the Guantanamo Bay detention camp.',
                issue_area: 'National Security',
                date_said: '2008-08-01',
                source_url: 'https://obamawhitehouse.archives.gov',
                status: 'Broken',
                methodology_note: 'Executive order signed, but Congress blocked funding for prisoner transfer. Facility remained open.'
            },
            {
                promise_id: 'promise-obama-bin-laden',
                politician_id: 'pid-obama',
                promise_text: 'Kill or capture Osama bin Laden.',
                issue_area: 'Defense',
                date_said: '2008-10-07',
                source_url: 'https://obamawhitehouse.archives.gov',
                status: 'Fulfilled',
                methodology_note: 'Bin Laden was killed in a military operation in Abbottabad, Pakistan in May 2011.'
            },
            {
                promise_id: 'promise-bush-taxes',
                politician_id: 'pid-bush',
                promise_text: 'Read my lips: no new taxes (Pledge inherited / replicated by Jr in form of 2001 Tax Cuts). Implement massive across-the-board tax cuts.',
                issue_area: 'Economy',
                date_said: '2000-08-03',
                source_url: 'https://georgewbush-whitehouse.archives.gov',
                status: 'Fulfilled',
                methodology_note: 'Passed the Economic Growth and Tax Relief Reconciliation Act of 2001.'
            },
            {
                promise_id: 'promise-biden-student-debt',
                politician_id: 'pid-biden',
                promise_text: 'Forgive a minimum of $10,000 per person of federal student loans.',
                issue_area: 'Education',
                date_said: '2020-03-22',
                source_url: 'https://joebiden.com',
                status: 'In Progress',
                methodology_note: 'Original broad executive action was struck down by the Supreme Court; administration is currently pursuing targeted relief through other HEA mechanisms.'
            }
        ];

        let insertedPromises = 0;
        const insertPromiseStmt = db.prepare(`
            INSERT INTO promises (id, politician_id, promise_text, date_said, source_url, issue_area, status, methodology_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET status=excluded.status, methodology_note=excluded.methodology_note
        `);

        // Execute transactions securely
        const pushPromises = db.transaction((promises) => {
            for (const p of promises) {
                insertPromiseStmt.run(
                    p.promise_id, p.politician_id, p.promise_text, p.date_said,
                    p.source_url, p.issue_area, p.status, p.methodology_note
                );
                insertedPromises++;
            }
        });

        pushPromises(mockHistoricalPromises);

        console.log(`[Archangel] ✅ Successfully injected ${insertedPromises} famous historical campaign promises.`);
        console.log(`[Archangel] Consistency Indexes for Obama, Bush, and Biden will now automatically calculate on the frontend.`);
        db.close();
    }

    runPromisesArchangel();

} catch (error) {
    console.error("[Archangel] Critical failure connecting to local D1:", error);
}
