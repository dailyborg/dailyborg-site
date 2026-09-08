# workers/discovery-engine (dailyborg-discovery)

Roster sync. Federal from congress-legislators (bioguide id), President and VP from executive.json, state legislators from OpenStates one state per hour, reader requests verified through Wikidata, popularity from Wikipedia pageviews, photos from unitedstates/images, OpenStates and Wikipedia. No model decides anything.
Manual triggers: ?action=federal | executive | state | requests | popularity | photos | votes | all. GET with no action returns sync timestamps.
Local test: `npx wrangler dev --test-scheduled --local --persist-to ../../.wrangler/state` then curl the actions.

Files: `src/index.ts` (roster, executive, states, requests, popularity, photos), `src/votes.ts` (roll-call votes, two sources cross-checked, needs the CONGRESS_API_KEY secret), `src/shared.ts` (Env and D1 helpers). Local test needs a gitignored `.dev.vars` with `CONGRESS_API_KEY=` copied from the Drive; delete it afterwards.

## D1 write budget

The Free plan allows 100,000 rows written per day for the whole account, and every index adds one written row per insert or update that touches its columns. The account blew past that on 2026-09-06 and 2026-09-07, so this worker is now bounded on both sides.

- **Votes: 30,000 estimated rows per UTC day.** `src/votes.ts` keeps a counter in `kv_store` under `votes_rows_YYYY-MM-DD`. Before each roll call it estimates `5 + statements * 3` rows and refuses to store when that would cross `VOTES_ROWS_PER_DAY`, reporting "votes: daily row budget used (N of 30000), resuming after 00:00 UTC". The counter resets at midnight UTC because the key carries the date; counters older than 7 days are deleted at the start of every `syncVotes` run.
- **One roll call per chamber per hour.** `MAX_PER_RUN = 1` and `MAX_REVERIFY = 1`. After migration 0013 dropped the two redundant `politician_votes` indexes, a member row costs 3 written rows, so a 435-member House vote is about 1,305 rows and a full hourly cycle stays well under the budget.
- **Roster syncs only write rows that changed.** `syncFederalRoster` and `syncNextState` load every column their UPDATE can set, compare it against the incoming value with `sameValue` (NULL, undefined and "" all count as no value), and skip the UPDATE when nothing differs. COALESCE semantics are honoured: a null incoming `wikipedia_title` (federal) or a null photo or wikidata id (state) is not a change. The result line now reads "N inserted, N updated, N unchanged". A quiet day should be 0 updated. Before this, the daily federal sync rewrote all 539 legislators for about 3,339 rows and each weekly state refresh rewrote the whole state.

## senate.gov 403s

senate.gov sits behind Akamai and answers 403 to some Cloudflare egress paths but not others, so the same request can succeed by hand and fail from the cron. `fetchSenate` sends a browser User-Agent plus an XML Accept header and retries once after 2 seconds. If it is still 403 or 429 the step does not throw: it logs a `validation_warning` at most once every 24 hours (`senate_blocked_logged_at` in `kv_store`), pushes "Senate: senate.gov blocked this run (403)" into the run summary and returns. The House sources (clerk.house.gov and congress.gov) are not affected and keep their normal headers.
