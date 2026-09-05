# The Daily Borg (dailyborg.com)

Autonomous newspaper plus the Borg Record, a public accountability index of United States officials.
Owned by Dr. Cato (TSYBORG). Taken over from the Antigravity build on 2026-09-05 by Claude Code.

**Start every session here, then read `docs/STATUS.md` (where things stand, what is next) and `memory/` (project memory).**
Dr. Cato's process rules for every project live on the Drive at `claude\PROJECT-START.md`; read them once per session.

## Accounts and identity (never mix with another project)

| Thing | Value |
|---|---|
| Cloudflare account | Pressroom@dailyborg.com ("Pressroom@dailyborg[.]com's Account", workers.dev subdomain `pressroom`) |
| Cloudflare Pages project | `dailyborg-site` (Next.js 14 via @cloudflare/next-on-pages) |
| Production D1 database | `dailyborg-db`, id `c412efcd-54d8-47a6-9ca5-8522417992c3`. The ONE database. Never create another. |
| R2 bucket | `borg-images` (binding IMAGE_BUCKET) |
| KV namespace | `SENTINEL_CACHE` id `5a2f3f363bce4eceb61dd765686b2dc4` (scraper dedup) |
| Queue | `ingest-queue` (scraper produces, ingest consumes) |
| Workers (5 crons total, the Free plan limit) | `dailyborg-discovery` (hourly), `sentinel-engine` (hourly), `dailyborg-scraper` (every 2h), `dailyborg-ingest` (daily 08:00 UTC), `dailyborg-truth` (every 6h) |
| Domain | dailyborg.com (also dailyborg-site.pages.dev) |
| GitHub | `dailyborg/dailyborg-site` over SSH with the project's own key `~/.ssh/github_new_project` (comment pressroom@dailyborg.com). Git identity: dailyborg / pressroom@dailyborg.com |
| Secrets | ONLY on the tsyborgrunnings Google Drive: `claude\code\dailyborg\_credentials\` (see `SECRETS.md` there). Never in this folder, never in git. |

Before any `wrangler` command that changes something: run `npx wrangler whoami`, confirm the Pressroom account, and confirm the config file names this project.

## How this project travels (desktop and laptop)

- Code: this folder is a clone of the GitHub repo. Sit down: `git pull`. Finish: `git push`.
- After a fresh clone on any machine, point git at the project's own SSH key (a per-repo setting that clones do not carry): `git config core.sshcommand "ssh -i ~/.ssh/github_new_project -F /dev/null"` plus `git config user.name dailyborg` and `git config user.email pressroom@dailyborg.com`. The key pair is mirrored on the Drive at `_credentials/ssh/`; copy it into `~/.ssh/` on the laptop.
- Memory: `memory/` (gitignored) is mirrored to the Drive at `claude\code\dailyborg\memory\`. After editing memory, copy it back to the Drive. After a fresh clone, restore it from the Drive.
- Secrets: read from the Drive when needed. `.dev.vars` files for local dev are copied from `_credentials` on the Drive at that moment and are gitignored.
- Deploys: need `CLOUDFLARE_API_TOKEN` from the Drive (`_credentials/cloudflare-api-token.txt`). As of 2026-09-05 that token does not exist yet; `docs/DEPLOY-RUNBOOK.md` lists exactly what to run once it does.

## Folder map

```
CLAUDE.md                 this file
README.md                 how to run, check, build and deploy
docs/                     STATUS.md, DECISIONS.md, DEPLOY-RUNBOOK.md, CLOUDFLARE-SETTINGS.md, LEGACY-ANTIGRAVITY-RULES.md
memory/                   project memory (gitignored, mirrored to the Drive)
patents/                  patent and trademark candidate log (PROJECT-START section 4)
src/                      the Next.js site: app/ (routes), components/, lib/ (db, cache, services), migrations/ (D1 SQL)
workers/                  the five Cloudflare Workers, one folder each, each with its own wrangler.jsonc
scripts/db-history/       SQL that was already run on production during the April 2026 cleanups (reference only)
public/                   static assets
logo/                     brand source images
```

## Working rules that apply here

- Cloudflare free tier only. The D1 free tier is 5,000,000 rows read per day; this project exceeded it in September 2026 because of unindexed scans in the old workers. Every new query must use an index (see migration 0010) and every hot read on the site goes through `src/lib/cache.ts`.
- No language model decides facts about real people. Politician identities come from congress-legislators, executive.json, OpenStates and Wikidata. Fact-check rulings come only from PolitiFact with a source link. Trust scores are computed from stored rulings, never invented.
- No em dashes anywhere (chat, code, copy, commits). All assets self-hosted where possible; Unsplash and Wikipedia images are the two approved exceptions.
- Never delete data, change DNS, send email, or spend money without Dr. Cato's yes in chat.
- Commit after each completed task with a clear message, then push. Update `docs/STATUS.md` at the end of every session.
