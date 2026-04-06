import { getDbBinding } from "../db";
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
}

export class ArticleService {
    static async getArticleBySlug(slug: string): Promise<Article | null> {
        const db = await getDbBinding();
        
        // Fetch article and join with author
        const res = await db.prepare(`
            SELECT a.*, au.name as author_name, au.slug as author_slug, au.bio as author_bio, au.avatar_url as author_avatar
            FROM articles a
            LEFT JOIN authors au ON a.author_id = au.id
            WHERE a.slug = ?
        `).bind(slug).first();

        if (!res) return null;

        const article = res as any;
        
        return {
            ...article,
            author: article.author_name ? {
                id: article.author_id,
                name: article.author_name,
                slug: article.author_slug,
                bio: article.author_bio,
                avatar_url: article.author_avatar
            } : undefined
        };
    }

    static async getRecentArticles(limit = 5): Promise<Article[]> {
        const db = await getDbBinding();
        const res = await db.prepare(`
            SELECT * FROM articles 
            WHERE approval_status = 'approved' 
            ORDER BY publish_date DESC 
            LIMIT ?
        `).bind(limit).all();

        return (res?.results || []) as Article[];
    }
}
