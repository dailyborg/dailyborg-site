import { getDbBinding } from "@/lib/db";
import { cachedJson } from "@/lib/cache";

export const runtime = 'edge';

/** publish_date is stored as UTC text ("2026-06-12 09:00:49"), so the bound must have that same shape. */
function sqlTimestamp(d: Date): string {
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export async function GET() {
    // Google News sitemap MUST only contain articles from the last 2 days (48 hours)
    const fortyEightHoursAgo = sqlTimestamp(new Date(Date.now() - 48 * 60 * 60 * 1000));

    const articles = await cachedJson('news-sitemap', 600, async () => {
        const db = await getDbBinding();
        const { results } = await db.prepare(`
            SELECT a.title, a.slug, a.desk, a.publish_date, au.name as author_name
            FROM articles a
            LEFT JOIN authors au ON a.author_id = au.id
            WHERE a.publish_date >= ? AND a.approval_status = 'approved'
            ORDER BY a.publish_date DESC
            LIMIT 500
        `).bind(fortyEightHoursAgo).all();
        return (results || []) as any[];
    });

    // A row with no desk or no slug cannot produce a valid URL, and one with no title or date
    // cannot produce a valid entry, so they are left out instead of crashing the whole sitemap.
    const usable = articles.filter((a: any) => a && a.desk && a.slug && a.title && a.publish_date);

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${usable.map((article: any) => `
  <url>
    <loc>${escapeXml(`https://dailyborg.com/${String(article.desk).toLowerCase().replace(/\s+/g, '-')}/${article.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>DailyBorg</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(String(article.publish_date).replace(' ', 'T') + 'Z')}</news:publication_date>
      <news:title>${escapeXml(String(article.title))}</news:title>
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
