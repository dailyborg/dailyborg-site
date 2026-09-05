# Status (updated 2026-09-05 evening, takeover session)

## Where things stand

DEPLOYED 2026-09-05 (afternoon, Eastern). Wrangler is logged in on this desktop through OAuth as pressroom@dailyborg.com (no token file; on the laptop run `npx wrangler login` once and click Authorize in the Pressroom Chrome profile).

- Migration 0010 applied to production (72 statements; the demo rows, random scores and mock votes are gone; all indexes exist).
- Five workers live on their new schedules: discovery :05 hourly, sentinel :20 hourly, scraper :50 every 2h, truth :40 every 6h, ingest 08:00 UTC daily. The old image-medic worker was deleted; the old discovery Durable Object class was removed with a delete-class migration. The publisher, social-publisher, delivery, draft-engine and feeder workers had never actually been deployed.
- The Pages project is Git-connected: every push to main builds and deploys the site automatically. ADMIN_PASSPHRASE is set on the project (value in `_credentials/admin-passphrase.txt` on the Drive) and takes effect from the build of commit 3bf8780 onward.
- Full database backup taken before the migration: `claude/code/dailyborg/backups/dailyborg-db-before-takeover-2026-09-05.sql` on the Drive (58 MB, contains subscriber emails, keep private).

**Today only:** the account had already used its 5,000,000 daily D1 reads by 13:00 UTC (the old workers were still running until the new ones replaced them). Until 00:00 UTC every database read fails, so the live site shows empty states and the roster priming could not finish (Alabama's 140 legislators did load). The hourly crons will prime everything themselves after the reset: federal roster and President/VP at 00:05 UTC, PolitiFact rulings at 00:40 UTC, then one state per hour. If anything looks empty the next morning, run the `?action=` calls in DEPLOY-RUNBOOK step 5 by hand.

**Cloudflare dashboard, done 2026-09-05 evening (Pressroom Chrome profile, full detail in docs/CLOUDFLARE-SETTINGS.md):**

- Cache Rule "Cache public API responses that send Cache-Control" is live; `/api/headlines` now answers `cf-cache-status: HIT` on repeat requests, so the ticker and live strip no longer touch D1 between refreshes.
- SSL/TLS: Full (strict), Always Use HTTPS on, Minimum TLS 1.2, TLS 1.3 on, Automatic HTTPS Rewrites on. HSTS left off on purpose.
- Speed: Smart Tiered Cache already active, Early Hints turned on, Brotli confirmed. 0-RTT left off (toggle would not take; negligible).
- Security: Bot Fight Mode and Browser Integrity Check on; AI crawlers set to "allowed" so answer engines can cite the site.
- www.dailyborg.com now exists: proxied CNAME to dailyborg-site.pages.dev, registered as a Pages custom domain (active), and a redirect rule sends https://www.* to https://dailyborg.com/* with a 301 and the query string kept. Before today there was no www record at all.
- Web Analytics was already active for the zone.
- Secrets confirmed on dailyborg-ingest: AIML_API_KEY, RESEND_API_KEY, UNSPLASH_ACCESS_KEY (plus three unused TWILIO_* leftovers). sentinel-engine has UNSPLASH_ACCESS_KEY.
- Not done: a rate limiting rule for the POST API routes. The Free plan allows one such rule and Cloudflare's default "Leaked credential check" already uses it (see questions below).

**The two problems Dr. Cato reported, root causes found:**

1. D1 "rows_read limit exceeded" (5,000,000 per day on the free plan).
   - `sentinel-engine` ran every 15 minutes and did about eleven full scans of the `articles` table each time (per-desk COUNTs, two `LIKE '2026-04-0x%'` scans, `MAX(publish_date)`, plus a `COUNT(DISTINCT office_held)` over all politicians). That alone was on the order of a thousand full scans per day.
   - `dailyborg-discovery` scored "popularity" hourly with `SELECT COUNT(*) FROM articles WHERE title LIKE ? OR content_html LIKE ?` for 20 politicians, twenty more full scans per hour, always the same 20 people.
   - The Borg Record page loaded up to 1,000 politician rows on every single visit with no cache; the home page, desk pages and headline ticker scanned `articles` with no index on `(approval_status, publish_date)`; the ticker was polled every 60 seconds by every open browser tab.
   - Nothing was ever pruned: `ingestion_logs` got a row every 15 minutes, `trustworthiness_history` got about 900 rows a day, `site_visits` grew forever.
2. Wrong politicians / wrong details.
   - The Congress intake matched people by LAST NAME (`WHERE name LIKE '%Johnson'`) and then overwrote that row's office, party and district with the new person's. Hank Johnson became a Louisiana Republican, and so on.
   - Every article's AI-extracted "mentioned names" were pushed into the request queue, where an 8B model "verified" them and invented offices. Two workers (discovery and draft-engine) raced on that same queue; draft-engine retried forever on duplicate slugs, burning AIML calls every 15 minutes.
   - Trust scores were `Math.random() * 20 + 70`. Votes were mock rows with random Yea/Nay. The truth engine attributed AI-generated "lies" to whoever shared a last name with a word in an article.
   - The compare page, the profile sidebar and the home page sidebar showed hard-coded fake people, fake votes and fake percentages.

## What was done this session

- New home: `C:\Users\mrcat\OneDrive\Desktop\new claude\dailyborg` (git clone of the repo, history kept). Secrets moved to the Drive (`claude\code\dailyborg\_credentials`). 10,000+ committed `node_modules` files, three committed `.dev.vars` secret files, and 50+ junk log files removed from the repo.
- Migration `src/migrations/0010_takeover_hardening.sql`: identity columns (bioguide_id, openstates_id, wikidata_id, state, source), all missing indexes, the `fact_checks` and `system_settings` tables, deletion of fabricated data (random scores, mock votes, demo politicians, auto-generated requests).
- `workers/discovery-engine`: rewritten. Federal roster from congress-legislators keyed by bioguide id, President/VP from executive.json, state legislators from OpenStates one state per hour, reader requests verified through Wikidata "position held" claims, popularity from Wikipedia pageviews. No AI. One hourly cron.
- `workers/sentinel`: rewritten. One hourly maintenance pass with index-backed queries, free Unsplash image repair (5 per run), daily pruning, scraper triggered through a service binding at most once per hour.
- `workers/truth-engine`: rewritten. Reads PolitiFact's feed, matches speakers by PolitiFact's own slug, stores every ruling with its source link, derives trust scores from stored rulings (minimum 3).
- `workers/ingest`: no longer feeds AI-spotted names into the roster; hard daily article cap (default 40, admin adjustable as `daily_article_cap`); one cron (Friday run is the weekly edition); domain fixed to dailyborg.com.
- `workers/scraper`: every 2 hours, 3 per feed, manual triggers rate limited to one per 10 minutes.
- Retired and removed from the repo: draft-engine, publisher, social-publisher, delivery (duplicate of ingest's delivery, wrong database id), image-medic (folded into sentinel), feeder-worker and src/workers/feeder.ts (inserted claims without a politician, so every insert failed and retried forever). They must also be deleted in the Cloudflare dashboard (see DEPLOY-RUNBOOK).
- Site: see the sections below and `docs/DECISIONS.md`.

## Site changes (src/)

- `src/lib/cache.ts`: edge cache helper (Cache API, no binding needed). Home, desk pages, Borg Record directory, politician profiles, headlines, politicians list and fact-check leaderboard all read through it.
- Borg Record directory is now filtered on the server by level and state (`?level=State&state=NY`) instead of shipping 1,000 rows to the browser.
- All fake data removed: profile sidebar votes, compare page defaults/percentages/charts/"connected races", home page sidebar, admin "+12%", directory fallback person, sample-slug mock profile.
- Security: admin routes require `ADMIN_PASSPHRASE` (no hard-coded default), constant-time compare; `/api/admin/seed` and `/api/admin/debug` and `/debug` deleted; SQL injection in admin comments fixed; `/api/ingest` now requires admin auth; Stripe returns "not configured" instead of faking success.
- Polling reduced: live strip every 5 minutes, ticker every 10 minutes, admin strip every 2 minutes.
- Google Civic "address PING" removed from the UI (Google shut that API down in April 2025); replaced with a plain note.

## Verified locally this session (2026-09-05)

| Check | Result |
|---|---|
| `npm run check` (site TypeScript) | pass |
| `npm run check:workers` (five workers) | pass |
| `next build` | pass (all dynamic routes on the edge runtime) |
| `@cloudflare/next-on-pages` locally | not runnable on this Windows machine (Vercel CLI symlink permission); Cloudflare's Linux build runs it. See DECISIONS. |
| `wrangler deploy --dry-run` for every worker | bundles cleanly (ingest 310 KB gzipped, others under 12 KB) |
| Migration rehearsal on a local D1 (schema, legacy migrations, 0010, 0011) | pass: 38 indexes, new columns, 25 authors |
| Discovery worker against real data (local D1) | 539 legislators, President and VP, Alabama and Alaska legislatures, popularity, photos; Hank Johnson GA-4 Democrat and Mike Johnson LA-4 Republican both correct; no duplicate names |
| Reader request path | "Gavin Newsom" verified as Governor of California via Wikidata; "Taylor Swift" rejected; existing member recognized |
| Truth engine against the live PolitiFact feed | 18 rulings read, 6 matched, 10 stored with source links; trust scores derived |

Known small items: PolitiFact publishes some rulings in English and Spanish as separate items, so a bilingual ruling can be stored twice (two source links). Scores will look harsh at first because PolitiFact mostly checks doubtful claims; the profile page explains the formula.

## Questions for Dr. Cato (saved for the end, as asked)

1. Unsplash and Google Civic keys were committed to GitHub by the old build. Rotating them needs the Unsplash and Google Cloud logins for this venture; which Chrome profile holds them? (Until then the exposed Unsplash key keeps working but anyone who read the old repo can burn its quota.)
2. Rate limit on the POST API routes: the Free plan allows one rate limiting rule and Cloudflare's default "Leaked credential check" occupies it. Replace it with an API rate limit, or leave as is? (Leaving it is fine; every POST route validates and dedupes in code.)
3. The three unused TWILIO_* secrets on dailyborg-ingest: delete them, or keep for a future WhatsApp edition?
4. The old folder `Desktop/antigravity-files/dailyborg` is untouched. Archive it to the Drive and delete, or keep?
5. Design pass (PROJECT-START section 2): send design references and a yes on direction before any visual rework.
6. Real roll-call votes need a free congress.gov API key (request at api.congress.gov/sign-up with pressroom@dailyborg.com).

## To-do list (Dr. Cato, 2026-09-05: "put the optional stuff on the to-do list")

- [ ] Rotate `UNSPLASH_ACCESS_KEY` in the Unsplash developer dashboard (old value was committed to GitHub), then `wrangler secret put UNSPLASH_ACCESS_KEY` in workers/ingest and workers/sentinel, and update `_credentials/ingest.dev.vars` on the Drive.
- [ ] Revoke `GOOGLE_CIVIC_API_KEY` in the Google Cloud console (exposed, and the API it served is shut down).
- [x] Confirm `AIML_API_KEY` and `RESEND_API_KEY` exist on dailyborg-ingest. Done 2026-09-05: both present (so are UNSPLASH_ACCESS_KEY and three unused TWILIO_* secrets).
- [ ] Resend: the DNS side is already there (resend._domainkey TXT plus send.dailyborg.com MX and SPF were found in the zone). Open the Resend dashboard once to confirm the domain shows Verified. Needs the Resend login.
- [ ] Google Search Console and Bing Webmaster Tools: verify the domain and submit /news-sitemap.xml. Needs a Google and a Microsoft login for this venture; add a DNS TXT record when they ask for one.
- [ ] Optional: congress.gov API key for real roll-call votes (Phase 2).

## Next

- Deployed. Watch the D1 usage graph (Workers & Pages > D1 > dailyborg-db > Metrics) for 48 hours after the 00:00 UTC reset. Expected: under 500,000 rows read per day. Then open /borg-record, one profile, /liar-liar, /borg-record/compare and /admin (passphrase on the Drive) and confirm the roster and rulings filled in.
- Design pass per PROJECT-START section 2 (needs Dr. Cato's design references and a yes on direction).
- Phase 2 candidates: real vote records (congress.gov API needs a free key), local officials source, comparison page rebuilt on real data, blog/SEO pipeline from PROJECT-START section 6.
