# workers/sentinel (sentinel-engine)

Hourly maintenance: coverage per desk (index backed), scraper trigger through a service binding at most once every six hours and never in deep mode, a once-a-day stall alert when the newest approved article is more than 24 hours old (cleared with a "healed" row when publishing resumes), free Unsplash hero image repair (5 per run), and daily pruning of logs, visits, old history, the scraper's `seen_links` rows past 30 days and failure log rows past 7. Secret: UNSPLASH_ACCESS_KEY (optional). POST /__run_check runs a pass now.
