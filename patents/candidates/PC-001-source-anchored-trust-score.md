# PC-001 Source-anchored trust scoring for public officials

Plain description: a score for a public official computed only from third-party published fact-check rulings, each stored with its source link, with a minimum-evidence threshold before any score is shown, and a history row written only when the score changes.

Technical method: rulings are matched to the official by the fact-checker's own speaker identifier (URL slug), normalized to letters and digits; each ruling maps to a falseness weight (True 0, Mostly True 0.2, Half True 0.5, Mostly False 0.8, False 1, Pants on Fire 1); score = 100 minus the mean weight over the most recent N rulings; suppressed below a minimum count; recomputed only for officials touched by a sync.

Why it may be novel: the combination of source-identifier matching (no name matching, no model), a published falseness scale, an evidence threshold, and change-only history. Prior art to check: PolitiFact scorecards, FactCheck.org, Ballotpedia, academic truthfulness indices.

Alternatives to log: weighting by recency; weighting by fact-checker reputation; combining several fact-check publishers with per-publisher calibration.

Status: candidate. Risk: the scale itself is a simple formula; the strength is in the pipeline and provenance guarantees.
