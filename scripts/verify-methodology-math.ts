import fs from "fs";
import path from "path";
import Database from 'better-sqlite3';
import { PoliticianService } from "../src/lib/services/politician-service";

async function verify() {
    console.log("🔬 Running Deterministic Math Verification...");

    // Find latest SQLite state db file from wrangler by modification time
    const d1Dir = path.join(process.cwd(), "workers", "ingest", ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
    const files = fs.readdirSync(d1Dir)
        .filter(f => f.endsWith(".sqlite"))
        .map(name => ({ name, time: fs.statSync(path.join(d1Dir, name)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
    const sqlitePath = path.join(d1Dir, files[0].name);

    const db = new Database(sqlitePath, { readonly: true });

    // Simulate D1 batch fetch exactly
    const promises = db.prepare(`SELECT * FROM promises WHERE politician_id = 'vance-001'`).all();
    const positions = db.prepare(`SELECT * FROM positions WHERE politician_id = 'vance-001' ORDER BY topic ASC, statement_date DESC`).all() as any[];

    // Test 1: Promises
    const promiseMetrics = PoliticianService.calculatePromises(promises);
    console.log(`\n=== PROMISE KEEPS RATE TEST ===`);
    console.log(`Expected Rate: 75 | Actual: ${promiseMetrics.rate}`);
    if (promiseMetrics.rate !== 75) throw new Error("Promise rate mismatch!");

    // Test 2: Consistency
    const consistencyMetrics = PoliticianService.calculateConsistency(positions);
    console.log(`\n=== CONSISTENCY TEST ===`);
    console.log(`Eligible Topics: Expected 2 | Actual: ${consistencyMetrics.totalEligibleTopics}`);
    console.log(`Contradictions: Expected 1 | Actual: ${consistencyMetrics.contradictions}`);
    console.log(`Final Consistency Score: Expected 93 (100 - (15/2)) | Actual: ${consistencyMetrics.score}`);

    console.log(`\nShift Events Rendered:`);
    console.dir(consistencyMetrics.shiftEvents);

    if (consistencyMetrics.score !== 93) throw new Error("Consistency score mismatch!");

    console.log(`\n✅ MATH LAYER PASSED DETERMINISTIC TESTS SUCCESSFULLY.`);
}

verify();
