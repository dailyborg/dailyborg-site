import { getDbBinding } from './src/lib/db';

async function hydrateBorgRecord() {
    console.log("Starting manual hydration of Borg Record...");
    try {
        const res = await fetch("https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.json");
        if (!res.ok) throw new Error("Could not reach legislators JSON");
        
        const legislators: any[] = await res.json();
        const sample = legislators.slice(0, 5);
        
        const db = await getDbBinding();
        
        for (const leg of sample) {
            const name = `${leg.name.first} ${leg.name.last}`;
            const terms = leg.terms || [];
            const latestTerm = terms[terms.length - 1];
            if (!latestTerm) continue;

            const officeHeld = latestTerm.type === "sen" ? "U.S. Senate" : "U.S. House";
            const party = latestTerm.party || "Independent";
            const districtState = latestTerm.state + (latestTerm.district ? `-${latestTerm.district}` : "");
            const polId = `pol_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

            await db.prepare(`
                INSERT INTO politicians (id, slug, name, office_held, party, district_state, region_level, time_in_office)
                VALUES (?, ?, ?, ?, ?, ?, 'Federal', 'Active')
            `).bind(polId, slug, name, officeHeld, party, districtState).run();
            
            console.log(`Successfully hydrated: ${name}`);
        }
    } catch (e) {
        console.error("Hydration failed:", e);
    }
}

hydrateBorgRecord();
