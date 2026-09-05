# Status (updated 2026-09-05, takeover session)

## Where things stand

The Antigravity build was audited end to end (site, workers, database, config, git) and rebuilt in place in this folder. Code is ready. Nothing has been deployed yet because this machine has no Cloudflare login for the Pressroom account (`npx wrangler whoami` says "Not logged in"). GitHub push works.

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

## Blocked on Dr. Cato

1. Cloudflare API token for the Pressroom account (save as `_credentials/cloudflare-api-token.txt` on the Drive). Then run `docs/DEPLOY-RUNBOOK.md` top to bottom.
2. Set `ADMIN_PASSPHRASE` in the Pages project environment variables (admin login will not work until then).
3. Rotate `UNSPLASH_ACCESS_KEY` and revoke `GOOGLE_CIVIC_API_KEY` (both were committed to GitHub by the old build).
4. Decide on a dedicated GitHub sign-in for this project: pushes currently authenticate with an SSH key that belongs to the `borgmobile` GitHub account.

## Next

- Deploy (runbook), then watch the D1 usage graph for 48 hours. Expected: under 500,000 rows read per day.
- Design pass per PROJECT-START section 2 (needs Dr. Cato's design references and a yes on direction).
- Phase 2 candidates: real vote records (congress.gov API needs a free key), local officials source, comparison page rebuilt on real data, blog/SEO pipeline from PROJECT-START section 6.
