import { getDbBinding } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = 'edge';

// Everything the admin queue shows, except content_html: the article body is by far the largest
// column and the queue never displays it. The editor loads one full article from /api/admin/articles/[id].
const LIST_COLUMNS = "a.id, a.slug, a.title, a.excerpt, a.author_id, a.read_time, a.article_type, a.confidence_score, a.publish_date, a.desk, a.hero_image_url, a.approval_status";

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const db = await getDbBinding();

        // Newest 50 pending articles with their parsed sources.
        const { results } = await db.prepare(`
            SELECT ${LIST_COLUMNS},
                   (SELECT json_group_array(json_object('name', source_name, 'url', source_url))
                    FROM article_sources
                    WHERE article_id = a.id) as sources
            FROM articles a
            WHERE a.approval_status = 'pending'
            ORDER BY a.publish_date DESC
            LIMIT 50
        `).all();

        return NextResponse.json({ articles: results });
    } catch (e: any) {
        console.error("Admin Articles API Error:", e);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
}
