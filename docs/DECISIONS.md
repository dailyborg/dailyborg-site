# Decisions (plain language, newest first)

## 2026-09-05, takeover session

**Executed directly instead of dispatching background Workers.** PROJECT-START section 3 describes a Director plus Worker agents. Every fix in this pass touched the same shared files (the migration, the database helper, the worker registry, the politician service), which the "no two Workers on one file" rule would have serialized anyway, and Dr. Cato was not available for roundtables. The Director role (reading everything, deciding the design) was done in full; the typing was done in the same session. Future feature work on separate files should use Workers as written.

**No model decides facts about real people.** Politician identity comes from four structured sources: congress-legislators (federal, keyed by bioguide id), executive.json (President and VP), OpenStates bulk CSV (state legislators, keyed by OpenStates id), and Wikidata "position held" claims (for reader requests). Fact-check rulings come only from PolitiFact and always carry the PolitiFact link. The old code let an 8B model invent offices and invent "lies". That is a defamation risk and it produced the wrong-person bugs. Why it matters: the whole product promise is "the public record, documented". A reader must be able to click through to the source of every claim.

**Trust score = 100 minus the average falseness of the official's PolitiFact rulings, shown only after 3 rulings.** Before, it was a random number between 70 and 90. Officials without enough rulings show "Not enough data", which is honest. The formula is documented on the profile page's methodology block.

**Votes are gone until they are real.** The mock votes (three fixed bills with random Yea/Nay on everyone) were deleted. The congress.gov API can supply real votes but needs a free API key from Dr. Cato. Until then the "Recent Legislative Votes" section says no votes are recorded.

**Five workers, five crons.** The Cloudflare Free plan allows five cron triggers per account. The old build had ten configured across nine workers, some of which could not have been scheduled at all, and worked around it by chaining workers through public workers.dev URLs. Now: discovery (hourly), sentinel (hourly), scraper (every 2 hours), ingest (daily), truth (every 6 hours). Sentinel reaches the scraper through a service binding, not a public URL.

**Retired workers:** draft-engine (duplicate of discovery's request handling, retried forever on duplicate slugs), publisher and social-publisher (pointed at database ids that are not ours, posted to a placeholder webhook and marked articles "published"), delivery (duplicate of ingest's delivery, wrong database id), image-medic (folded into sentinel), feeder-worker plus src/workers/feeder.ts (inserted `claims` rows with no politician, which the schema forbids, so every message failed and retried; also duplicated the article pipeline through two extra queues). The Make.com social publishing idea is kept as a Phase 2 item.

**Hard daily article cap of 40.** Each article costs a Gemini call and possibly an image generation through the AI/ML API. The scraper could queue up to 56 stories an hour. The cap is read from `system_settings.daily_article_cap` so it can be changed in the admin panel later.

**Edge caching through the Cache API, not KV.** The site has no KV binding and adding one needs dashboard access. `caches.default` is available in every Pages Function with no configuration. It is per data center, which is fine at this traffic level. The bigger win is the new indexes: a query that used to scan 3,000 article rows now reads 32.

**Borg Record directory filters on the server.** Sending all politicians to the browser and filtering there meant reading the whole table on every visit. With state legislators the table will hold about 8,000 rows. The page now takes `?level=` and `?state=` and reads only that slice (federal by default), cached for ten minutes.

**Google Civic Information API removed.** Google turned the representatives endpoint off on 2025-04-30. The "enter your address" feature could never work again. The state dropdown stays and is pre-selected from the visitor's Cloudflare region header. A replacement for local officials is a Phase 2 item (options: OpenStates geo lookup with a key, Cicero, Ballotpedia).

**Admin passphrase must be set.** The old routes fell back to a hard-coded password that was in the public repo. There is no fallback now.

**Kept the Next.js 14 + next-on-pages stack.** Cloudflare now recommends OpenNext for new Next.js projects, but a framework migration is not what was asked, and the existing stack builds. Revisit when the design pass happens.

**Windows note for local builds.** `npx @cloudflare/next-on-pages` cannot complete on this Windows desktop: it spawns `npx vercel build` without a shell ("spawn npx ENOENT"), and running `vercel build` by hand then fails creating symlinks ("EPERM ... symlink"), which Windows only allows in Developer Mode or under WSL. `next build` itself passes, and every dynamic route declares the edge runtime, which is what the adapter enforces. Cloudflare's own Pages build runs on Linux and is unaffected. To rehearse the adapter locally, enable Developer Mode in Windows Settings (Privacy and security > For developers) or use WSL.

**Fact-check based scores lean negative.** PolitiFact checks claims that are in doubt, so an official with three rulings will usually score low. That is the honest reading of the data we hold, and the page says exactly how the number is made. Widening the evidence base (more fact-check publishers, vote records) is the way to soften it, not adjusting the formula.

**Secrets in git history.** The three `.dev.vars` files were removed from the tree but the values remain in old commits. Rewriting history on a shared repo is a destructive action, so it was not done. The keys should be rotated instead (listed in STATUS).

**Roll-call votes come from two sources and are cross-checked (Dr. Cato, 2026-09-05).** The congress.gov API (free key, requested by Dr. Cato with pressroom@dailyborg.com) is the primary source for votes, bill titles and summaries. The official House Clerk and Senate roll-call XML feeds are the second source of truth: every vote stored from the API is verified against the XML for the same roll call (same date, chamber, roll number, member bioguide id and position) before it is shown, and disagreements are logged instead of published. No model touches vote data. Phase 2 work; the schema already has `votes` and `politician_votes`.
