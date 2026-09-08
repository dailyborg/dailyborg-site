import type { MetadataRoute } from "next";

export const runtime = "edge";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin", "/api"],
            },
        ],
        sitemap: [
            "https://dailyborg.com/sitemap.xml",
            "https://dailyborg.com/news-sitemap.xml",
        ],
        host: "https://dailyborg.com",
    };
}
