import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Number of rows the statement actually changed. D1 always reports this; the local stand-in does not. */
function changedRows(result: any): number | null {
    const meta = result?.meta;
    if (!meta || typeof meta.changes === 'undefined') return null;
    return Number(meta.changes);
}

/**
 * GET /api/admin/articles/[id]
 * The pending list no longer carries content_html (it is the largest column by far and the list is
 * read on every admin page load), so the editor loads the full row for the one article it opens.
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const db = await getDbBinding();
        const article = await db.prepare(`
            SELECT a.*,
                   (SELECT json_group_array(json_object('name', source_name, 'url', source_url))
                    FROM article_sources
                    WHERE article_id = a.id) as sources
            FROM articles a
            WHERE a.id = ?
        `).bind(params.id).first();

        if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
        return NextResponse.json({ article });
    } catch (e: any) {
        console.error("Admin Article GET API Error:", e);
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const body: any = await request.json().catch(() => ({}));
        const { title, excerpt, content_html, action } = body;
        const db = await getDbBinding();

        if (action === 'approve') {
            // COALESCE so a field the editor did not send keeps the stored value instead of being wiped.
            const res = await db.prepare(`
                UPDATE articles
                SET title = COALESCE(?, title),
                    excerpt = COALESCE(?, excerpt),
                    content_html = COALESCE(?, content_html),
                    approval_status = 'approved',
                    publish_date = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(
                typeof title === 'string' ? title : null,
                typeof excerpt === 'string' ? excerpt : null,
                typeof content_html === 'string' ? content_html : null,
                params.id
            ).run();

            if (changedRows(res) === 0) {
                return NextResponse.json({ error: "Article not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true, status: 'approved' });
        } else if (action === 'reject') {
            const res = await db.prepare(`
                UPDATE articles
                SET approval_status = 'rejected'
                WHERE id = ?
            `).bind(params.id).run();

            if (changedRows(res) === 0) {
                return NextResponse.json({ error: "Article not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true, status: 'rejected' });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (e: any) {
        console.error("Admin Approval API Error:", e);
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
}
