# SEO, AEO and GEO status

Done (in code):
- NewsArticle JSON-LD on every article page, Person JSON-LD on every politician profile.
- Google News sitemap at /news-sitemap.xml (last 48 hours, cached 10 minutes).
- Per-page titles and descriptions through Next metadata; metadataBase set to https://dailyborg.com.
- 25 named author bylines with profile pages (E-E-A-T), linked from every article.
- Every fact on a politician page links to its source (PolitiFact, official rosters), which is what answer engines reward.

Not done yet (needs dashboard or browser access):
- robots.txt and a full sitemap.xml (add as static files or routes; robots must allow crawlers and point at both sitemaps).
- llms.txt describing the site for AI crawlers.
- Google Search Console and Bing Webmaster verification and sitemap submission.
- Cloudflare Web Analytics instead of the in-house visit table.
- Organization JSON-LD on the home page and a public methodology page for the trust score (partly on each profile now).
