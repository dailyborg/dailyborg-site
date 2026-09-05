import { getDbBinding } from "../db";
import { cachedJson } from "../cache";
import { Author } from "./author-service";

export interface Article {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content_html: string;
    article_type: string;
    confidence_score: number;
    desk: string;
    hero_image_url: string;
    author_id: string;
    publish_date: string;
    read_time?: number;
    author?: Author;
    author_name?: string;
}

export const DESKS = ["Politics", "Crime", "Business", "Entertainment", "Sports", "Science", "Education"] as const;

/** Maps a URL segment like "politics" to the stored desk value "Politics". */
export function deskFromSlug(segment: string): string | null {
    const s = segment.toLowerCase();
    return DESKS.find(d => d.toLowerCase() === s) || null;
}

const LIST_COLUMNS = "id, slug, title, excerpt, article_type, confidence_score, desk, hero_image_url, author_id, publish_date, read_time";

export class ArticleService {
    static async getArticleBySlug(slug: string): Promise<Article | null> {
        const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 200);
        if (!safe) return null;
        return cachedJson(`article:${safe}`, 300, async () => {
            const db = await getDbBinding();
            const res = await db.prepare(`
                SELECT a.*, au.name AS author_name, au.slug AS author_slug, au.bio AS author_bio, au.avatar_url AS author_avatar
                FROM articles a
                LEFT JOIN authors au ON a.author_id = au.id
                WHERE a.slug = ? AND a.approval_status = 'approved'
            `).bind(safe).first();
            if (!res) return null;
            const article = res as any;
            return {
                ...article,
                author: article.author_name ? { id: article.author_id, name: article.author_name, slug: article.author_slug, bio: article.author_bio, avatar_url: article.author_avatar } : undefined,
            } as Article;
        });
    }

    /** Newest approved articles across every desk. Index: idx_articles_approved_date. */
    static async getRecentArticles(limit = 5): Promise<Article[]> {
        const n = Math.min(Math.max(limit, 1), 60);
        return cachedJson(`recent:${n}`, 120, async () => {
            const db = await getDbBinding();
            const res = await db.prepare(`
                SELECT a.id, a.slug, a.title, a.excerpt, a.article_type, a.confidence_score, a.desk, a.hero_image_url, a.author_id, a.publish_date, a.read_time, au.name AS author_name
                FROM articles a LEFT JOIN authors au ON a.author_id = au.id
                WHERE a.approval_status = 'approved'
                ORDER BY a.publish_date DESC
                LIMIT ?
            `).bind(n).all();
            return (res?.results || []) as Article[];
        });
    }

    /** Newest approved articles for one desk. Index: idx_articles_desk_date. */
    static async getDeskArticles(desk: string, limit = 32): Promise<Article[]> {
        const n = Math.min(Math.max(limit, 1), 60);
        return cachedJson(`desk:${desk}:${n}`, 120, async () => {
            const db = await getDbBinding();
            const res = await db.prepare(`
                SELECT ${LIST_COLUMNS} FROM articles
                WHERE desk = ? AND approval_status = 'approved'
                ORDER BY publish_date DESC
                LIMIT ?
            `).bind(desk, n).all();
            return (res?.results || []) as Article[];
        });
    }

    /** Headlines for the ticker and live strip. */
    static async getHeadlines(limit = 12): Promise<Array<{ title: string; slug: string; desk: string; publish_date: string }>> {
        return cachedJson(`headlines:${limit}`, 120, async () => {
            const db = await getDbBinding();
            const res = await db.prepare(`
                SELECT title, slug, desk, publish_date FROM articles
                WHERE approval_status = 'approved'
                ORDER BY publish_date DESC
                LIMIT ?
            `).bind(limit).all();
            return ((res?.results || []) as any[]).map(r => ({ title: r.title, slug: r.slug, desk: String(r.desk || "politics").toLowerCase(), publish_date: r.publish_date }));
        });
    }
}
