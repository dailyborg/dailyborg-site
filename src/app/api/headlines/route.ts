import { NextRequest, NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const db = await getDbBinding();
        
        // Fetch top 12 approved articles with slug and desk for clickable links
        const { results } = await (db as any).prepare(`
            SELECT title, slug, desk, publish_date
            FROM articles 
            WHERE approval_status = 'approved' 
            ORDER BY publish_date DESC 
            LIMIT 12
        `).all();

        const headlines = results.map((r: any) => ({
            title: r.title,
            slug: r.slug,
            desk: (r.desk || 'intel').toLowerCase(),
            publish_date: r.publish_date
        }));

        if (headlines.length === 0) {
            return NextResponse.json([
                { title: "DAILY BORG: Algorithmic news matrix active", slug: "", desk: "" },
                { title: "STATUS: Establishing connection to the grid...", slug: "", desk: "" },
            ]);
        }

        return NextResponse.json(headlines);
    } catch (error) {
        console.error("Headlines API Error:", error);
        return NextResponse.json([
            { title: "DAILY BORG: Connection Interrupted", slug: "", desk: "" },
        ], { status: 200 });
    }
}
