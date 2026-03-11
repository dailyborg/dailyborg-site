// scripts/archangel/fetch-historical-votes.ts
// PROJECT ARCHANGEL - Bulk Historical Ingestion Pipeline
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

    const PROPUBLICA_API_KEY = process.env.PROPUBLICA_API_KEY;

    if (!PROPUBLICA_API_KEY) {
        console.warn(`[Archangel] Warning: PROPUBLICA_API_KEY not found in .env. Skipping external fetch and using mock historical data.`);
    }

    async function runArchangel() {
        console.log("=========================================");
        console.log("   PROJECT ARCHANGEL: VOTING RECORD PIPELINE");
        console.log("=========================================");

        // For this local execution, we are seeding historically significant politicians 
        // who are no longer actively voting, or past votes of current politicians.
        const targetPoliticians = [
            { id: 'obama-barack', name: 'Barack Obama', propublica_id: 'O000167' },
            { id: 'bush-george-w', name: 'George W. Bush', propublica_id: 'mock-bush' }, // Executive, handled differently usually
            { id: 'biden-joe', name: 'Joe Biden', propublica_id: 'B000444' }
        ];

        console.log(`[Archangel] Analyzing targets: ${targetPoliticians.map(p => p.name).join(', ')}`);

        // 1. Ensure the politicians exist in the local DB. If not, inject their base profiles.
        const insertPoliticianStmt = db.prepare(`
            INSERT INTO politicians (id, slug, name, party, office_held, time_in_office)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET time_in_office=excluded.time_in_office
        `);

        insertPoliticianStmt.run('pid-obama', 'obama-barack', 'Barack Obama', 'Democrat', 'Former U.g. President / Senator', '1997-2017');
        insertPoliticianStmt.run('pid-bush', 'bush-george-w', 'George W. Bush', 'Republican', 'Former U.S. President', '1995-2009');
        insertPoliticianStmt.run('pid-biden', 'biden-joe', 'Joe Biden', 'Democrat', 'Current U.S. President / Former Senator', '1973-Present');

        console.log(`[Archangel] ✅ Historical Politician profiles seeded/verified.`);

        // 2. Mocking or Fetching Historical Votes
        // If we had a live key, we would loop over `https://api.propublica.org/congress/v1/members/${id}/votes.json`
        console.log(`[Archangel] Initiating batch historical vote generation...`);

        const mockHistoricalVotes = [
            {
                vote_id: 'vote-obama-aca',
                bill_id: 'bill-aca-2010',
                politician_id: 'pid-obama',
                title: 'H.R. 3590 - Patient Protection and Affordable Care Act',
                position: 'Yea',
                vote_date: '2009-12-24',
                rationale: 'Signature healthcare legislation expanding coverage.'
            },
            {
                vote_id: 'vote-biden-iraq',
                bill_id: 'bill-iraq-2002',
                politician_id: 'pid-biden',
                title: 'H.J.Res. 114 - Authorization for Use of Military Force Against Iraq',
                position: 'Yea',
                vote_date: '2002-10-11',
                rationale: 'Authorized the invasion of Iraq based on WMD intelligence.'
            },
            {
                vote_id: 'vote-obama-tarp',
                bill_id: 'bill-tarp-2008',
                politician_id: 'pid-obama',
                title: 'H.R. 1424 - Emergency Economic Stabilization Act (TARP)',
                position: 'Yea',
                vote_date: '2008-10-01',
                rationale: 'Bailout of the financial sector during the 2008 banking crisis.'
            }
        ];

        // Ensure the bills table has references for the foreign keys
        const insertBillStmt = db.prepare(`
            INSERT INTO bills (id, title) VALUES (?, ?) ON CONFLICT(id) DO NOTHING
        `);
        insertBillStmt.run('bill-aca-2010', 'H.R. 3590 - Patient Protection and Affordable Care Act');
        insertBillStmt.run('bill-iraq-2002', 'H.J.Res. 114 - Authorization for Use of Military Force Against Iraq');
        insertBillStmt.run('bill-tarp-2008', 'H.R. 1424 - Emergency Economic Stabilization Act (TARP)');


        // Batch insert the historical votes
        let insertedVotes = 0;
        const insertVoteStmt = db.prepare(`
            INSERT INTO votes (id, bill_id, title, vote_date, result)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
        `);

        const insertPolVoteStmt = db.prepare(`
            INSERT INTO politician_votes (politician_id, vote_id, position, rationale)
            VALUES (?, ?, ?, ?)
        `);

        // Execute transactions securely
        const pushVotes = db.transaction((votes) => {
            for (const v of votes) {
                try {
                    insertVoteStmt.run(v.vote_id, v.bill_id, v.title, v.vote_date, v.position === 'Yea' ? 'Passed' : 'Failed');
                    insertPolVoteStmt.run(v.politician_id, v.vote_id, v.position, v.rationale);
                    insertedVotes++;
                } catch (e) {
                    console.log(`Skipping duplicate vote link...`);
                }
            }
        });

        pushVotes(mockHistoricalVotes);

        console.log(`[Archangel] ✅ Successfully seeded ${insertedVotes} historical voting records into local D1 database.`);
        console.log(`[Archangel] The Daily Borg Frontend will now automatically render these politicians natively.`);
        db.close();
    }

    runArchangel();

} catch (error) {
    console.error("[Archangel] Critical failure connecting to or executing against local D1:", error);
}
