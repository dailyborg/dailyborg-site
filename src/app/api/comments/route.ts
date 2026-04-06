import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

// GET /api/comments?page_type=politician&page_slug=joe-biden
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const pageType = url.searchParams.get('page_type');
        const pageSlug = url.searchParams.get('page_slug');

        if (!pageType || !pageSlug) {
            return NextResponse.json({ error: 'page_type and page_slug are required' }, { status: 400 });
        }

        const db = await getDbBinding();

        const result = await db.prepare(`
            SELECT id, display_name, content, created_at 
            FROM comments 
            WHERE page_type = ? AND page_slug = ? AND status = 'visible'
            ORDER BY created_at DESC 
            LIMIT 50
        `).bind(pageType, pageSlug).all();

        const comments = result?.results || [];

        return NextResponse.json({ comments });
    } catch (error: any) {
        console.error('Comments GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/comments
export async function POST(request: Request) {
    try {
        const { subscriber_id, content, page_type, page_slug } = await request.json() as any;

        if (!subscriber_id || !content || !page_type || !page_slug) {
            return NextResponse.json({ error: 'subscriber_id, content, page_type, and page_slug are required' }, { status: 400 });
        }

        if (content.trim().length === 0 || content.length > 2000) {
            return NextResponse.json({ error: 'Comment must be between 1 and 2000 characters' }, { status: 400 });
        }

        const db = await getDbBinding();

        // Verify subscriber exists
        const subResult = await db.prepare('SELECT id, email FROM subscribers WHERE id = ?').bind(subscriber_id).first();

        if (!subResult) {
            return NextResponse.json({ error: 'Invalid subscriber. Please subscribe first.' }, { status: 401 });
        }

        const email = subResult.email as string;
        const displayName = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);

        const commentId = crypto.randomUUID();

        await db.prepare(`
            INSERT INTO comments (id, subscriber_id, subscriber_email, display_name, page_type, page_slug, content)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(commentId, subscriber_id, email, displayName, page_type, page_slug, content.trim()).run();

        return NextResponse.json({
            success: true,
            comment: {
                id: commentId,
                display_name: displayName,
                content: content.trim(),
                created_at: new Date().toISOString()
            }
        });
    } catch (error: any) {
        console.error('Comments POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
