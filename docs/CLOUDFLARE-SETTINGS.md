# Cloudflare settings (account Pressroom@dailyborg.com, zone dailyborg.com)

Status 2026-09-05: nothing below has been applied yet; this machine has no dashboard access. Each item says what to set and why. Record the date next to each item when it is done.

## Resources that must exist (verify, do not recreate)

| Resource | Name / id | Used by |
|---|---|---|
| Pages project | dailyborg-site | the site |
| D1 | dailyborg-db, c412efcd-54d8-47a6-9ca5-8522417992c3 | site + all workers |
| R2 | borg-images | site image route |
| KV | SENTINEL_CACHE, 5a2f3f363bce4eceb61dd765686b2dc4 | scraper dedup |
| Queue | ingest-queue | scraper (producer), ingest (consumer) |
| Workers | dailyborg-discovery, sentinel-engine, dailyborg-scraper, dailyborg-truth, dailyborg-ingest | five crons total |

Delete when found: dailyborg-draft-engine, publisher-engine, dailyborg-social-publisher, dailyborg-delivery, dailyborg-image-medic, dailyborg-feeder, dailyborg-site-feeder, queues enrichment-queue and processing-queue, Vectorize index dailyborg-claims (unused now), and any D1 database other than dailyborg-db.

## Speed and budget

- **Cache Rule** (Caching > Cache Rules): "Cache HTML": when Hostname equals dailyborg.com AND URI Path does not start with /api/ AND does not start with /admin: Cache eligible, Edge TTL "Use cache-control header if present, bypass cache if not", Browser TTL respect origin. Why: Pages Functions responses are not cached by default; with this rule the `Cache-Control` headers the site sends let Cloudflare serve repeat visitors without touching D1.
- **Tiered Cache**: on (free). **Early Hints**: on. **Brotli**: on.
- Pages project > Settings > Functions > Compatibility flags: `nodejs_compat` (already required by the build).

## Security

- Security > Bots: Bot Fight Mode ON (free). Why: the analytics endpoint and the subscribe form are open to the public.
- Security > Settings: Browser Integrity Check ON, Security Level Medium.
- WAF custom rule (free tier allows 5): rate limit POST /api/subscribe, /api/requests/politician and /api/comments to 10 per minute per IP.
- SSL/TLS: Full (strict); Always Use HTTPS ON; HSTS on once confirmed.
- Pages project environment variable ADMIN_PASSPHRASE must be set (see runbook). Rotate UNSPLASH_ACCESS_KEY (it was in the public git history).

## Discovery (SEO, AEO, GEO)

- DNS: dailyborg.com and www CNAME to dailyborg-site.pages.dev, proxied.
- Custom domain www redirect to apex (Rules > Redirect Rules).
- Google Search Console and Bing Webmaster Tools: verify via DNS TXT, submit https://dailyborg.com/news-sitemap.xml. (Needs Dr. Cato's browser session.)
- Email Routing: pressroom@, notifications@, edition@ at dailyborg.com forward to Dr. Cato's inbox; Resend domain verification records (SPF, DKIM) for sending from notifications@ and edition@.
- Web Analytics (free): add the site; the in-house `site_visits` table can then be turned off to save D1 writes.
