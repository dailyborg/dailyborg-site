import { NextRequest, NextResponse } from 'next/server';
import { PoliticianService } from '@/lib/services/politician-service';
import { publicCacheHeaders } from '@/lib/cache';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/politicians?q=<name>   indexed prefix search across every official (2+ characters)
 * GET /api/politicians            the most viewed active federal officials (for pickers)
 */
export async function GET(request: NextRequest) {
    try {
        const q = (request.nextUrl.searchParams.get('q') || '').trim();
        const politicians = q.length >= 2 ? await PoliticianService.search(q) : await PoliticianService.featured(60);
        return NextResponse.json({ politicians }, { status: 200, headers: publicCacheHeaders(300) });
    } catch (error: any) {
        console.error("Politicians API Error:", error);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
}
