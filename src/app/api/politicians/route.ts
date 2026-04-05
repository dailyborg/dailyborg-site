import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
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

        const query = await db.prepare(`
            SELECT id, name, slug, party, office_held, photo_url 
            FROM politicians 
            ORDER BY name ASC
        `).all();

        return NextResponse.json({ politicians: query.results || [] }, { status: 200 });

    } catch (error: any) {
        console.error("Politicians API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
