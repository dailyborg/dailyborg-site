# workers/

The five Cloudflare Workers. Each folder has its own wrangler.jsonc, package.json and tsconfig.json and deploys on its own with `npx wrangler deploy` from inside the folder. All five share the one D1 database. Five cron triggers in total is the Free plan limit; do not add a sixth without removing one.

| Folder | Worker name | Cron | Job |
|---|---|---|---|
| discovery-engine | dailyborg-discovery | hourly at :05 | roster sync from public datasets, reader requests, popularity, photos |
| sentinel | sentinel-engine | hourly at :20 | coverage check, image repair, daily pruning |
| scraper | dailyborg-scraper | every 2 hours at :50 | RSS to ingest-queue |
| ingest | dailyborg-ingest | daily 08:00 UTC (briefings) plus queue consumer | article writing via AIML, email and WhatsApp briefings |
| truth-engine | dailyborg-truth | every 6 hours at :40 | PolitiFact rulings and trust scores |

Type check everything with `npm run check:workers` from the project root. Bundle check offline with `npx wrangler deploy --dry-run --outdir=/tmp/x` inside a worker folder.
