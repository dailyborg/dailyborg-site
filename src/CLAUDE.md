# src/

The Next.js 14 site (App Router, edge runtime on Cloudflare Pages).
- app/: routes. Dynamic pages export runtime = "edge". api/ holds the JSON routes; api/admin/* require the ADMIN_PASSPHRASE bearer token.
- components/: React components (layout/ for header, footer and sections; ui/ for primitives).
- lib/: db.ts (D1 binding), cache.ts (edge cache), admin-auth.ts, comment-token.ts (signed commenter tokens), image-utils.ts, utils.ts, services/ (article, author and politician queries). No model calls live in the site; article writing happens in workers/ingest.
- migrations/: D1 SQL, numbered. schema.sql is the original baseline.
Every hot read goes through lib/cache.ts and an index from migrations/0010, 0012 or 0014. Public POST routes validate, bound and rate limit in code (there is no edge rate limiting rule on the Free plan).
