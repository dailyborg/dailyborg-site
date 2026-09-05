import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';
import { cachedJson, publicCacheHeaders } from '@/lib/cache';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await cachedJson('settings:public', 300, async () => {
            const db = await getDbBinding();
            const results = await db.prepare("SELECT key, value FROM system_settings WHERE key IN ('logo_placement')").all();
            const out: Record<string, string> = { logo_placement: 'center' };
            for (const row of (results.results || []) as any[]) out[row.key] = row.value;
            return out;
        });
        return NextResponse.json({ settings }, { headers: publicCacheHeaders(300) });
    } catch (error: any) {
        console.error("Public Settings API Error:", error);
        return NextResponse.json({ settings: { logo_placement: 'center' } });
    }
}
