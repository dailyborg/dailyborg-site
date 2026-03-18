import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        const { env } = getRequestContext();
        const rawDb = (env as any).DB;
        const helperDb = await getDbBinding();

        return NextResponse.json({
            success: true,
            has_raw_db: !!rawDb,
            has_helper_db: !!helperDb,
            env_keys: Object.keys(env as any || {}),
            raw_db_type: typeof rawDb,
            helper_db_type: typeof helperDb
        });
    } catch (error: any) {
        return NextResponse.json({ 
            error: error.message, 
            stack: error.stack,
            name: error.name
        }, { status: 500 });
    }
}
