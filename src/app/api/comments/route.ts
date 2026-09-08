import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';
import { cachedJson, publicCacheHeaders } from '@/lib/cache';
import { verifyCommentToken } from '@/lib/comment-token';

export const runtime = 'edge';

const PAGE_TYPES = ['article', 'politician', 'desk', 'borg-record'];
const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const MIN_CONTENT = 2;
const MAX_CONTENT = 2000;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

function validPage(pageType: unknown, pageSlug: unknown): { page_type: string; page_slug: string } | null {
    if (typeof pageType !== 'string' || !PAGE_TYPES.includes(pageType)) return null;
    if (typeof pageSlug !== 'string' || !SLUG_RE.test(pageSlug)) return null;
    return { page_type: pageType, page_slug: pageSlug };
}

// GET /api/comments?page_type=politician&page_slug=joe-biden
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const page = validPage(url.searchParams.get('page_type'), url.searchParams.get('page_slug'));
        if (!page) {
            return NextResponse.json({ error: 'A valid page_type and page_slug are required' }, { status: 400 });
        }

        // One database read per data center per minute for each discussion thread.
        const comments = await cachedJson(`comments:${page.page_type}:${page.page_slug}`, 60, async () => {
            const db = await getDbBinding();
            const result = await db.prepare(`
                SELECT id, display_name, content, created_at
                FROM comments
                WHERE page_type = ? AND page_slug = ? AND status = 'visible'
                ORDER BY created_at DESC
                LIMIT 50
            `).bind(page.page_type, page.page_slug).all();
            return (result?.results || []) as any[];
        });

        return NextResponse.json({ comments }, { headers: publicCacheHeaders(60) });
    } catch (error: any) {
        console.error('Comments GET Error:', error);
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
}

// POST /api/comments — the subscriber id comes from the signed token, never from the body.
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as any;
        const { token, content } = body;

        const page = validPage(body.page_type, body.page_slug);
        if (!page) {
            return NextResponse.json({ error: 'A valid page_type and page_slug are required' }, { status: 400 });
        }

        if (typeof content !== 'string') {
            return NextResponse.json({ error: `Comment must be between ${MIN_CONTENT} and ${MAX_CONTENT} characters` }, { status: 400 });
        }
        const trimmed = content.trim();
        if (trimmed.length < MIN_CONTENT || trimmed.length > MAX_CONTENT) {
            return NextResponse.json({ error: `Comment must be between ${MIN_CONTENT} and ${MAX_CONTENT} characters` }, { status: 400 });
        }

        const subscriberId = await verifyCommentToken(token);
        if (!subscriberId) {
            return NextResponse.json({ error: 'Your commenting session has expired. Please verify your email again.' }, { status: 401 });
        }

        const db = await getDbBinding();

        const subResult = await db.prepare('SELECT id, email FROM subscribers WHERE id = ?').bind(subscriberId).first();
        if (!subResult) {
            return NextResponse.json({ error: 'Invalid subscriber. Please subscribe first.' }, { status: 401 });
        }

        const recent = await db.prepare(
            "SELECT 1 FROM comments WHERE subscriber_id = ? AND created_at >= datetime('now', '-60 seconds') LIMIT 1"
        ).bind(subscriberId).first();
        if (recent) {
            return NextResponse.json({ error: 'Please wait a minute between comments.' }, { status: 400 });
        }

        const email = subResult.email as string;
        const localPart = email.split('@')[0];
        const displayName = localPart.charAt(0).toUpperCase() + localPart.slice(1);

        const commentId = crypto.randomUUID();

        await db.prepare(`
            INSERT INTO comments (id, subscriber_id, subscriber_email, display_name, page_type, page_slug, content)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(commentId, subscriberId, email, displayName, page.page_type, page.page_slug, trimmed).run();

        return NextResponse.json({
            success: true,
            comment: {
                id: commentId,
                display_name: displayName,
                content: trimmed,
                // Same UTC text shape the list returns ("2026-06-12 09:00:49").
                created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
            }
        }, { status: 201 });
    } catch (error: any) {
        console.error('Comments POST Error:', error);
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
}
