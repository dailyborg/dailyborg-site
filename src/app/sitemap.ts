import type { MetadataRoute } from "next";
import { ArticleService, DESKS } from "@/lib/services/article-service";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SITE = "https://dailyborg.com";

/** D1 stores "YYYY-MM-DD HH:MM:SS" in UTC. Sitemaps want a real date object. */
function toDate(dbDate: string | undefined | null): Date {
    if (!dbDate) return new Date();
    const s = String(dbDate);
    const iso = s.endsWith("Z") ? s : s.includes("T") ? `${s}Z` : `${s.replace(" ", "T")}Z`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const entries: MetadataRoute.Sitemap = [
        { url: `${SITE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
        ...DESKS.map((desk) => ({
            url: `${SITE}/${desk.toLowerCase()}`,
            lastModified: now,
            changeFrequency: "hourly" as const,
            priority: 0.9,
        })),
        { url: `${SITE}/borg-record`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
        { url: `${SITE}/borg-record/liar-liar`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
        { url: `${SITE}/borg-record/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
        { url: `${SITE}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
        { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: `${SITE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: `${SITE}/ethics`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
        { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ];

    // Newest approved stories. getRecentArticles clamps its limit to 60, so 60 is the ceiling.
    try {
        const articles = await ArticleService.getRecentArticles(60);
        for (const article of articles) {
            if (!article.slug) continue;
            entries.push({
                url: `${SITE}/${String(article.desk || "politics").toLowerCase()}/${article.slug}`,
                lastModified: toDate(article.publish_date),
                changeFrequency: "daily",
                priority: 0.8,
            });
        }
    } catch {
        // A database hiccup must not break the sitemap; the static pages above still ship.
    }

    return entries;
}
