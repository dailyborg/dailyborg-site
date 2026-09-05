# Deploy runbook (first deploy after the 2026-09-05 takeover)

Do these in order. Every step is safe to repeat. Stop and tell Dr. Cato if any step fails.

## 0. Prerequisites (Dr. Cato)

1. Create a Cloudflare API token for the **Pressroom@dailyborg.com** account with these permissions:
   Account: Workers Scripts (Edit), Workers KV Storage (Edit), Queues (Edit), D1 (Edit), Cloudflare Pages (Edit), Workers R2 Storage (Read); User: User Details (Read).
   Save it on the Drive as `claude\code\dailyborg\_credentials\cloudflare-api-token.txt` (one line, the token only).
2. In the Cloudflare dashboard, Pages project `dailyborg-site` > Settings > Environment variables (Production):
   set `ADMIN_PASSPHRASE` (a long random phrase; admin login uses it), and if wanted `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL=https://dailyborg.com`.

## 1. Authenticate this machine (Claude)

```bash
export CLOUDFLARE_API_TOKEN="$(cat "/c/Users/mrcat/My Drive (tsyborgrunnings@gmail.com)/claude/code/dailyborg/_credentials/cloudflare-api-token.txt")"
npx wrangler whoami
```
Expected: account "Pressroom@dailyborg[.]com's Account". If it shows any other account, STOP.

## 2. Database migration (once)

The old build never used wrangler's migration tracking, so apply the takeover file directly:

```bash
npx wrangler d1 execute dailyborg-db --remote --command "SELECT name FROM pragma_table_info('politicians') WHERE name IN ('bioguide_id','state','source')"
```
- If that returns no rows: `npx wrangler d1 execute dailyborg-db --remote --file=src/migrations/0010_takeover_hardening.sql`
- If it returns rows, the ALTER TABLE lines were already applied; run the file again with the ten `ALTER TABLE politicians ADD COLUMN` lines deleted from a temporary copy.
- Then: `npx wrangler d1 execute dailyborg-db --remote --file=src/migrations/0011_seed_authors.sql` (idempotent, keeps the 25 author bylines).

Verify: `npx wrangler d1 execute dailyborg-db --remote --command "SELECT COUNT(*) AS n, SUM(trustworthiness_score IS NULL) AS unscored FROM politicians"` (unscored should equal n).

## 3. Retire the old workers (they still run and still read the database)

```bash
for w in dailyborg-draft-engine publisher-engine dailyborg-social-publisher dailyborg-delivery dailyborg-image-medic dailyborg-feeder dailyborg-site-feeder; do npx wrangler delete --name "$w" --force || true; done
```
Also delete their queues if they exist: `npx wrangler queues list`, then `npx wrangler queues delete enrichment-queue` and `npx wrangler queues delete processing-queue`.

## 4. Deploy the five workers (in this order, scraper before sentinel because sentinel binds to it)

```bash
(cd workers/scraper && npx wrangler deploy)
(cd workers/sentinel && npx wrangler secret put UNSPLASH_ACCESS_KEY && npx wrangler deploy)   # paste the key from the Drive when prompted
(cd workers/discovery-engine && npx wrangler deploy)
(cd workers/truth-engine && npx wrangler deploy)
(cd workers/ingest && npx wrangler deploy)   # secrets AIML_API_KEY, UNSPLASH_ACCESS_KEY, RESEND_API_KEY should already exist; check with: npx wrangler secret list
```
Confirm exactly five cron triggers exist: `npx wrangler triggers list` is not a command; instead open Workers & Pages in the dashboard and check each worker's Triggers tab. Free plan limit is five.

## 5. Prime the data

```bash
curl "https://dailyborg-discovery.pressroom.workers.dev/?action=federal"     # 539 legislators, about 60 seconds
curl "https://dailyborg-discovery.pressroom.workers.dev/?action=executive"   # President and VP
curl "https://dailyborg-truth.pressroom.workers.dev/?action=sync"            # PolitiFact rulings
curl "https://dailyborg-discovery.pressroom.workers.dev/?action=state"       # one state; the cron does the rest, one per hour
```
Optional: `?action=photos` and `?action=popularity` a few times to fill photos and attention scores faster.

## 6. Deploy the site

```bash
npm run deploy
```
Then open https://dailyborg.com, /borg-record, /borg-record?level=State&state=NY, one politician profile, /borg-record/liar-liar, /borg-record/compare, and /admin (login with ADMIN_PASSPHRASE).

## 7. Watch the budget for 48 hours

Dashboard > Workers & Pages > D1 > dailyborg-db > Metrics. Rows read per day should be well under 1,000,000 (the limit is 5,000,000). If it is not, `docs/STATUS.md` lists every query and its cache TTL.

## 8. Dashboard settings to apply (see docs/CLOUDFLARE-SETTINGS.md)

Cache Rule for HTML, Bot Fight Mode, Browser Integrity Check, Email Routing check for pressroom@ and notifications@dailyborg.com (Resend sender domain must be verified for `notifications@dailyborg.com` and `edition@dailyborg.com`).

## Added 2026-09-05: roll-call votes

1. Apply migration 0012 once: `npx wrangler d1 execute dailyborg-db --remote --file src/migrations/0012_roll_call_votes.sql` (from the project root, Pressroom account). If D1 answers "exceeded daily row read limit", wait for 00:00 UTC and run it again.
2. Deploy the discovery worker: `cd workers/discovery-engine && npx wrangler deploy`. The secret `CONGRESS_API_KEY` is already set; on a new account run `wrangler secret put CONGRESS_API_KEY` with the value from `_credentials/congress_api.txt`.
3. Prime: `curl "https://dailyborg-discovery.pressroom.workers.dev/?action=federal"` (stores senators' LIS ids), then `?action=votes` a few times or just let the hourly cron catch up (3 House and 3 Senate roll calls per hour).
4. Check: `curl "https://dailyborg-discovery.pressroom.workers.dev/"` shows `votes.house_cursor` and `votes.senate_cursor`; a profile such as /borg-record/politicians/<senator-slug> shows the Roll-Call Votes section.
