# public/

Static assets served as-is. `_headers` sets a long cache for `/_next/static` and basic security headers; `next.config.mjs` sets the same security headers on every dynamic route.

- `dailyborg-logo2.png` the original 1024px mascot artwork (1.7 MB). Kept as the master; nothing on the site loads it.
- `dailyborg-logo-512.png` the 512px version the masthead and the JSON-LD publisher logo actually use.
- `og-default.png` the 1200x630 social sharing card (cream ground, wordmark, mascot). Used by every page that has no hero image of its own.
- `images/` maintenance art and a placeholder politician portrait.

The Next.js starter SVGs (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) were deleted on 2026-09-07; nothing referenced them.
