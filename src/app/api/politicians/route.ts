import { NextRequest, NextResponse } from 'next/server';
import { PoliticianService, SEARCH_QUERY_RE } from '@/lib/services/politician-service';
import { publicCacheHeaders } from '@/lib/cache';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/politicians?q=<name>   indexed prefix search across every active official (2+ letters)
 * GET /api/politicians            the most viewed active federal officials (for pickers)
 */
export async function GET(request: NextRequest) {
    try {
        const q = (request.nextUrl.searchParams.get('q') || '').trim();

        if (q && !SEARCH_QUERY_RE.test(q)) {
            return NextResponse.json({ error: "Enter at least two letters." }, { status: 400 });
        }

        const politicians = q ? await PoliticianService.search(q) : await PoliticianService.featured(60);
        return NextResponse.json({ politicians }, { status: 200, headers: publicCacheHeaders(300) });
    } catch (error: any) {
        console.error("Politicians API Error:", error);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
}
