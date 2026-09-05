# Cloudflare settings (account Pressroom@dailyborg.com, zone dailyborg.com)

Status 2026-09-05 (evening, Eastern): applied through the dashboard in the Pressroom Chrome profile. Each item says what is set and why; items still open are marked TODO.

## Resources that must exist (verify, do not recreate)

| Resource | Name / id | Used by |
|---|---|---|
| Pages project | dailyborg-site | the site |
| D1 | dailyborg-db, c412efcd-54d8-47a6-9ca5-8522417992c3 | site + all workers |
| R2 | borg-images | site image route |
| KV | SENTINEL_CACHE, 5a2f3f363bce4eceb61dd765686b2dc4 | scraper dedup |
| Queue | ingest-queue | scraper (producer), ingest (consumer) |
| Workers | dailyborg-discovery, sentinel-engine, dailyborg-scraper, dailyborg-truth, dailyborg-ingest | five crons total |

Cleaned 2026-09-05: dailyborg-image-medic deleted; the old discovery Durable Object class removed. The draft-engine, publisher, social-publisher, delivery and feeder workers had never been deployed, and the enrichment/processing queues never existed. Still present and unused: Vectorize index dailyborg-claims (left alone; harmless, no cost at rest).

## Speed and budget

- **Cache Rule** DONE 2026-09-05: "Cache public API responses that send Cache-Control". Expression `(http.request.full_uri wildcard r"https://dailyborg.com/api/*") or (http.request.uri.path eq "/news-sitemap.xml")`, eligible for cache, Edge TTL "Use cache-control header if present, bypass cache if not", Browser TTL respect origin. Why: the headline ticker, live strip, politician picker, fact-check board, settings and image routes all send public Cache-Control headers, so the edge serves repeat requests without touching D1. Admin and POST routes send no such header and are bypassed. HTML pages are not edge cached (Next.js marks them private); their data is cached inside the Worker by src/lib/cache.ts instead.
- **Tiered Cache** (Smart Tiered Cache): already Active, verified 2026-09-05.
- **Early Hints**: turned ON 2026-09-05 (Speed > Settings > Content). The site sends Link preload headers for its fonts, so browsers can start fetching them before the HTML arrives.
- **Brotli**: on (responses arrive with `Content-Encoding: br`, verified with curl).
- **0-RTT Connection Resumption**: still OFF. The toggle did not take through the automated browser; optional, tiny gain, leave it.
- Pages project > Settings > Functions > Compatibility flags: `nodejs_compat` (already required by the build).

## Security

- Security > Settings: Bot Fight Mode ON and Browser Integrity Check ON (both were already on, verified 2026-09-05).
- Security > Settings > Block AI bots: preference set 2026-09-05 to "Mixed purpose crawlers will continue to be allowed". Why: PROJECT-START section 7 wants AI answer engines to find and cite the site; blocking mixed-purpose crawlers (Google, Bing) would hurt search too.
- Rate limiting: NOT added. The Free plan allows exactly one rate limiting rule and Cloudflare's default "Leaked credential check" rule already occupies it (Security > Security rules). Replacing it with a rule that limits POST /api/subscribe, /api/requests/politician and /api/comments means deleting that default rule first, which is Dr. Cato's call (question logged in STATUS.md). Custom rules: 0 of 5 used; none needed yet because every POST route validates input and dedupes in code.
- SSL/TLS (all set 2026-09-05): encryption mode Full (strict); Always Use HTTPS ON (http://dailyborg.com/* answers 301 to https); Minimum TLS Version 1.2 (was 1.0); TLS 1.3 ON; Automatic HTTPS Rewrites ON; Opportunistic Encryption ON. HSTS deliberately left OFF (it is hard to undo; turn on only after a month of clean HTTPS).
- Pages project environment variable ADMIN_PASSPHRASE must be set (see runbook). Rotate UNSPLASH_ACCESS_KEY (it was in the public git history).

## Discovery (SEO, AEO, GEO)

- DNS (verified 2026-09-05): `dailyborg.com` CNAME to dailyborg-site.pages.dev, proxied. `www` CNAME to dailyborg-site.pages.dev, proxied, ADDED 2026-09-05 (there was no www record at all; Cloudflare itself flagged "Visitors cannot reach www.dailyborg.com"). www.dailyborg.com is also registered as a custom domain on the Pages project (status active). Mail records (Mailgun MX + SPF, DMARC p=none, k1 DKIM) and Resend records (resend._domainkey TXT, send.dailyborg.com MX + SPF via Amazon SES) were already present and were not touched.
- Redirect rule "Redirect from WWW to root [Template]" DONE 2026-09-05: `https://www.*` 301 to `https://${1}`, query string preserved. Verified: https://www.dailyborg.com/about?ref=1 answers 301 to https://dailyborg.com/about?ref=1.
- Google Search Console and Bing Webmaster Tools: verify via DNS TXT, submit https://dailyborg.com/news-sitemap.xml. (Needs Dr. Cato's browser session.)
- Email: inbound mail for dailyborg.com is handled by Mailgun (MX records present), not Cloudflare Email Routing. Resend's DNS records are in place (see DNS above), so sending from @dailyborg.com through Resend should already be verified; confirm in the Resend dashboard (needs the Resend login) before relying on subscriber email.
- Web Analytics (free): already active for dailyborg.com (verified 2026-09-05, it is recording visits and Core Web Vitals). The in-house `site_visits` table can be retired later to save D1 writes; the admin dashboard still reads it today, so that is a small code change, not a dashboard one.
