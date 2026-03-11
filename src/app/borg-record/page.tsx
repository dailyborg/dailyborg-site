import { getDbBinding } from "@/lib/db";
import { PoliticianDirectoryClient } from "@/components/PoliticianDirectoryClient";

export default async function BorgRecordDirectory() {
    // Prevent the build from failing if DB is missing on Vercel/Edge build step
    let initialPoliticians = [];
    try {
        const db = await getDbBinding();
        const res = await db.prepare("SELECT * FROM politicians WHERE country = 'US' ORDER BY name ASC").bind().all();

        // Handle varying return structures between local better-sqlite and cloud D1
        const raw = res?.results || res?.[0]?.results || [];

        initialPoliticians = raw.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            office_held: p.office_held || "Federal Official",
            party: p.party || "Independent",
            district_state: p.district_state || "--",
            consistency_label: "Analyzing" // Dynamic scores deferred to profile view for index performance
        }));
    } catch (e) {
        console.warn("Failed to load initial politicians", e);
    }

    // Fallback if db is completely empty for some reason
    if (initialPoliticians.length === 0) {
        initialPoliticians = [
            { id: "1", slug: "sample-slug", name: "Eleanor Vance", office_held: "U.S. Senate", party: "Democrat", district_state: "OH", consistency_label: "Mixed" }
        ];
    }

    return <PoliticianDirectoryClient initialPoliticians={initialPoliticians} />;
}
