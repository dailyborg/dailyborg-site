import { PoliticianService, LEVELS, US_STATE_CODES, type Level } from "@/lib/services/politician-service";
import { PoliticianDirectoryClient } from "@/components/PoliticianDirectoryClient";
import CommentSection from "@/components/CommentSection";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
}

/**
 * The Borg Record directory.
 * The level and state live in the URL (?level=State&state=NY) so the server reads only that slice of the
 * roster (index backed, cached for ten minutes) instead of shipping every official to the browser.
 */
export default async function BorgRecordDirectory({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const sp = await searchParams;
    const levelParam = first(sp.level);
    const level: Level = (LEVELS as readonly string[]).includes(levelParam || "") ? (levelParam as Level) : "Federal";
    const stateParam = (first(sp.state) || "").toUpperCase();
    const includeFormer = first(sp.former) === "1";

    // Visitor's region from Cloudflare, used to pre-select a state on the State and Local tabs.
    let geoState: string | null = null;
    try {
        const { getRequestContext } = await import("@cloudflare/next-on-pages");
        const ctx = getRequestContext();
        const code = (ctx?.cf as any)?.regionCode as string | undefined;
        if (code && (ctx?.cf as any)?.country === "US" && US_STATE_CODES.includes(code)) geoState = code;
    } catch {
        // local dev or no context
    }

    const state = US_STATE_CODES.includes(stateParam) ? stateParam : (level !== "Federal" ? geoState : null);
    const politicians = await PoliticianService.listDirectory(level, state, includeFormer);

    return (
        <>
            <PoliticianDirectoryClient
                initialPoliticians={politicians}
                level={level}
                state={state}
                includeFormer={includeFormer}
                geoState={geoState}
            />
            <div className="container mx-auto px-4 md:px-8 pb-16">
                <CommentSection pageType="borg-record" pageSlug="directory" />
            </div>
        </>
    );
}
