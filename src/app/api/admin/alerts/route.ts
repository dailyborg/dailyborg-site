import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = await getDbBinding();
        const alerts: { type: 'info' | 'warning' | 'critical' | 'success'; message: string }[] = [];

        // 1. Pending articles
        const pendingResult = await db.prepare(
            "SELECT COUNT(*) as count FROM articles WHERE approval_status = 'pending'"
        ).first() as any;
        const pendingCount = pendingResult?.count || 0;
        if (pendingCount > 0) {
            alerts.push({ type: 'warning', message: `${pendingCount} article${pendingCount > 1 ? 's' : ''} pending review` });
        }

        // 2. Recent ingestion errors (last 2 hours)
        const errorsResult = await db.prepare(
            "SELECT COUNT(*) as count FROM ingestion_logs WHERE status LIKE '%error%' AND created_at >= datetime('now', '-2 hours')"
        ).first() as any;
        const errorCount = errorsResult?.count || 0;
        if (errorCount > 0) {
            alerts.push({ type: 'critical', message: `${errorCount} ingestion error${errorCount > 1 ? 's' : ''} in the last 2 hours` });
        }

        // 3. Visitor delta (today vs yesterday)
        const todayVisitors = await db.prepare(
            "SELECT COUNT(DISTINCT ip_hash) as count FROM site_visits WHERE created_at >= date('now')"
        ).first() as any;
        const yesterdayVisitors = await db.prepare(
            "SELECT COUNT(DISTINCT ip_hash) as count FROM site_visits WHERE created_at >= date('now', '-1 day') AND created_at < date('now')"
        ).first() as any;
        const todayCount = todayVisitors?.count || 0;
        const yesterdayCount = yesterdayVisitors?.count || 0;

        if (yesterdayCount > 0 && todayCount < yesterdayCount * 0.6) {
            const dropPct = Math.round((1 - todayCount / yesterdayCount) * 100);
            alerts.push({ type: 'warning', message: `Visitor drop: -${dropPct}% vs yesterday (${todayCount} today vs ${yesterdayCount})` });
        } else if (todayCount > 0) {
            alerts.push({ type: 'info', message: `${todayCount} unique visitor${todayCount > 1 ? 's' : ''} today` });
        }

        // 4. New subscribers (last 7 days)
        const newSubsResult = await db.prepare(
            "SELECT COUNT(*) as count FROM subscribers WHERE created_at >= date('now', '-7 days')"
        ).first() as any;
        const newSubs = newSubsResult?.count || 0;
        if (newSubs > 0) {
            alerts.push({ type: 'success', message: `${newSubs} new subscriber${newSubs > 1 ? 's' : ''} this week` });
        }

        // 5. Successful inserts today
        const insertResult = await db.prepare(
            "SELECT COUNT(*) as count FROM ingestion_logs WHERE status = 'inserted' AND created_at >= date('now')"
        ).first() as any;
        const insertCount = insertResult?.count || 0;
        if (insertCount > 0) {
            alerts.push({ type: 'success', message: `${insertCount} article${insertCount > 1 ? 's' : ''} autonomously published today` });
        }

        // 6. System health summary
        if (errorCount === 0) {
            alerts.push({ type: 'success', message: 'All autonomous systems operational' });
        }

        return NextResponse.json({ alerts });
    } catch (error: any) {
        console.error("Admin Alerts API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
