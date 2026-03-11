import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
    // Basic server-side auth check
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = await getDbBinding();

        // 1. Get total pending articles
        const pendingResult = await db.prepare("SELECT COUNT(*) as count FROM articles WHERE approval_status = 'pending'").first();
        const pendingCount = pendingResult?.count || 0;

        // 2. Get today's ingestion metrics
        const metricsResult = await db.prepare(`
            SELECT 
                SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicates_caught,
                SUM(CASE WHEN status = 'inserted' THEN 1 ELSE 0 END) as successful_inserts
            FROM ingestion_logs 
            WHERE created_at > date('now')
        `).first();

        return NextResponse.json({
            pendingCount,
            duplicatesCaughtToday: metricsResult?.duplicates_caught || 0,
            successfulInsertsToday: metricsResult?.successful_inserts || 0
        });

    } catch (error: any) {
        console.error("Admin Metrics API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
