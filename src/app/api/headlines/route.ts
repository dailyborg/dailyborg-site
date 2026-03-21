import { NextRequest, NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const db = await getDbBinding();
        
        // Fetch top 5 approved articles ordered by date
        const { results } = await (db as any).prepare(`
            SELECT title 
            FROM articles 
            WHERE approval_status = 'approved' 
            ORDER BY publish_date DESC 
            LIMIT 5
        `).all();

        const headlines = results.map((r: any) => r.title);

        if (headlines.length === 0) {
            // Fallbacks if no articles yet
            return NextResponse.json([
                "DAILY BORG: Algorithmic news matrix active",
                "STATUS: Establishing connection to the grid...",
                "UPDATE: Autonomous feeders deployed and scouting"
            ]);
        }

        return NextResponse.json(headlines);
    } catch (error) {
        console.error("Headlines API Error:", error);
        return NextResponse.json([
            "DAILY BORG: Connection Interrupted",
            "STATUS: Retrying secure uplink...",
            "ERROR: D1 Matrix Sync Failure"
        ], { status: 200 }); // Return fallback instead of 500 to keep UI clean
    }
}
