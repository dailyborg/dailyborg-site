# The Daily Borg

Autonomous newspaper (seven desks, AI-written from wire RSS) plus the Borg Record, a public
accountability index of United States officials built from official rosters and published
PolitiFact rulings. Live at https://dailyborg.com.

Read `CLAUDE.md` first (accounts, rules, folder map), then `docs/STATUS.md`.

## Stack

- Site: Next.js 14 (App Router, edge runtime) on Cloudflare Pages through `@cloudflare/next-on-pages`. Project `dailyborg-site`.
- Data: one Cloudflare D1 database `dailyborg-db`. Schema baseline in `src/schema.sql`, changes in `src/migrations/`.
- Workers (`workers/`): `discovery-engine` (roster sync), `sentinel` (maintenance), `scraper` (RSS to queue), `ingest` (AI writing + briefings), `truth-engine` (PolitiFact rulings).
- Images: R2 bucket `borg-images`; scraper dedup in KV `SENTINEL_CACHE`; `ingest-queue` between scraper and ingest.

## Run locally

```bash
npm install
npm run dev            # Next.js at http://localhost:3000 (no database; pages show their empty states)
npm run check          # TypeScript for the site
npm run check:workers  # TypeScript for every worker
```

To run a worker locally with a local D1 and real outbound network (useful for the discovery sync):

```bash
cd workers/discovery-engine
npx wrangler dev --test-scheduled --local
# then in another terminal:
curl "http://localhost:8787/?action=federal"
```

Local secrets: copy the matching `*.dev.vars` file from the Drive (`claude\code\dailyborg\_credentials`) to `.dev.vars` in the site root or the worker folder. They are gitignored.

## Build and deploy

Deploys need a Cloudflare API token for the Pressroom account. Full order of operations is in
`docs/DEPLOY-RUNBOOK.md`. Short version:

```bash
npx wrangler whoami                                   # must show Pressroom@dailyborg.com
npx wrangler d1 execute dailyborg-db --remote --file=src/migrations/0010_takeover_hardening.sql
for w in discovery-engine sentinel scraper truth-engine ingest; do (cd workers/$w && npx wrangler deploy); done
npm run deploy                                        # builds with next-on-pages and deploys the Pages project
# On Windows, if next-on-pages fails with 'spawn npx ENOENT': npx vercel build --yes && npx @cloudflare/next-on-pages --skip-build
```

## Where things live

See the folder map in `CLAUDE.md`. Every folder has its own `CLAUDE.md` explaining what belongs there.
