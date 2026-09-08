import { NextResponse } from 'next/server';
import { ArticleService } from '@/lib/services/article-service';
import { publicCacheHeaders } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Real headlines only. This route used to invent ticker copy ("Newsroom online...",
 * "Connection interrupted") that read like a published story, so an empty newsroom or a database
 * failure now returns an empty list and the ticker simply shows nothing.
 */
export async function GET() {
    try {
        const headlines = await ArticleService.getHeadlines(12);
        return NextResponse.json(headlines, { headers: publicCacheHeaders(headlines.length === 0 ? 60 : 120) });
    } catch (error) {
        console.error("Headlines API Error:", error);
        return NextResponse.json([], { status: 200, headers: publicCacheHeaders(30) });
    }
}
