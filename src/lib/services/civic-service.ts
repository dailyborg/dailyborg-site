import { getDbBinding } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CivicLookupResult {
    success: boolean;
    addressResolved?: string;
    officialsFound?: number;
    ingestedCount?: number;
    error?: string;
}

export class CivicService {
    /**
     * Look up an address via Google Civic Information API, retrieve localized officials,
     * and seamlessly ingest them into the D1 DB if they aren't already tracked.
     */
    static async lookupAndIngest(address: string): Promise<CivicLookupResult> {
        try {
            const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
            if (!apiKey) {
                console.error("[CivicService] GOOGLE_CIVIC_API_KEY is not defined in the environment.");
                return { success: false, error: 'Server configuration error: Google Civic API key missing.' };
            }

            // Encode address for Google API
            const encodedAddress = encodeURIComponent(address);
            const civicUrl = `https://civicinfo.googleapis.com/civicinfo/v2/representatives?address=${encodedAddress}&key=${apiKey}`;

            const response = await fetch(civicUrl);
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("[CivicService] Google API Error:", errData);
                return { success: false, error: 'Failed to resolve civic data for that address.' };
            }

            const data = await response.json() as any;
            
            if (!data.officials || !data.offices) {
                return { success: true, addressResolved: data.normalizedInput?.line1, officialsFound: 0, ingestedCount: 0 };
            }

            const db = getDbBinding();
            let newIngestCount = 0;

            // Google Civic separates 'officials' (people) and 'offices' (roles). We map them together.
            for (const office of data.offices) {
                // Determine Regional Level based on Civic levels mapping
                let regionLevel = 'Local';
                if (office.levels?.includes('country')) regionLevel = 'Federal';
                else if (office.levels?.includes('administrativeArea1')) regionLevel = 'State';
                
                // Identify the specific district/state context
                const divisionStr = office.divisionId || ''; // e.g., ocd-division/country:us/state:ny/county:bronx
                const stateMatch = divisionStr.match(/state:([a-z]{2})/i);
                const districtState = stateMatch ? stateMatch[1].toUpperCase() : 'US';

                for (const officialIndex of office.officialIndices) {
                    const official = data.officials[officialIndex];
                    if (!official || !official.name) continue;

                    const name = official.name;
                    // Provide a stable slug string based on name
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    const party = official.party || "Independent";
                    const photoUrl = official.photoUrl || null;
                    const officeName = office.name;

                    // Does this politician already exist in our matrix?
                    const existing = await db.prepare('SELECT id FROM politicians WHERE slug = ?').bind(slug).first();
                    
                    if (!existing) {
                        const newId = `pol_${uuidv4().replace(/-/g, '').slice(0, 15)}`;
                        
                        // Autonomous Ingestion!
                        const stmt = db.prepare(`
                            INSERT INTO politicians 
                            (id, slug, name, office_held, party, district_state, region_level, candidate_status, time_in_office, photo_url, latest_sync_timestamp)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 'Active', ?, CURRENT_TIMESTAMP)
                        `).bind(newId, slug, name, officeName, party, districtState, regionLevel, photoUrl);

                        await stmt.run();

                        // Add an initial baseline claim so they aren't empty
                        const claimId = `clm_${uuidv4().replace(/-/g, '').slice(0, 15)}`;
                        await db.prepare(`
                            INSERT INTO claims (id, politician_id, type, content, date, context)
                            VALUES (?, ?, 'Fact', ?, DATE('now'), 'Auto-Discovery via Civic Intake')
                        `).bind(claimId, newId, `${name} serves as ${officeName} for ${districtState}.`).run();

                        newIngestCount++;
                    } else {
                        // Update existing entry with the latest sync timestamp
                        await db.prepare(`UPDATE politicians SET latest_sync_timestamp = CURRENT_TIMESTAMP WHERE slug = ?`).bind(slug).run();
                    }
                }
            }

            return {
                success: true,
                addressResolved: data.normalizedInput ? `${data.normalizedInput.city}, ${data.normalizedInput.state}` : address,
                officialsFound: data.officials.length,
                ingestedCount: newIngestCount
            };

        } catch (error: any) {
            console.error("[CivicService] Exception during local lookup:", error);
            return { success: false, error: 'Internal server boundary error during discovery.' };
        }
    }
}
