# src/migrations/

Numbered D1 SQL files. 0001 to 0009 are the legacy migrations (applied ad hoc on production before the takeover, not through wrangler migration tracking). 0010 is the takeover hardening file, written to be safe to run once on production; 0011 seeds the 25 author bylines (idempotent). Apply on production with `wrangler d1 execute dailyborg-db --remote --file=...` as docs/DEPLOY-RUNBOOK.md describes. Local rehearsal: schema.sql, then 0003, 0004_borg_alerts, 0007, 0008, 0009, 0010, 0011.
- `0012_roll_call_votes.sql` (2026-09-05): vote metadata and verification columns, `politicians.lis_id`, indexes for the votes tables.
- `0013_budget_hardening.sql` (2026-09-08): `seen_links` table (the scraper's link dedup, moved out of Workers KV) and the removal of four indexes that only cost writes (two duplicates of the politician_votes primary key, politicians.country, articles.social_published). Written after the KV write limit and the D1 row write limit were both exceeded.
- `0014_site_hardening.sql` (2026-09-08): `subscribers.unsubscribe_token` and two case-insensitive indexes on politicians (full name, last word of the name) so the public search reads only matching rows.
