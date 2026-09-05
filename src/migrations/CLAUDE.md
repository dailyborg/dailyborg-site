# src/migrations/

Numbered D1 SQL files. 0001 to 0009 are the legacy migrations (applied ad hoc on production before the takeover, not through wrangler migration tracking). 0010 is the takeover hardening file, written to be safe to run once on production; 0011 seeds the 25 author bylines (idempotent). Apply on production with `wrangler d1 execute dailyborg-db --remote --file=...` as docs/DEPLOY-RUNBOOK.md describes. Local rehearsal: schema.sql, then 0003, 0004_borg_alerts, 0007, 0008, 0009, 0010, 0011.
