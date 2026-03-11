import { getDbBinding } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = await getDbBinding();

        // Fetch all pending articles with their parsed sources
        const { results } = await db.prepare(`
            SELECT a.*, 
                   (SELECT json_group_array(json_object('name', source_name, 'url', source_url)) 
                    FROM article_sources 
                    WHERE article_id = a.id) as sources
            FROM articles a 
            WHERE a.approval_status = 'pending'
            ORDER BY a.publish_date DESC
        `).bind().all();

        return NextResponse.json({ articles: results });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
