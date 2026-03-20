import { getDbBinding } from "../db";

export interface Author {
    id: string;
    name: string;
    slug: string;
    bio: string;
    email: string;
    avatar_url: string;
    twitter_handle: string;
    created_at: string;
}

export interface AuthorArticle {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    desk: string;
    publish_date: string;
    hero_image_url: string;
}

export class AuthorService {
    static async getAuthorBySlug(slug: string): Promise<Author | null> {
        const db = await getDbBinding();
        const res = await db.prepare(`SELECT * FROM authors WHERE slug = ?`).bind(slug).first();
        return res as Author | null;
    }

    static async getArticlesByAuthor(authorId: string, limit = 10): Promise<AuthorArticle[]> {
        const db = await getDbBinding();
        const res = await db.prepare(
            `SELECT id, slug, title, excerpt, desk, publish_date, hero_image_url 
             FROM articles 
             WHERE author_id = ? 
             ORDER BY publish_date DESC 
             LIMIT ?`
        ).bind(authorId, limit).all();
        
        return (res?.results || []) as AuthorArticle[];
    }
}
