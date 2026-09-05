import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const body: any = await request.json();
        const { title, excerpt, content_html, action } = body;
        const db = await getDbBinding();

        if (action === 'approve') {
            await db.prepare(`
                UPDATE articles 
                SET title = ?, excerpt = ?, content_html = ?, approval_status = 'approved'
                WHERE id = ?
            `).bind(title, excerpt, content_html, params.id).run();

            return NextResponse.json({ success: true, status: 'approved' });
        } else if (action === 'reject') {
            await db.prepare(`
                UPDATE articles 
                SET approval_status = 'rejected'
                WHERE id = ?
            `).bind(params.id).run();

            return NextResponse.json({ success: true, status: 'rejected' });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (e: any) {
        console.error("Admin Approval API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
