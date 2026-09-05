import { NextResponse } from 'next/server';
import { ArticleService } from '@/lib/services/article-service';
import { publicCacheHeaders } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
    try {
        const headlines = await ArticleService.getHeadlines(12);
        if (headlines.length === 0) {
            return NextResponse.json([{ title: "DAILY BORG: Newsroom online, first edition publishing soon", slug: "", desk: "" }], { headers: publicCacheHeaders(60) });
        }
        return NextResponse.json(headlines, { headers: publicCacheHeaders(120) });
    } catch (error) {
        console.error("Headlines API Error:", error);
        return NextResponse.json([{ title: "DAILY BORG: Connection interrupted", slug: "", desk: "" }], { status: 200, headers: publicCacheHeaders(30) });
    }
}
