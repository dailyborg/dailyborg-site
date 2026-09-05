# workers/truth-engine (dailyborg-truth)

Every six hours reads the PolitiFact fact-check feed, matches the speaker by PolitiFact's own URL slug to our politicians, stores every ruling with its source link, and recomputes trust scores (100 minus average falseness, minimum three rulings). No model involved. ?action=sync runs it now.
