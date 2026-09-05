import { NextRequest, NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';
import { cachedJson, publicCacheHeaders } from '@/lib/cache';
import { US_STATE_CODES } from '@/lib/services/politician-service';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const FALSE_RATINGS = "('mostly_false', 'false', 'pants_on_fire')";

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        const slug = (params.get('slug') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120);
        const state = (params.get('state') || '').toUpperCase();
        const party = params.get('party') || '';
        const role = (params.get('role') || '').replace(/[%_]/g, '').slice(0, 40);

        if (slug) {
            const fact_checks = await cachedJson(`fc:${slug}`, 300, async () => {
                const db = await getDbBinding();
                const q = await db.prepare(`SELECT id, statement, rating, analysis_text, source_url, date FROM fact_checks WHERE politician_slug = ? ORDER BY date DESC LIMIT 50`).bind(slug).all();
                return q.results || [];
            });
            return NextResponse.json({ fact_checks }, { headers: publicCacheHeaders(300) });
        }

        const validState = US_STATE_CODES.includes(state) ? state : '';
        const validParty = ['Democrat', 'Republican', 'Independent'].includes(party) ? party : '';
        const key = `fc-board:${validState || 'all'}:${validParty || 'all'}:${role || 'all'}`;
        const leaderboard = await cachedJson(key, 600, async () => {
            const db = await getDbBinding();
            // Drive from fact_checks (small table) and join officials by their unique slug.
            let sql = `
                SELECT p.name, p.slug, p.party, p.district_state, p.office_held,
                       COUNT(fc.id) AS total_rulings,
                       SUM(CASE WHEN fc.rating IN ${FALSE_RATINGS} THEN 1 ELSE 0 END) AS total_lies,
                       SUM(CASE WHEN fc.rating = 'pants_on_fire' THEN 1 ELSE 0 END) AS severe_lies
                FROM fact_checks fc
                JOIN politicians p ON p.slug = fc.politician_slug
                WHERE 1 = 1`;
            const binds: any[] = [];
            if (validState) { sql += ` AND p.state = ?`; binds.push(validState); }
            if (validParty) { sql += ` AND p.party = ?`; binds.push(validParty); }
            if (role) { sql += ` AND p.office_held LIKE ?`; binds.push(`%${role}%`); }
            sql += ` GROUP BY p.id HAVING total_lies > 0 ORDER BY total_lies DESC, severe_lies DESC LIMIT 25`;
            const q = await db.prepare(sql).bind(...binds).all();
            return q.results || [];
        });
        return NextResponse.json({ leaderboard }, { headers: publicCacheHeaders(300) });
    } catch (error: any) {
        console.error("Fact Checks API Error:", error);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
}
