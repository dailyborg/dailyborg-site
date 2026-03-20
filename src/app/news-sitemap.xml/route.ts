import { getDbBinding } from "@/lib/db";

export const runtime = 'edge';

export async function GET() {
    const db = await getDbBinding();
    
    // Google News sitemap MUST only contain articles from the last 2 days (48 hours)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { results } = await db.prepare(`
        SELECT a.title, a.slug, a.desk, a.publish_date, au.name as author_name
        FROM articles a
        LEFT JOIN authors au ON a.author_id = au.id
        WHERE a.publish_date >= ? AND a.approval_status = 'approved'
        ORDER BY a.publish_date DESC
        LIMIT 1000
    `).bind(fortyEightHoursAgo).all();

    const articles = results || [];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${articles.map((article: any) => `
  <url>
    <loc>https://dailyborg.com/${article.desk.toLowerCase().replace(' ', '-')}/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>DailyBorg</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${article.publish_date}</news:publication_date>
      <news:title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</news:title>
    </news:news>
  </url>`).join('')}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200'
        }
    });
}
