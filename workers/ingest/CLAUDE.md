# workers/ingest (dailyborg-ingest)

Queue consumer: writes each queued story with Gemini 3 Flash through the AI/ML API, finds a hero image (Wikimedia, Unsplash, then Nano Banana 2), inserts the article as approved, and logs to ingestion_logs. Hard daily cap from system_settings.daily_article_cap (default 40). The daily cron sends the email and WhatsApp briefing (src/delivery.ts); the Friday run is the weekly edition. Uses the `agents` package resolved from the root node_modules (run `npm install` at the project root first).
Secrets: AIML_API_KEY, UNSPLASH_ACCESS_KEY, RESEND_API_KEY, optional TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_NUMBER.
