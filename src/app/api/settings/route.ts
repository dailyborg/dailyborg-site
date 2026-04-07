import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
    try {
        const db = await getDbBinding();
        
        // Ensure table exists just in case
        await db.exec(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY, 
                value TEXT NOT NULL, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        const results = await db.prepare("SELECT key, value FROM system_settings WHERE key IN ('logo_placement')").all();
        const settings = (results.results || []).reduce((acc: any, row: any) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        // Defaults if missing
        if (!settings.logo_placement) settings.logo_placement = 'center';

        return NextResponse.json({ settings }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        });
    } catch (error: any) {
        console.error("Public Settings API Error:", error);
        // Fallback gracefully so site doesn't break
        return NextResponse.json({ settings: { logo_placement: 'center' } });
    }
}
