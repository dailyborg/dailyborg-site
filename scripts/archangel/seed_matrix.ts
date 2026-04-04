import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// PROJECT ARCHANGEL - Matrix Initializer
// Hydrates the site with highly recognizable Federal and State politicians
// to give the frontend the immediate critical mass requested.

const DB_PATH = path.resolve(__dirname, '../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0022416b7af5aa9d2a6ffccb4383c4826d9c6c2b1f8eb4f9cd8e7c10b777a837.sqlite');

// Expand the path if needed dynamically for the developer environment
const findDbPath = () => {
    const miniflareDir = path.resolve(__dirname, '../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    if (fs.existsSync(miniflareDir)) {
        const files = fs.readdirSync(miniflareDir);
        const sqliteFile = files.find(f => f.endsWith('.sqlite'));
        if (sqliteFile) {
            return path.join(miniflareDir, sqliteFile);
        }
    }
    return DB_PATH; // Fallback
};

async function runSeedMatrix() {
    console.log("   PROJECT ARCHANGEL: HYDRATION MATRIX");
    console.log("   Initializing Global Political Index...");

    const dbPath = findDbPath();
    if (!fs.existsSync(dbPath)) {
        console.error(`[Archangel] Cannot locate D1 SQLite file at ${dbPath}`);
        console.error("Please run `npx wrangler d1 execute dailyborg-db --local --file=src/schema.sql` first.");
        return;
    }

    const db = new Database(dbPath);
    console.log(`[Archangel] Connected to Local Dev D1 at: ${dbPath}`);

    const federalPoliticians = [
        { id: "pol_f001", slug: "joe-biden", name: "Joe Biden", office_held: "President of the United States", party: "Democrat", district_state: "USA", time_in_office: "3 Years", region_level: "Federal", photo_url: "https://upload.wikimedia.org/wikipedia/commons/6/68/Joe_Biden_presidential_portrait.jpg" },
        { id: "pol_f002", slug: "kamala-harris", name: "Kamala Harris", office_held: "Vice President", party: "Democrat", district_state: "USA", time_in_office: "3 Years", region_level: "Federal", photo_url: "https://upload.wikimedia.org/wikipedia/commons/7/71/Kamala_Harris_Vice_Presidential_Portrait.jpg" },
        { id: "pol_f003", slug: "donald-trump", name: "Donald Trump", office_held: "Former President", party: "Republican", district_state: "USA", time_in_office: "4 Years (Past)", region_level: "Federal", photo_url: "https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg" },
        { id: "pol_f004", slug: "chuck-schumer", name: "Chuck Schumer", office_held: "Senate Majority Leader", party: "Democrat", district_state: "NY", time_in_office: "25+ Years", region_level: "Federal", photo_url: null },
        { id: "pol_f005", slug: "mitch-mcconnell", name: "Mitch McConnell", office_held: "Senate Minority Leader", party: "Republican", district_state: "KY", time_in_office: "30+ Years", region_level: "Federal", photo_url: null },
        { id: "pol_f006", slug: "mikr-johnson", name: "Mike Johnson", office_held: "Speaker of the House", party: "Republican", district_state: "LA", time_in_office: "7 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f007", slug: "hakeem-jeffries", name: "Hakeem Jeffries", office_held: "House Minority Leader", party: "Democrat", district_state: "NY", time_in_office: "11 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f008", slug: "bernie-sanders", name: "Bernie Sanders", office_held: "U.S. Senate", party: "Independent", district_state: "VT", time_in_office: "17 Years", region_level: "Federal", photo_url: "https://upload.wikimedia.org/wikipedia/commons/d/de/Bernie_Sanders.jpg" },
        { id: "pol_f009", slug: "ted-cruz", name: "Ted Cruz", office_held: "U.S. Senate", party: "Republican", district_state: "TX", time_in_office: "11 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f010", slug: "alexandria-ocasio-cortez", name: "Alexandria Ocasio-Cortez", office_held: "U.S. House", party: "Democrat", district_state: "NY-14", time_in_office: "5 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f011", slug: "marjorie-taylor-greene", name: "Marjorie Taylor Greene", office_held: "U.S. House", party: "Republican", district_state: "GA-14", time_in_office: "3 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f012", slug: "elizabeth-warren", name: "Elizabeth Warren", office_held: "U.S. Senate", party: "Democrat", district_state: "MA", time_in_office: "11 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f013", slug: "lindsey-graham", name: "Lindsey Graham", office_held: "U.S. Senate", party: "Republican", district_state: "SC", time_in_office: "21 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f014", slug: "cory-booker", name: "Cory Booker", office_held: "U.S. Senate", party: "Democrat", district_state: "NJ", time_in_office: "10 Years", region_level: "Federal", photo_url: null },
        { id: "pol_f015", slug: "josh-hawley", name: "Josh Hawley", office_held: "U.S. Senate", party: "Republican", district_state: "MO", time_in_office: "5 Years", region_level: "Federal", photo_url: null }
    ];

    const statePoliticians = [
        { id: "pol_s001", slug: "gavin-newsom", name: "Gavin Newsom", office_held: "Governor", party: "Democrat", district_state: "CA", time_in_office: "5 Years", region_level: "State", photo_url: "https://upload.wikimedia.org/wikipedia/commons/7/73/Gavin_Newsom_2023.jpg" },
        { id: "pol_s002", slug: "ron-desantis", name: "Ron DeSantis", office_held: "Governor", party: "Republican", district_state: "FL", time_in_office: "5 Years", region_level: "State", photo_url: null },
        { id: "pol_s003", slug: "gretchen-whitmer", name: "Gretchen Whitmer", office_held: "Governor", party: "Democrat", district_state: "MI", time_in_office: "5 Years", region_level: "State", photo_url: null },
        { id: "pol_s004", slug: "greg-abbott", name: "Greg Abbott", office_held: "Governor", party: "Republican", district_state: "TX", time_in_office: "9 Years", region_level: "State", photo_url: null },
        { id: "pol_s005", slug: "kathy-hochul", name: "Kathy Hochul", office_held: "Governor", party: "Democrat", district_state: "NY", time_in_office: "2 Years", region_level: "State", photo_url: null },
        { id: "pol_s006", slug: "brian-kemp", name: "Brian Kemp", office_held: "Governor", party: "Republican", district_state: "GA", time_in_office: "5 Years", region_level: "State", photo_url: null },
        { id: "pol_s007", slug: "jb-pritzker", name: "J.B. Pritzker", office_held: "Governor", party: "Democrat", district_state: "IL", time_in_office: "5 Years", region_level: "State", photo_url: null },
        { id: "pol_s008", slug: "glenn-youngkin", name: "Glenn Youngkin", office_held: "Governor", party: "Republican", district_state: "VA", time_in_office: "2 Years", region_level: "State", photo_url: null }
    ];

    const localPoliticians = [
        { id: "pol_l001", slug: "eric-adams", name: "Eric Adams", office_held: "Mayor", party: "Democrat", district_state: "New York City", time_in_office: "2 Years", region_level: "Local", photo_url: null },
        { id: "pol_l002", slug: "london-breed", name: "London Breed", office_held: "Mayor", party: "Democrat", district_state: "San Francisco", time_in_office: "5 Years", region_level: "Local", photo_url: null },
        { id: "pol_l003", slug: "karen-bass", name: "Karen Bass", office_held: "Mayor", party: "Democrat", district_state: "Los Angeles", time_in_office: "1 Year", region_level: "Local", photo_url: null },
        { id: "pol_l004", slug: "brandon-johnson", name: "Brandon Johnson", office_held: "Mayor", party: "Democrat", district_state: "Chicago", time_in_office: "1 Year", region_level: "Local", photo_url: null }
    ];

    const allPols = [...federalPoliticians, ...statePoliticians, ...localPoliticians];

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO politicians (id, slug, name, office_held, party, district_state, time_in_office, region_level, photo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    try {
        db.transaction(() => {
            for (const p of allPols) {
                insertStmt.run(p.id, p.slug, p.name, p.office_held, p.party, p.district_state, p.time_in_office, p.region_level, p.photo_url || null);
                count++;
            }
        })();
        console.log(`[Archangel] ✅ Successfully seeded ${count} figures into the matrix.`);
    } catch (e: any) {
        console.error("[Archangel] Failed to seed matrix:", e.message);
    }

    // Seed some mock claims to give them "Platforms"
    console.log("[Archangel] Seeding Initial Platform Data...");
    const insertClaim = db.prepare(`
        INSERT OR IGNORE INTO claims (id, politician_id, type, content, date, context)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
        db.transaction(() => {
            insertClaim.run("clm_1", "pol_f001", "Promise", "I will support widespread infrastructure renewal across America.", "2020-08-14", "Campaign Speech");
            insertClaim.run("clm_2", "pol_f003", "Promise", "We will build the largest border wall in history.", "2016-06-15", "Rally");
            insertClaim.run("clm_3", "pol_f008", "Opinion", "Healthcare is a human right, not a privilege.", "2019-10-01", "Debate");
            insertClaim.run("clm_4", "pol_s001", "Fact", "California has generated a surplus of $97 billion.", "2022-05-13", "Budget Revision");
            insertClaim.run("clm_5", "pol_s002", "Fact", "Florida's tourism numbers have exceeded pre-pandemic levels.", "2023-01-22", "Press Release");
        })();
        console.log(`[Archangel] ✅ Safely injected baseline platform intel.`);
    } catch (e: any) {
        console.error("[Archangel] Failed to seed claims:", e.message);
    }
}

runSeedMatrix();
