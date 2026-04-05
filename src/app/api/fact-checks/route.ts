import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        let db;
        try {
            const context = getRequestContext();
            db = (context.env as any).DB;
        } catch (e) {
            console.warn("Running outside Cloudflare context. Falling back to local DB module.");
            const { getDbBinding } = await import('../../../lib/db');
            db = await getDbBinding();
        }

        if (!db) {
            return NextResponse.json({ error: "Database not bound" }, { status: 500 });
        }

        const url = new URL(request.url);
        const slug = url.searchParams.get('slug');
        const state = url.searchParams.get('state');
        const party = url.searchParams.get('party');
        const role = url.searchParams.get('role');

        if (slug) {
            // Fetch specific fact checks for a politician
            const query = await db.prepare(`
                SELECT id, statement, rating, analysis_text, source_url, date 
                FROM fact_checks 
                WHERE politician_slug = ? 
                ORDER BY created_at DESC
            `).bind(slug).all();
            return NextResponse.json({ fact_checks: query.results || [] }, { status: 200 });
        } else {
            // Fetch aggregates for the chart builder
            let sql = `
                SELECT 
                    p.name, 
                    p.slug, 
                    p.party, 
                    p.district_state, 
                    p.office_held,
                    COUNT(fc.id) as total_lies,
                    SUM(CASE WHEN fc.rating = 'pants_on_fire' THEN 1 ELSE 0 END) as severe_lies
                FROM politicians p
                LEFT JOIN fact_checks fc ON p.slug = fc.politician_slug
                WHERE 1=1
            `;
            const params: any[] = [];

            if (state && state !== 'all') {
                sql += ` AND p.district_state = ?`;
                params.push(state);
            }
            if (party && party !== 'all') {
                sql += ` AND p.party = ?`;
                params.push(party);
            }
            if (role && role !== 'all') {
                // simple LIKE match for role (e.g. %President%, %Representative%)
                sql += ` AND p.office_held LIKE ?`;
                params.push(`%${role}%`);
            }

            sql += ` GROUP BY p.id HAVING total_lies > 0 ORDER BY total_lies DESC`;

            const query = params.length > 0 
                ? await db.prepare(sql).bind(...params).all()
                : await db.prepare(sql).all();

            return NextResponse.json({ leaderboard: query.results || [] }, { status: 200 });
        }

    } catch (error: any) {
        console.error("Fact Checks API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
