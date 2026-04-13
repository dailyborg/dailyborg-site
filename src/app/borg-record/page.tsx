import { getDbBinding } from "@/lib/db";
import { PoliticianDirectoryClient } from "@/components/PoliticianDirectoryClient";
import CommentSection from "@/components/CommentSection";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function BorgRecordDirectory() {
    // Prevent the build from failing if DB is missing on Vercel/Edge build step
    let initialPoliticians = [];
    try {
        const db = await getDbBinding();
        const res = await db.prepare("SELECT * FROM politicians ORDER BY name ASC").bind().all();

        // Handle varying return structures between local better-sqlite and cloud D1
        const raw = res?.results || res?.[0]?.results || [];

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
            promises_kept: p.promises_kept ?? 0,
            promises_broken: p.promises_broken ?? 0,
            promises_total: p.promises_total ?? 0,
            popularity_score: p.popularity_score ?? 0,
            consistency_label: "Analyzing"
        }));
    } catch (e) {
        console.warn("Failed to load initial politicians", e);
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
