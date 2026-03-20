Daily Borg — Development Rules & Guardrails
If you find that you need to make any changes that contradict any of these rules, be sure to stop and check with me first. Confirm and explain why you need to change the rules or why you need to go against the rules. Also explain when you do go against the rules. When you stop to explain, explain how you will ensure that you don't break anything and what you will do and what we need to do to update the rules going further and forward. 🔴 Identity & Naming (NEVER get wrong)
Cloudflare Pages project name: dailyborg-site — ALWAYS. Never dailyborg, never borg-mobile, never anything else.
GitHub repository: dailyborg/dailyborg-site
D1 Database ID: c412efcd-54d8-47a6-9ca5-8522417992c3 — This is the ONE production database. Never create a new one.
D1 Database Name: dailyborg-db
D1 Binding Name in Dashboard: DB
Worker Names:
Ingest worker: dailyborg-ingest
Feeder worker: dailyborg-site-feeder
Domain: dailyborg.com (also dailyborg-site.pages.dev)

🔴 AI/ML Specification (ULTRA-FAST GRID)
- **Text Ingest & Analysis**: ALWAYS use **Gemini 3 Flash**. Never use 1.5 Pro unless explicitly asked for deep historical research that Flash cannot handle.
- **Image Generation**: ALWAYS use **Nano Banana 2** (Gemini 3.1 Flash Image). Optimized for speed and high-volume grid visuals.
- **Research Capability**: Integrated with **Perplexity AI** (Sonar Pro) for real-time internet scouting with citations.

🔴 Cloudflare Pages — ALWAYS do this
Every server-rendered file MUST have export const runtime = 'edge'; — This includes 

layout.tsx
, 

page.tsx
, API routes, and ANY file that runs server-side code. Without it, the entire site crashes with "Application Error."

layout.tsx
 wraps ALL pages — Any crash in 

layout.tsx
 kills the ENTIRE site, including debug pages. ALWAYS wrap DB calls in 

layout.tsx
 with try-catch.
Build command: npx @cloudflare/next-on-pages (no @1 version suffix)
Build output directory: .vercel/output/static
Framework preset: Next.js
Compatibility flags: nodejs_compat
🔴 Database & Bindings — NEVER create duplicates
Never create a new D1 database. Always use the existing one (c412efcd...).
All workers and the Pages project must point to the SAME D1 database ID.
Verify before any DB operation: Run npx wrangler d1 list and confirm you're targeting c412efcd-54d8-47a6-9ca5-8522417992c3.
The dashboard binding for dailyborg-site must have: Type: D1 database, Name: DB, Value: dailyborg-db
🔴 Code Safety — ALWAYS do this
Every DB query must be wrapped in try-catch. Never let an unhandled DB error crash a page.
Never use 

(env as any).['property']
 syntax — it's invalid TypeScript. Use 

(env as any)['property']
 (no dot before bracket).
Always stage AND commit before pushing. PowerShell does not support && chains — run git add, git commit, and git push as THREE SEPARATE commands.
After any code change, verify there are no TypeScript/syntax errors before pushing. A failed Cloudflare build wastes a build minute and delays deployment.
🔴 Deployment — NEVER skip these checks
After pushing, always verify the push landed: git ls-remote origin main — compare the hash to git log -n 1 --oneline.
Check git status after commit — if files still show as "modified," the commit didn't include them.
Never assume a push triggered a build — always check the Cloudflare Deployments tab.
PowerShell command chaining: Use ; instead of &&, or run commands separately. && fails silently in PowerShell.
🟡 Architecture Awareness
The site is Next.js 14 on Cloudflare Pages using @cloudflare/next-on-pages.
Dynamic pages need BOTH: export const runtime = 'edge' AND export const dynamic = 'force-dynamic' (if you want no caching).
Static pages (about, careers, etc.) don't need edge runtime — they're pre-rendered at build time.
The 

wrangler.toml
 in the root is for Pages — it needs pages_build_output_dir to be recognized by Cloudflare's build system. If it doesn't have it, Cloudflare logs a warning but continues.
Three config files exist for three workers: 

wrangler.toml
 (main site), 

wrangler-feeder.json
 (feeder), 

workers/ingest/wrangler.jsonc
 (ingest). ALL must have the same D1 database ID.
🟡 Content & Feed
Articles must have approval_status = 'approved' to appear on the site.
The homepage query filters by approval_status = 'approved' — pending articles won't show.
Images use a fallback system: AI-generated → Unsplash by desk category. Never leave image URLs as https://example.com/....
🟢 Testing Before Declaring Victory
Never claim something works until the live site shows it. Always verify on dailyborg.com, not just in the build log.
Use the /debug page to diagnose runtime issues — it shows the environment keys, DB connection status, and query results.
If the site shows "Application Error", the root cause is almost always a missing runtime = 'edge' or an unhandled exception in a server component.
🟢 Whenever there is an error 
Don't just find the first issue and say you found what the issue is. When you found an issue, make note of it and how to fix. Continue doing an exhaustive check from:
- front end
- back end
- database
- worker
- code
- txt files
- every single thing that must be checked
Then when you've exhausted that and you found all issues, you can work on solutions.Make sure that anything you are fixing you also double check to make sure it doesn't cause any future issues, errors, conflicts, gaps, nothing like that. 
🟢 Infrastruture 
We have several core things set up in infrastructure:
- We make sure that there is a data-first truth engine.
- We have a credibility and truth system.
- We ensure that information is real and accurate.
For everything else there's structure. Make sure that when you are implementing changes you're not taking away what we've already done; you're just adding on or fixing. If you're about to take away anything, you need to stop and let me know. Explain why and how you will make up for the issues or the ones that you are changing.
Note that we're using specific language models through AIML so ensure that we're not changing or including additional models without checking up with me first. Gemini 3 Flash and Gemini 3.1 Flash and Perplexity or Claude workers are being used for different purposes so try to check with me if you need to update anything. 
