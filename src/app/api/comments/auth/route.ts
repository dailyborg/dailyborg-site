import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

// POST /api/comments/auth — Verify subscriber email for commenting
export async function POST(request: Request) {
    try {
        const { email } = await request.json() as any;

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const db = await getDbBinding();

        const result = await db.prepare('SELECT id, email FROM subscribers WHERE email = ?').bind(email.trim().toLowerCase()).first();

        if (!result) {
            return NextResponse.json({
                error: 'not_subscriber',
                message: 'This email is not registered as a subscriber. Subscribe to join the conversation.'
            }, { status: 404 });
        }

        const displayName = (result.email as string).split('@')[0].charAt(0).toUpperCase() +
            (result.email as string).split('@')[0].slice(1);

        // Set a cookie so they don't have to re-authenticate on every page
        const response = NextResponse.json({
            success: true,
            subscriber_id: result.id,
            display_name: displayName
        });

        response.cookies.set('borg_commenter', JSON.stringify({
            id: result.id,
            name: displayName,
            email: result.email
        }), {
            httpOnly: false, // Needs to be readable by client JS
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 90, // 90 days
            path: '/'
        });

        return response;
    } catch (error: any) {
        console.error('Comment Auth Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
