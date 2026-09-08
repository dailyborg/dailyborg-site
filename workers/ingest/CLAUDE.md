# workers/ingest (dailyborg-ingest)

Queue consumer: writes each queued story with a language model, finds a hero image (Wikimedia, Unsplash, then Nano Banana 2), inserts the article as approved, and logs to ingestion_logs. Hard daily cap from system_settings.daily_article_cap (default 40). The daily cron sends the email and WhatsApp briefing (src/delivery.ts); the Friday run is the weekly edition. Uses the `agents` package resolved from the root node_modules (run `npm install` at the project root first).

Which model writes the story depends on system_settings.ai_provider:

- `cloudflare` (the default in production) walks a Workers AI ladder on the `AI` binding. First `@cf/openai/gpt-oss-120b` through the Responses API shape, then `@cf/meta/llama-4-scout-17b-16e-instruct` through chat completions with a json_schema response format. Both are asked for one JSON article object; the first model that returns a parseable object with a title and contentHtml wins. Failed attempts go to console only, so a story that fails on every model writes exactly ONE ingestion_logs row, status `failed`, message "AI failed on every model: ...". The old `@cf/meta/llama-3.1-8b-instruct` was deprecated by Cloudflare on 2026-05-30 and must never come back.
- `aiml` calls Gemini through the AI/ML API and needs a funded AI/ML account. When the API answers 401 or 403 with "run out of funds", the log message starts with "AI/ML API account has no funds:" so the admin panel says what is actually wrong.

Row shape on insert: `article_type` is `standard` for every published article (`draft` only for drafts), because delivery.ts and the breaking badge filter on `article_type IN ('standard', 'breaking')`; the category lives in the `desk` column. `read_time` is computed from the contentHtml word count at 200 words per minute, minimum 1. The slug is sanitized to a-z, 0-9 and dashes, capped at 120 characters, and gets a random 4 character suffix if that slug is already taken, because articles.slug is UNIQUE.

`extractModelText` and `extractJsonObject` in src/index.ts are pure and exported so the reply-parsing logic can be tested without a Cloudflare binding.
Secrets: AIML_API_KEY, UNSPLASH_ACCESS_KEY, RESEND_API_KEY, optional TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_NUMBER.
