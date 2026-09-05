# workers/discovery-engine (dailyborg-discovery)

Roster sync. Federal from congress-legislators (bioguide id), President and VP from executive.json, state legislators from OpenStates one state per hour, reader requests verified through Wikidata, popularity from Wikipedia pageviews, photos from unitedstates/images, OpenStates and Wikipedia. No model decides anything.
Manual triggers: ?action=federal | executive | state | requests | popularity | photos | all. GET with no action returns sync timestamps.
Local test: `npx wrangler dev --test-scheduled --local --persist-to ../../.wrangler/state` then curl the actions.
