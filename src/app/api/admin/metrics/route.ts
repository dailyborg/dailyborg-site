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

        // 3. Get unique visitors today
        const visitorsResult = await db.prepare("SELECT COUNT(DISTINCT ip_hash) as unique_visitors_today FROM site_visits WHERE created_at >= date('now')").first();
        const uniqueVisitorsToday = visitorsResult?.unique_visitors_today || 0;

        // 4. Get total subscribers
        const subscribersResult = await db.prepare("SELECT COUNT(*) as total_subscribers, SUM(CASE WHEN plan_type = 'paid' THEN 1 ELSE 0 END) as paying_subscribers FROM subscribers").first();
        const totalSubscribers = subscribersResult?.total_subscribers || 0;
        const payingSubscribers = subscribersResult?.paying_subscribers || 0;

        return NextResponse.json({
            pendingCount,
            duplicatesCaughtToday: metricsResult?.duplicates_caught || 0,
            successfulInsertsToday: metricsResult?.successful_inserts || 0,
            uniqueVisitorsToday,
            totalSubscribers,
            payingSubscribers
        });

    } catch (error: any) {
        console.error("Admin Metrics API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
