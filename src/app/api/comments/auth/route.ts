import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';
import { makeCommentToken } from '@/lib/comment-token';

export const runtime = 'edge';

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const MAX_EMAIL_LENGTH = 254;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// POST /api/comments/auth — verify a subscriber email and hand back a signed commenting token.
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as any;
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

        if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
        }

        const db = await getDbBinding();

        const result = await db.prepare('SELECT id, email FROM subscribers WHERE email = ?').bind(email).first();

        if (!result) {
            return NextResponse.json({
                error: 'not_subscriber',
                message: 'This email is not registered as a subscriber. Subscribe to join the conversation.'
            }, { status: 404 });
        }

        const subscriberId = result.id as string;
        const localPart = (result.email as string).split('@')[0];
        const displayName = localPart.charAt(0).toUpperCase() + localPart.slice(1);

        // The token is what actually authorizes a comment. It is signed, carries the subscriber id,
        // and expires after 30 days, so a copied subscriber id is no longer enough to post.
        const token = await makeCommentToken(subscriberId);
        if (!token) {
            console.error('Comment Auth Error: ADMIN_PASSPHRASE is not configured, so no token could be signed.');
            return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
        }

        const response = NextResponse.json({
            success: true,
            token,
            subscriber_id: subscriberId,
            display_name: displayName
        });

        // Convenience only: the browser uses this to remember who is signed in. It grants nothing.
        response.cookies.set('borg_commenter', JSON.stringify({
            id: subscriberId,
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
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
}
