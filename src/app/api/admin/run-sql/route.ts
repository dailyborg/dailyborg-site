import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json() as any;
        const db = await getDbBinding();
        const results: any[] = [];
        const errors: any[] = [];

        let queryList: { sql: string; params?: any[] }[] = [];

        if (body.queries && Array.isArray(body.queries)) {
            queryList = body.queries.map((q: any) => {
                if (typeof q === 'string') {
                    return { sql: q };
                }
                return { sql: q.sql, params: q.params || [] };
            });
        } else if (body.sql) {
            queryList = [{ sql: body.sql, params: body.params || [] }];
        } else {
            return NextResponse.json({ error: "No queries provided" }, { status: 400 });
        }

        for (let i = 0; i < queryList.length; i++) {
            const { sql, params } = queryList[i];
            try {
                const stmt = db.prepare(sql);
                const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
                
                const upperSql = sql.trim().toUpperCase();
                if (upperSql.startsWith('SELECT') || upperSql.startsWith('WITH')) {
                    const res = await bound.all();
                    results.push({ index: i, sql, success: true, results: res.results || res });
                } else {
                    const res = await bound.run();
                    results.push({ index: i, sql, success: true, meta: res });
                }
            } catch (e: any) {
                errors.push({ index: i, sql, error: e.message });
            }
        }

        return NextResponse.json({ success: errors.length === 0, results, errors });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
