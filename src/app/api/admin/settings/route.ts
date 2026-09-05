import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const db = await getDbBinding();

        const results = await db.prepare("SELECT key, value FROM system_settings").all();
        const settings = (results.results || []).reduce((acc: any, row: any) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        // Defaults if missing
        if (!settings.ai_provider) settings.ai_provider = 'aiml';
        if (!settings.daily_article_cap) settings.daily_article_cap = settings.cloudflare_daily_operations_cap || '40';
        if (!settings.logo_placement) settings.logo_placement = 'center';

        return NextResponse.json({ settings });
    } catch (error: any) {
        console.error("Admin Settings GET API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const db = await getDbBinding();

        const body: any = await request.json();
        
        // Allowed keys to update
        const updates = [];
        if (body.ai_provider && ['aiml', 'cloudflare'].includes(body.ai_provider)) {
            updates.push({ key: 'ai_provider', value: body.ai_provider });
        }
        const cap = body.daily_article_cap ?? body.cloudflare_daily_operations_cap;
        if (cap !== undefined && Number.isFinite(parseInt(String(cap), 10)) && parseInt(String(cap), 10) >= 1 && parseInt(String(cap), 10) <= 500) {
            updates.push({ key: 'daily_article_cap', value: String(parseInt(String(cap), 10)) });
        }
        if (body.logo_placement && ['left', 'center', 'right'].includes(body.logo_placement)) {
            updates.push({ key: 'logo_placement', value: body.logo_placement });
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: "No valid settings provided." }, { status: 400 });
        }

        // Upsert into D1 Database
        const batch = updates.map(update => {
            return db.prepare(`
                INSERT INTO system_settings (key, value) 
                VALUES (?, ?) 
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).bind(update.key, update.value);
        });

        await db.batch(batch);

        return NextResponse.json({ success: true, updatedKeys: updates.map(u => u.key) });
    } catch (error: any) {
        console.error("Admin Settings POST API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
