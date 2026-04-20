import { getDbBinding } from "@/lib/db";
import { PoliticianDirectoryClient } from "@/components/PoliticianDirectoryClient";
import CommentSection from "@/components/CommentSection";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function BorgRecordDirectory() {
    // Prevent the build from failing if DB is missing on Vercel/Edge build step
    let initialPoliticians: any[] = [];
    try {
        const db = await getDbBinding();
        const cols = "id, slug, name, office_held, party, district_state, region_level, candidate_status, photo_url, trustworthiness_score";
        
        // Run 3 separate queries - one per tab - to stay within D1 Edge response limits
        const fedRes = await db.prepare(`SELECT ${cols} FROM politicians WHERE region_level = 'Federal' ORDER BY name ASC LIMIT 100`).bind().all();
        const stateRes = await db.prepare(`SELECT ${cols} FROM politicians WHERE region_level = 'State' ORDER BY name ASC LIMIT 100`).bind().all();
        const localRes = await db.prepare(`SELECT ${cols} FROM politicians WHERE region_level = 'Local' ORDER BY name ASC LIMIT 50`).bind().all();

        const fedRaw = fedRes?.results || [];
        const stateRaw = stateRes?.results || [];
        const localRaw = localRes?.results || [];
        const raw = [...fedRaw, ...stateRaw, ...localRaw];
        console.log("[BorgRecord] DB returned", raw.length, "politicians (F:", fedRaw.length, "S:", stateRaw.length, "L:", localRaw.length, ")");

        initialPoliticians = raw.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            office_held: p.office_held || "Federal Official",
            party: p.party || "Independent",
            district_state: p.district_state || "--",
            region_level: p.region_level || "Federal",
            candidate_status: p.candidate_status || "Active",
            photo_url: p.photo_url || null,
            trustworthiness_score: p.trustworthiness_score ?? null,
            promises_kept: 0,
            promises_total: 0,
            popularity_score: 0,
            consistency_label: "Analyzing"
        }));
    } catch (e: any) {
        console.error("[BorgRecord] FAILED to load politicians:", e?.message || e);
    }

    // Fallback if db is completely empty for some reason
    if (initialPoliticians.length === 0) {
        initialPoliticians = [
            { id: "1", slug: "sample-slug", name: "Eleanor Vance", office_held: "U.S. Senate", party: "Democrat", district_state: "OH", region_level: "Federal", candidate_status: "Active", consistency_label: "Mixed" }
        ];
    }

    // Extract region code from Edge headers (e.g. "NY", "OH", "CA")
    let clientState = null;
    try {
        const { getRequestContext } = await import('@cloudflare/next-on-pages');
        const ctx = getRequestContext();
        if (ctx && ctx.cf && ctx.cf.regionCode) {
            clientState = ctx.cf.regionCode;
        }
    } catch (e) {
        // Fallback or dev mode
    }

    return (
        <>
            <PoliticianDirectoryClient initialPoliticians={initialPoliticians} initialState={clientState} />
            <div className="container mx-auto px-4 md:px-8 pb-16">
                <CommentSection pageType="borg-record" pageSlug="directory" />
            </div>
        </>
    );
}
