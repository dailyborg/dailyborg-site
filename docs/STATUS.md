# Status (updated 2026-09-08, 04:30 UTC, limits and stalled newsroom session)

## Resume here (next session, any machine)

Everything is committed and pushed. Read this block, then `memory/MEMORY.md`.

1. **First check, every session:** the newest approved article must be under 24 hours old.
   `npx wrangler d1 execute dailyborg-db --remote --command "SELECT MAX(publish_date) FROM articles WHERE approval_status='approved'"`
   If it is older than a day, read the last 20 rows of `ingestion_logs` (same command with `SELECT created_at, status, substr(message,1,120) FROM ingestion_logs ORDER BY created_at DESC LIMIT 20`) and fix the cause before anything else.
2. **Were the five workers deployed?** `npx wrangler deployments list` inside each worker folder must show a deployment dated 2026-09-08 or later. If it still shows 2026-09-05, the deploy commands in `docs/DEPLOY-RUNBOOK.md` ("Added 2026-09-08") have not been run yet. Claude cannot run them in auto mode (the permission classifier blocks `wrangler deploy`); Dr. Cato clicks Run on them, or grants the permission rule once.
3. **Budgets:** `wrangler d1 insights dailyborg-db --timePeriod 1d --sort-by writes` should show politician_votes around 1,300 rows an hour at most; the Cloudflare KV graph should be flat at zero; the D1 rows written graph should stay under 60,000 a day.
4. **Pages:** `npx wrangler pages deployment list --project-name dailyborg-site` shows the site build for the latest commit; open https://dailyborg.com/, /politics, one article, /borg-record, /borg-record/politicians/bernie-sanders, /admin.
5. Then the questions and the to-do list at the bottom of this file.

## Where things stand

**Three Cloudflare Free plan limits had been hit, and the newsroom had been silent since 2026-06-12.** All causes are found and fixed in code; migrations 0013 and 0014 are applied to production; the site is deployed from Git; the worker deploys are the one step waiting on Dr. Cato (see Resume here, item 2).

| Problem | Cause | Fix (all in the repo) |
|---|---|---|
| KV daily limit alerts (50 percent, 75 percent) on 2026-09-06 | The scraper wrote one KV key per queued link (about 370 a day in the old build). After the takeover, sentinel saw no article newer than 24 hours and told the scraper to run in deep mode every hour, and deep mode ignored the dedup cache: 908 writes on 2026-09-06 against a limit of 1,000. | KV is removed from the project. Dedup lives in the D1 table `seen_links`, the scraper never queues more than the daily article cap, sentinel triggers it at most every six hours and never in deep mode. |
| D1 "row write limit exceeded" from about 17:00 UTC on 2026-09-06 and 2026-09-07 (every write on the site failed until midnight) | The roll-call vote backfill stored three House roll calls an hour, about 435 member rows each, and every member row also wrote four index rows: about 84,000 of the 100,000 daily rows. State legislator inserts (10 rows each) and the daily federal roster rewrite added the rest. | Migration 0013 dropped four write-only indexes (a House vote now costs about 1,300 rows, not 2,200). Votes store one roll call per chamber per hour inside a 30,000 rows a day counter. Roster syncs only write rows whose values changed. |
| No new articles since 2026-06-12 | `system_settings.ai_provider` is `cloudflare`, and the ingest worker called `@cf/meta/llama-3.1-8b-instruct`, which Cloudflare deprecated on 2026-05-30. Every story failed with error 5028, two log rows each. The paid path (AI/ML API) is also dead: "You've run out of funds". | Model ladder on Workers AI: gpt-oss-120b first, Llama 4 Scout second, both tested live on 2026-09-08 with the real article prompt (about 100 to 120 free neurons per article, 10,000 a day free). A failing model drops to the next; if all fail, one log row says so and sentinel raises a daily "Newsroom stalled" error the admin panel shows as Degraded. |
| Senate votes never started ("Senate vote menu 403" every hour) | senate.gov blocks some Cloudflare egress paths and not others (a manual run succeeded). | Browser headers, one retry, then a quiet skip with one warning a day. Senate votes 1 to 3 are already stored from the manual run. |

**Site audit (two read-only auditors, then four fix workers).** Blockers closed: anyone could mark themselves a paying subscriber; the visit tracker was an open D1 write endpoint; comment identity was a raw subscriber id that anyone knowing an email could reuse; the D1 layer reported success when the binding was missing; the subscribe route was an open email relay; dark mode was broken both ways; every page shared one generic title; `prose` styling was never installed; the admin editorial queue could white-screen on one bad row; desk pages filed real stories under invented section labels; the masthead date was a day off. Full lists with file and line are in the two auditor reports summarized in `docs/DECISIONS.md` (2026-09-08).

**Verified locally on 2026-09-08:** `npm run check:workers` clean, `npx tsc --noEmit` clean, `npm run build` (Next.js) clean with every route, local D1 rehearsals of the scraper budget, the discovery unchanged-row skip, the votes budget counter, the UNION search plan (both new indexes used, "sand" finds Bernie Sanders), the comment token round trip, and the model replies for the two Workers AI models.

**Production changes made this session:** migration 0013 (seen_links, four indexes dropped) and 0014 (unsubscribe_token, two search indexes) applied; two commits pushed (7a192f8 workers and docs, then the site commit); nothing deleted.

## What needs Dr. Cato (batched)

1. **Deploy the five workers** (the runbook has one Run button per worker). Until then the old code keeps running: articles keep failing, and the D1 write limit will be hit again around 12:00 UTC each day.
2. **Yes or no to deleting the KV namespace** `dailyborg-scraper-SENTINEL_CACHE` in the dashboard (Workers and Pages, KV). Nothing uses it now; leaving it costs nothing.
3. **Yes or no to deleting one duplicate ruling row:** Byron Donalds, 2026-08-27, rating false, the Spanish edition (`sarampion-brote-inmigracion-vacuna-florida`). It double counts in his score until removed. New Spanish editions are now skipped automatically.
4. **AI/ML API:** the account has no funds. It is not needed (Workers AI is free and working). Top it up only if the Gemini writing quality is wanted back; then set `ai_provider` to `aiml` in the admin panel.
5. **robots.txt AI policy:** Cloudflare's managed robots.txt currently blocks GPTBot, ClaudeBot, CCBot, Google-Extended and others, which contradicts the "answer engines may cite the site" decision of 2026-09-05. It is a dashboard toggle (AI Crawl Control). Decide, and it is a two-minute change in the Pressroom profile.
6. **Zone cache rule Browser TTL:** the rule added on 2026-09-05 sets a four-hour browser TTL on API responses, so a returning reader can see four-hour-old headlines. Set Browser TTL to "respect origin" in the same rule (dashboard).
7. **Permission for future deploys:** either keep clicking Run, or tell Claude to add a settings rule allowing `npx wrangler deploy` in this project.

## To-do list (carried forward)

- [ ] Rotate `UNSPLASH_ACCESS_KEY` (old value is in GitHub history). Steps in the 2026-09-05 notes below.
- [ ] Revoke `GOOGLE_CIVIC_API_KEY` in Google Cloud (harmless while exposed; the API is dead).
- [ ] Resend: confirm the sending domain shows Verified in the Resend dashboard, and whether `RESEND_API_KEY` is set on the Pages project (welcome emails and unsubscribe links need it on the site side).
- [ ] Google Search Console property for dailyborg.com, then submit /sitemap.xml and /news-sitemap.xml.
- [ ] A shared secret between the site, sentinel and the scraper so the scraper's public URL cannot be poked by strangers (bounded today by its daily budget and ten-minute lock).
- [ ] Senate votes through a second source (GovTrack API, keyed by govtrack id) if senate.gov keeps answering 403 to the cron for a week; needs Dr. Cato's yes under the two-source rule.
- [ ] Design pass per PROJECT-START section 2 (needs Dr. Cato's references and a yes on direction).
- [ ] WhatsApp delivery is hidden everywhere until it exists (Twilio secrets are on the ingest worker but nothing sends).
- [ ] Referrer tracking (site_visits has no referrer column) if wanted.

## History: 2026-09-05 takeover session (kept for reference)

DEPLOYED 2026-09-05 (morning, Eastern). Wrangler is logged in on this desktop through OAuth as pressroom@dailyborg.com (no token file; on the laptop run `npx wrangler login` once and click Authorize in the Pressroom Chrome profile).

- Migration 0010 applied to production (demo rows, random scores and mock votes gone; all indexes exist). Migration 0011 seeds the 25 author bylines. Migration 0012 added the roll-call vote columns and `politicians.lis_id`.
- Five workers on their schedules: discovery :05 hourly, sentinel :20 hourly, scraper :50 every 2h, truth :40 every 6h, ingest 08:00 UTC daily. The old image-medic worker was deleted; the old discovery Durable Object class removed. The publisher, social-publisher, delivery, draft-engine and feeder workers had never been deployed.
- The Pages project is Git-connected: every push to main builds and deploys the site. ADMIN_PASSPHRASE is set on the project (value in `_credentials/admin-passphrase.txt` on the Drive).
- Full database backup before the migration: `claude/code/dailyborg/backups/dailyborg-db-before-takeover-2026-09-05.sql` on the Drive (58 MB, contains subscriber emails, keep private).
- Cloudflare dashboard (Pressroom Chrome profile, detail in docs/CLOUDFLARE-SETTINGS.md): cache rule for public API responses (HIT confirmed), SSL Full (strict), Always Use HTTPS, Minimum TLS 1.2, Early Hints, Bot Fight Mode, Browser Integrity Check, www.dailyborg.com redirecting 301 to the apex, Web Analytics on. No rate limiting rule (the Free plan slot is taken by the default leaked-credential rule).
- Secrets confirmed on dailyborg-ingest: AIML_API_KEY, RESEND_API_KEY, UNSPLASH_ACCESS_KEY (plus three unused TWILIO_* leftovers). sentinel-engine has UNSPLASH_ACCESS_KEY. dailyborg-discovery has CONGRESS_API_KEY.
- Root causes found that day: D1 rows read exhausted by the old workers' full scans every 15 minutes; wrong politicians from last-name matching and an 8B model inventing offices, random trust scores, mock votes. All replaced by structured sources (congress-legislators, executive.json, OpenStates, Wikidata, PolitiFact, House Clerk and Senate XML cross-checked with congress.gov and the Senate vote menu).
- Unsplash key rotation steps: sign in at unsplash.com/login (account details in the Drive registry), open unsplash.com/oauth/applications, create a new application, copy its Access Key into `_credentials/ingest.dev.vars` on the Drive, then Claude runs `wrangler secret put UNSPLASH_ACCESS_KEY` in workers/ingest and workers/sentinel and the old application gets deleted.
