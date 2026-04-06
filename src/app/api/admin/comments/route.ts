import { NextResponse } from 'next/server';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

// GET /api/admin/comments — List all comments for moderation
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = await getDbBinding();
        const url = new URL(request.url);
        const status = url.searchParams.get('status') || 'all';

        let query = `SELECT * FROM comments ORDER BY created_at DESC LIMIT 100`;
        if (status !== 'all') {
            query = `SELECT * FROM comments WHERE status = '${status}' ORDER BY created_at DESC LIMIT 100`;
        }

        const result = await db.prepare(query).all();
        const comments = result?.results || [];

        return NextResponse.json({ comments });
    } catch (error: any) {
        console.error('Admin Comments GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/admin/comments — Edit a comment
export async function PUT(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, content, status } = await request.json() as any;

        if (!id) {
            return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
        }

        const db = await getDbBinding();

        if (content !== undefined && status !== undefined) {
            await db.prepare('UPDATE comments SET content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(content, status, id).run();
        } else if (content !== undefined) {
            await db.prepare('UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(content, id).run();
        } else if (status !== undefined) {
            await db.prepare('UPDATE comments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(status, id).run();
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Admin Comments PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/admin/comments — Permanently delete a comment
export async function DELETE(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await request.json() as any;

        if (!id) {
            return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
        }

        const db = await getDbBinding();
        await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Admin Comments DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
