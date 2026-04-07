import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

// Helper to ensure the table schema exists. Doing this here guarantees it works safely in production without Wrangler CLI schema push issues.
async function initSchema(db: any) {
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY, 
                value TEXT NOT NULL, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
    } catch (e) {
        console.error("Failed to init system_settings table:", e);
    }
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = await getDbBinding();
        await initSchema(db);

        const results = await db.prepare("SELECT key, value FROM system_settings").all();
        const settings = (results.results || []).reduce((acc: any, row: any) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        // Defaults if missing
        if (!settings.ai_provider) settings.ai_provider = 'aiml';
        if (!settings.cloudflare_daily_operations_cap) settings.cloudflare_daily_operations_cap = '30';
        if (!settings.logo_placement) settings.logo_placement = 'center';

        return NextResponse.json({ settings });
    } catch (error: any) {
        console.error("Admin Settings GET API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = await getDbBinding();
        await initSchema(db);

        const body: any = await request.json();
        
        // Allowed keys to update
        const updates = [];
        if (body.ai_provider && ['aiml', 'cloudflare'].includes(body.ai_provider)) {
            updates.push({ key: 'ai_provider', value: body.ai_provider });
        }
        if (body.cloudflare_daily_operations_cap) {
            updates.push({ key: 'cloudflare_daily_operations_cap', value: String(body.cloudflare_daily_operations_cap) });
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
