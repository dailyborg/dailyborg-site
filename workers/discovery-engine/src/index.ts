/**
 * dailyborg-discovery
 *
 * Keeps the Borg Record politician roster accurate using authoritative public datasets only.
 * No language model decides who is a politician or which office they hold.
 *
 * Sources
 *   Federal legislators .... unitedstates/congress-legislators, legislators-current.csv, keyed by bioguide_id
 *   President and VP ....... unitedstates/congress-legislators, executive.json
 *   State legislators ...... OpenStates bulk CSV (data.openstates.org/people/current/<st>.csv), keyed by OpenStates id
 *   Reader requests ........ verified against Wikidata "position held" (P39) structured claims
 *   Popularity ............. Wikipedia pageviews API (external, zero D1 reads) plus last-7-day headline mentions
 *   Roll-call votes ........ House Clerk XML cross-checked with congress.gov; Senate XML cross-checked with the Senate vote menu (votes.ts)
 *
 * Runs on ONE hourly cron. Every hourly run does a small, bounded amount of work so the
 * worker stays inside the Cloudflare free tier (CPU per invocation, D1 rows read per day).
 *
 * Manual triggers (GET/POST):  ?action=federal | executive | state | requests | popularity | photos | votes | all
 */

import { Env, USER_AGENT, kvGet, kvSet, isDue, runBatches, log } from "./shared";
import { syncVotes, votesStatus } from "./votes";
export type { Env } from "./shared";

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const CONGRESS_CSV = "https://unitedstates.github.io/congress-legislators/legislators-current.csv";
const EXECUTIVE_JSON = "https://unitedstates.github.io/congress-legislators/executive.json";
const CONGRESS_PHOTO = (bioguide: string) => `https://unitedstates.github.io/images/congress/450x550/${bioguide}.jpg`;
const OPENSTATES_CSV = (st: string) => `https://data.openstates.org/people/current/${st}.csv`;

const US_STATES = [
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", "ia", "ks",
    "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny",
    "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy", "dc", "pr",
];

const STATE_NAME_TO_CODE: Record<string, string> = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
    delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
    kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
    minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
    "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
    oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
    wisconsin: "WI", wyoming: "WY", "district of columbia": "DC", "puerto rico": "PR",
};

// Lower-chamber titles differ by state. Everything not listed is "State Representative".
const LOWER_CHAMBER_TITLE: Record<string, string> = {
    CA: "State Assembly Member", NV: "State Assembly Member", NJ: "State Assembly Member", NY: "State Assembly Member",
    WI: "State Assembly Member", MD: "State Delegate", VA: "State Delegate", WV: "State Delegate",
};

// ------------------------------------------------------------------
// Small utilities
// ------------------------------------------------------------------
export function slugify(name: string): string {
    return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

/** Comparison key: letters and digits only, so "J.D. Vance" and "JD Vance" collide on purpose. */
export function nameKey(name: string): string {
    return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

function normalizeParty(raw: string | undefined | null): string {
    const p = (raw || "").trim();
    if (/^democrat/i.test(p)) return "Democrat";
    if (/^republican/i.test(p)) return "Republican";
    if (/independent|nonpartisan|unaffiliated|^$/i.test(p)) return "Independent";
    return p;
}

/**
 * Regex based CSV parser. Handles quoted fields, embedded commas, embedded newlines and "" escapes.
 * The tokenizer runs inside the regex engine (native code), which keeps CPU time low even for
 * the largest OpenStates file (New Hampshire, about 350 KB).
 */
export function parseCsv(text: string): Record<string, string>[] {
    const rows: string[][] = [];
    let row: string[] = [];
    const re = /("(?:[^"]|"")*"|[^,\r\n]*)(,|\r\n|\n|\r|$)/g;
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length loops
        let field = m[1];
        if (field.startsWith("\"")) field = field.slice(1, -1).replace(/""/g, "\"");
        row.push(field);
        const sep = m[2];
        if (sep !== ",") {
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
            if (sep === "" || re.lastIndex >= text.length) break;
        }
        lastIndex = re.lastIndex;
    }
    if (rows.length === 0) return [];
    const header = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => {
        const obj: Record<string, string> = {};
        header.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
        return obj;
    });
}

function newId(): string {
    return `pol_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Deletes a politician and every child row that references it (used only for exact duplicates). */
function cascadeDelete(env: Env, id: string): D1PreparedStatement[] {
    const tables = ["promises", "positions", "claims", "stance_changes", "trustworthiness_history", "politician_votes", "politician_committees", "statements", "subscriber_politicians"];
    const stmts = tables.map(t => env.DB.prepare(`DELETE FROM ${t} WHERE politician_id = ?`).bind(id));
    stmts.push(env.DB.prepare("DELETE FROM politicians WHERE id = ?").bind(id));
    return stmts;
}

interface ExistingRow { id: string; slug: string; name: string; bioguide_id: string | null; openstates_id: string | null; source: string | null; office_held: string | null; }

// ------------------------------------------------------------------
// 1. Federal legislators (Senate + House) from congress-legislators
// ------------------------------------------------------------------
async function syncFederalRoster(env: Env): Promise<string> {
    const res = await fetch(CONGRESS_CSV, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`congress-legislators fetch failed: ${res.status}`);
    const rows = parseCsv(await res.text());
    if (rows.length < 400) throw new Error(`congress-legislators returned only ${rows.length} rows, refusing to sync`);

    const { results } = await env.DB.prepare(
        "SELECT id, slug, name, bioguide_id, openstates_id, source, office_held FROM politicians WHERE region_level = 'Federal'"
    ).all<ExistingRow>();
    const existing = results || [];
    const byBioguide = new Map<string, ExistingRow>();
    const bySlug = new Map<string, ExistingRow>();
    const byName = new Map<string, ExistingRow>();
    for (const r of existing) {
        if (r.bioguide_id) byBioguide.set(r.bioguide_id, r);
        bySlug.set(r.slug, r);
        byName.set(nameKey(r.name), r);
    }

    const stmts: D1PreparedStatement[] = [];
    const seenBioguide = new Set<string>();
    const claimedRowIds = new Set<string>();
    const rosterNameKeys = new Set<string>();
    let inserted = 0, updated = 0;

    for (const r of rows) {
        const bioguide = r.bioguide_id;
        if (!bioguide) continue;
        seenBioguide.add(bioguide);

        const first = r.nickname || r.first_name;
        const displayName = `${first} ${r.last_name}`.replace(/\s+/g, " ").trim();
        const candidates = [displayName, r.full_name, `${r.first_name} ${r.last_name}`].filter(Boolean);
        candidates.forEach(c => rosterNameKeys.add(nameKey(c)));

        const isSenator = r.type === "sen";
        const office = isSenator ? "U.S. Senator" : "U.S. Representative";
        const districtLabel = isSenator ? r.state : `${r.state}-${(r.district === "0" || r.district === "") ? "AL" : r.district}`;
        const party = normalizeParty(r.party);
        const photo = CONGRESS_PHOTO(bioguide);
        const wikipediaTitle = r.wikipedia_id || null;

        let match: ExistingRow | undefined = byBioguide.get(bioguide);
        if (!match) match = candidates.map(c => bySlug.get(slugify(c))).find(m => m && !claimedRowIds.has(m.id)) as ExistingRow | undefined;
        if (!match) match = candidates.map(c => byName.get(nameKey(c))).find(m => m && !claimedRowIds.has(m.id)) as ExistingRow | undefined;

        if (match) {
            claimedRowIds.add(match.id);
            stmts.push(env.DB.prepare(`
                UPDATE politicians SET
                    bioguide_id = ?, lis_id = ?, name = ?, office_held = ?, party = ?, district_state = ?, state = ?,
                    region_level = 'Federal', candidate_status = 'Active', source = 'congress-legislators',
                    wikipedia_title = COALESCE(?, wikipedia_title), photo_url = ?, photo_source = 'unitedstates',
                    time_in_office = 'Serving', country = 'US', latest_sync_timestamp = CURRENT_TIMESTAMP
                WHERE id = ?`).bind(bioguide, r.lis_id || null, displayName, office, party, districtLabel, r.state, wikipediaTitle, photo, match.id));
            updated++;
        } else {
            // Slug must be unique. If the plain slug is taken by a non-federal row, suffix the state.
            let slug = slugify(displayName);
            stmts.push(env.DB.prepare(`
                INSERT INTO politicians (id, slug, name, office_held, party, district_state, state, country, region_level,
                    candidate_status, time_in_office, photo_url, photo_source, bioguide_id, lis_id, wikipedia_title, source, latest_sync_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'US', 'Federal', 'Active', 'Serving', ?, 'unitedstates', ?, ?, ?, 'congress-legislators', CURRENT_TIMESTAMP)
                ON CONFLICT(slug) DO UPDATE SET
                    bioguide_id = excluded.bioguide_id, lis_id = excluded.lis_id, office_held = excluded.office_held, party = excluded.party,
                    district_state = excluded.district_state, state = excluded.state, region_level = 'Federal',
                    candidate_status = 'Active', source = 'congress-legislators', photo_url = excluded.photo_url,
                    photo_source = 'unitedstates', wikipedia_title = excluded.wikipedia_title, latest_sync_timestamp = CURRENT_TIMESTAMP`)
                .bind(newId(), slug, displayName, office, party, districtLabel, r.state, photo, bioguide, r.lis_id || null, wikipediaTitle));
            inserted++;
        }
    }

    // Anyone we track as a sitting federal legislator who is no longer in the roster has left office.
    for (const r of existing) {
        if (claimedRowIds.has(r.id)) continue;
        const wasLegislator = r.source === "congress-legislators" || (r.bioguide_id && !seenBioguide.has(r.bioguide_id));
        const isLegislatorTitle = /u\.?s\.? (senat|represent|house|congress)/i.test(r.office_held || "");
        if (wasLegislator || (r.source === "legacy" && isLegislatorTitle && !rosterNameKeys.has(nameKey(r.name)))) {
            stmts.push(env.DB.prepare("UPDATE politicians SET candidate_status = 'Former', time_in_office = 'Term Ended', latest_sync_timestamp = CURRENT_TIMESTAMP WHERE id = ? AND candidate_status <> 'Former'").bind(r.id));
        }
    }

    // Exact duplicates left behind by the old last-name matcher: a legacy federal row whose name matches a
    // roster member that was matched to a different row. Remove the orphan and its children.
    for (const r of existing) {
        if (claimedRowIds.has(r.id) || r.bioguide_id) continue;
        if (r.source === "legacy" && rosterNameKeys.has(nameKey(r.name))) {
            stmts.push(...cascadeDelete(env, r.id));
        }
    }

    await runBatches(env, stmts);
    await kvSet(env, "federal_roster_synced_at", new Date().toISOString());
    const msg = `Federal roster synced: ${rows.length} legislators, ${inserted} inserted, ${updated} updated`;
    await log(env, "healthy", msg);
    return msg;
}

// ------------------------------------------------------------------
// 2. President and Vice President from executive.json
// ------------------------------------------------------------------
async function syncExecutive(env: Env): Promise<string> {
    const res = await fetch(EXECUTIVE_JSON, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`executive.json fetch failed: ${res.status}`);
    const people: any[] = await res.json();
    const today = new Date().toISOString().slice(0, 10);

    const current = people.filter(p => (p.terms || []).some((t: any) => (t.type === "prez" || t.type === "viceprez") && t.start <= today && (!t.end || t.end >= today)));
    if (current.length === 0) throw new Error("executive.json listed no current president or vice president, refusing to sync");

    const { results } = await env.DB.prepare(
        "SELECT id, slug, name, bioguide_id, openstates_id, source, office_held FROM politicians WHERE region_level = 'Federal' AND (source = 'executive' OR office_held LIKE '%President%')"
    ).all<ExistingRow>();
    const existing = results || [];
    const stmts: D1PreparedStatement[] = [];
    const claimed = new Set<string>();

    for (const p of current) {
        const term = p.terms.filter((t: any) => t.start <= today && (!t.end || t.end >= today)).slice(-1)[0];
        const first = p.name.nickname || p.name.first;
        const displayName = p.name.official_full || `${first} ${p.name.last}`;
        const candidates = [displayName, `${p.name.first} ${p.name.last}`, `${first} ${p.name.last}`];
        const office = term.type === "prez" ? "President of the United States" : "Vice President of the United States";
        const party = normalizeParty(term.party);
        const wikipediaTitle = p.id?.wikipedia || null;
        const wikidata = p.id?.wikidata || null;
        const bioguide = p.id?.bioguide || null;

        // Match by bioguide, then by any name candidate (also across the whole table, since the person may
        // have been added earlier as a senator or governor).
        let match = existing.find(r => bioguide && r.bioguide_id === bioguide && !claimed.has(r.id));
        if (!match) {
            const keys = candidates.map(nameKey);
            const anyRow = await env.DB.prepare(`SELECT id, slug, name, bioguide_id, openstates_id, source, office_held FROM politicians WHERE name IN (${candidates.map(() => "?").join(",")}) LIMIT 5`)
                .bind(...candidates).all<ExistingRow>();
            match = (anyRow.results || []).find(r => keys.includes(nameKey(r.name)) && !claimed.has(r.id));
        }

        // Official portrait: congressional photo when the person served in Congress, otherwise the exact Wikipedia page image.
        const photo = bioguide ? CONGRESS_PHOTO(bioguide) : (wikipediaTitle ? await wikipediaThumbnail(wikipediaTitle) : null);
        const photoSource = photo ? (bioguide ? "unitedstates" : "wikipedia") : null;

        if (match) {
            claimed.add(match.id);
            stmts.push(env.DB.prepare(`
                UPDATE politicians SET name = ?, office_held = ?, party = ?, district_state = 'US', state = NULL, region_level = 'Federal',
                    candidate_status = 'Active', source = 'executive', time_in_office = ?, term_start = ?, term_end = ?,
                    wikipedia_title = COALESCE(?, wikipedia_title), wikidata_id = COALESCE(?, wikidata_id), bioguide_id = COALESCE(?, bioguide_id),
                    photo_url = COALESCE(?, photo_url), photo_source = COALESCE(?, photo_source),
                    country = 'US', latest_sync_timestamp = CURRENT_TIMESTAMP
                WHERE id = ?`).bind(displayName, office, party, `Since ${term.start.slice(0, 4)}`, term.start, term.end || null, wikipediaTitle, wikidata, bioguide, photo, photoSource, match.id));
        } else {
            stmts.push(env.DB.prepare(`
                INSERT INTO politicians (id, slug, name, office_held, party, district_state, state, country, region_level, candidate_status,
                    time_in_office, term_start, term_end, wikipedia_title, wikidata_id, bioguide_id, photo_url, photo_source, source, latest_sync_timestamp)
                VALUES (?, ?, ?, ?, ?, 'US', NULL, 'US', 'Federal', 'Active', ?, ?, ?, ?, ?, ?, ?, ?, 'executive', CURRENT_TIMESTAMP)
                ON CONFLICT(slug) DO UPDATE SET office_held = excluded.office_held, party = excluded.party, candidate_status = 'Active',
                    source = 'executive', term_start = excluded.term_start, term_end = excluded.term_end,
                    photo_url = COALESCE(excluded.photo_url, politicians.photo_url), latest_sync_timestamp = CURRENT_TIMESTAMP`)
                .bind(newId(), slugify(displayName), displayName, office, party, `Since ${term.start.slice(0, 4)}`, term.start, term.end || null, wikipediaTitle, wikidata, bioguide, photo, photoSource));
        }
    }

    // Everyone else we hold with a presidential title is a former office holder.
    for (const r of existing) {
        if (claimed.has(r.id)) continue;
        if (/vice president/i.test(r.office_held || "")) {
            stmts.push(env.DB.prepare("UPDATE politicians SET candidate_status = 'Former', office_held = 'Former Vice President of the United States', time_in_office = 'Term Ended', source = COALESCE(source, 'executive') WHERE id = ?").bind(r.id));
        } else if (/president/i.test(r.office_held || "")) {
            stmts.push(env.DB.prepare("UPDATE politicians SET candidate_status = 'Former', office_held = 'Former President of the United States', time_in_office = 'Term Ended', source = COALESCE(source, 'executive') WHERE id = ?").bind(r.id));
        }
    }

    await runBatches(env, stmts);
    await kvSet(env, "executive_synced_at", new Date().toISOString());
    const msg = `Executive branch synced: ${current.map(p => p.name.last).join(", ")}`;
    await log(env, "healthy", msg);
    return msg;
}

// ------------------------------------------------------------------
// 3. State legislators from OpenStates (one state per run)
// ------------------------------------------------------------------
async function syncNextState(env: Env, force = false): Promise<string> {
    const cursorRaw = await kvGet(env, "state_cursor");
    let index = parseInt(cursorRaw || "0", 10);
    if (isNaN(index) || index < 0 || index >= US_STATES.length) index = 0;
    const st = US_STATES[index];
    await kvSet(env, "state_cursor", String((index + 1) % US_STATES.length));

    if (!force && !(await isDue(env, `state_synced_${st}`, 24 * 7))) {
        return `State ${st.toUpperCase()} is fresh, skipped`;
    }

    const res = await fetch(OPENSTATES_CSV(st), { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
        await log(env, "provider_error", `OpenStates CSV for ${st.toUpperCase()} returned ${res.status}`);
        return `OpenStates ${st.toUpperCase()} unavailable (${res.status})`;
    }
    const rows = parseCsv(await res.text());
    if (rows.length < 10) {
        await log(env, "validation_warning", `OpenStates CSV for ${st.toUpperCase()} had only ${rows.length} rows, not applied`);
        return `OpenStates ${st.toUpperCase()} too small, skipped`;
    }

    const ST = st.toUpperCase();
    const { results } = await env.DB.prepare(
        "SELECT id, slug, name, bioguide_id, openstates_id, source, office_held FROM politicians WHERE region_level = 'State' AND state = ?"
    ).bind(ST).all<ExistingRow>();
    const existing = results || [];
    const byOs = new Map<string, ExistingRow>();
    const byName = new Map<string, ExistingRow>();
    for (const r of existing) {
        if (r.openstates_id) byOs.set(r.openstates_id, r);
        byName.set(nameKey(r.name), r);
    }

    const stmts: D1PreparedStatement[] = [];
    const seen = new Set<string>();
    const claimed = new Set<string>();
    let inserted = 0, updated = 0;

    for (const r of rows) {
        const osId = r.id;
        const name = (r.name || "").replace(/\s+/g, " ").trim();
        if (!osId || !name || r.death_date) continue;
        seen.add(osId);

        const chamber = (r.current_chamber || "").toLowerCase();
        const office = chamber === "upper" ? "State Senator"
            : chamber === "lower" ? (LOWER_CHAMBER_TITLE[ST] || "State Representative")
            : chamber === "legislature" ? "State Senator"
            : "State Legislator";
        const district = (r.current_district || "").trim();
        const districtLabel = district ? (district.length <= 6 ? `${ST}-${district}` : `${ST} ${district}`.slice(0, 40)) : ST;
        const party = normalizeParty(r.current_party);
        const photo = /^https?:\/\//.test(r.image || "") ? r.image : null;
        const wikidata = r.wikidata || null;

        let match = byOs.get(osId);
        if (!match) { const m = byName.get(nameKey(name)); if (m && !claimed.has(m.id)) match = m; }

        if (match) {
            claimed.add(match.id);
            stmts.push(env.DB.prepare(`
                UPDATE politicians SET openstates_id = ?, name = ?, office_held = ?, party = ?, district_state = ?, state = ?, region_level = 'State',
                    candidate_status = 'Active', source = 'openstates', photo_url = COALESCE(?, photo_url),
                    photo_source = CASE WHEN ? IS NOT NULL THEN 'openstates' ELSE photo_source END,
                    wikidata_id = COALESCE(?, wikidata_id), time_in_office = 'Serving', country = 'US', latest_sync_timestamp = CURRENT_TIMESTAMP
                WHERE id = ?`).bind(osId, name, office, party, districtLabel, ST, photo, photo, wikidata, match.id));
            updated++;
        } else {
            // State slugs carry the state code so two "John Smith"s in different states never collide.
            const slug = `${slugify(name)}-${st}`;
            stmts.push(env.DB.prepare(`
                INSERT INTO politicians (id, slug, name, office_held, party, district_state, state, country, region_level, candidate_status,
                    time_in_office, photo_url, photo_source, openstates_id, wikidata_id, source, latest_sync_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'US', 'State', 'Active', 'Serving', ?, ?, ?, ?, 'openstates', CURRENT_TIMESTAMP)
                ON CONFLICT(slug) DO UPDATE SET openstates_id = excluded.openstates_id, office_held = excluded.office_held, party = excluded.party,
                    district_state = excluded.district_state, candidate_status = 'Active', source = 'openstates',
                    photo_url = COALESCE(excluded.photo_url, politicians.photo_url), latest_sync_timestamp = CURRENT_TIMESTAMP`)
                .bind(newId(), slug, name, office, party, districtLabel, ST, photo, photo ? "openstates" : null, osId, wikidata));
            inserted++;
        }
    }

    for (const r of existing) {
        if (claimed.has(r.id)) continue;
        if (r.source === "openstates" || r.openstates_id) {
            stmts.push(env.DB.prepare("UPDATE politicians SET candidate_status = 'Former', time_in_office = 'Term Ended', latest_sync_timestamp = CURRENT_TIMESTAMP WHERE id = ? AND candidate_status <> 'Former'").bind(r.id));
        }
    }

    await runBatches(env, stmts);
    await kvSet(env, `state_synced_${st}`, new Date().toISOString());
    const msg = `State ${ST} synced: ${rows.length} legislators, ${inserted} inserted, ${updated} updated`;
    await log(env, "healthy", msg);
    return msg;
}

// ------------------------------------------------------------------
// 4. Reader requests, verified against Wikidata structured data
// ------------------------------------------------------------------
interface VerifiedOfficial {
    name: string; office: string; level: "Federal" | "State" | "Local"; state: string | null; district: string;
    party: string; wikidataId: string; wikipediaTitle: string | null; summary: string;
}

async function wikidata(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams({ ...params, format: "json", origin: "*" }).toString();
    const res = await fetch(`https://www.wikidata.org/w/api.php?${qs}`, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`wikidata ${params.action} ${res.status}`);
    return res.json();
}

export function classifyOffice(label: string): { office: string; level: "Federal" | "State" | "Local"; state: string | null; district: string } | null {
    const l = label.trim();
    const stateOf = (s: string | undefined) => (s ? STATE_NAME_TO_CODE[s.toLowerCase().trim()] || null : null);
    let m: RegExpMatchArray | null;
    if (/^president of the united states$/i.test(l)) return { office: "President of the United States", level: "Federal", state: null, district: "US" };
    if (/^vice president of the united states$/i.test(l)) return { office: "Vice President of the United States", level: "Federal", state: null, district: "US" };
    if ((m = l.match(/^united states senator from (.+)$/i))) { const s = stateOf(m[1]); return { office: "U.S. Senator", level: "Federal", state: s, district: s || "US" }; }
    if (/^member of the united states house of representatives/i.test(l)) return { office: "U.S. Representative", level: "Federal", state: null, district: "US" };
    if ((m = l.match(/^united states secretary of (.+)$/i))) return { office: `U.S. Secretary of ${m[1]}`, level: "Federal", state: null, district: "US" };
    if ((m = l.match(/^governor of (.+)$/i))) { const s = stateOf(m[1]); if (s) return { office: "Governor", level: "State", state: s, district: s }; }
    if ((m = l.match(/^lieutenant governor of (.+)$/i))) { const s = stateOf(m[1]); if (s) return { office: "Lieutenant Governor", level: "State", state: s, district: s }; }
    if ((m = l.match(/^attorney general of (.+)$/i))) { const s = stateOf(m[1]); if (s) return { office: "Attorney General", level: "State", state: s, district: s }; }
    if ((m = l.match(/^secretary of state of (.+)$/i))) { const s = stateOf(m[1]); if (s) return { office: "Secretary of State", level: "State", state: s, district: s }; }
    if ((m = l.match(/^member of the (.+?) (state )?senate$/i))) { const s = stateOf(m[1]); if (s) return { office: "State Senator", level: "State", state: s, district: s }; }
    if ((m = l.match(/^member of the (.+?) (house of representatives|house of delegates|state assembly|general assembly|assembly|legislature)$/i))) { const s = stateOf(m[1]); if (s) return { office: LOWER_CHAMBER_TITLE[s] || "State Representative", level: "State", state: s, district: s }; }
    if ((m = l.match(/^mayor of (.+)$/i))) return { office: `Mayor of ${m[1]}`, level: "Local", state: null, district: m[1].slice(0, 40) };
    if ((m = l.match(/^member of the (.+?) city council$/i))) return { office: `${m[1]} City Council Member`, level: "Local", state: null, district: m[1].slice(0, 40) };
    return null;
}

async function verifyViaWikidata(requestedName: string): Promise<{ ok: true; official: VerifiedOfficial } | { ok: false; reason: string }> {
    const search = await wikidata({ action: "wbsearchentities", search: requestedName, language: "en", type: "item", limit: "5" });
    const hits: any[] = search?.search || [];
    if (hits.length === 0) return { ok: false, reason: "No Wikidata entry found for that name" };

    for (const hit of hits) {
        const desc: string = hit.description || "";
        if (!/politician|senator|representative|governor|mayor|congress|legislator|attorney general|secretary of state|council|president/i.test(desc)) continue;

        const claims = await wikidata({ action: "wbgetclaims", entity: hit.id, property: "P39" });
        const positions: any[] = claims?.claims?.P39 || [];
        const currentQids: string[] = [];
        for (const st of positions) {
            const qid = st?.mainsnak?.datavalue?.value?.id;
            const ended = !!st?.qualifiers?.P582;
            if (qid && !ended) currentQids.push(qid);
        }
        if (currentQids.length === 0) continue;

        const ents = await wikidata({ action: "wbgetentities", ids: currentQids.slice(0, 20).join("|"), props: "labels", languages: "en" });
        for (const qid of currentQids) {
            const label: string | undefined = ents?.entities?.[qid]?.labels?.en?.value;
            if (!label) continue;
            const office = classifyOffice(label);
            if (!office) continue;

            // Party (P102) and Wikipedia title (sitelinks) come from the person's own entity.
            const person = await wikidata({ action: "wbgetentities", ids: hit.id, props: "claims|sitelinks", sitefilter: "enwiki" });
            const pEnt = person?.entities?.[hit.id];
            const partyQ: string | undefined = (pEnt?.claims?.P102 || []).filter((c: any) => !c?.qualifiers?.P582)[0]?.mainsnak?.datavalue?.value?.id
                || pEnt?.claims?.P102?.[0]?.mainsnak?.datavalue?.value?.id;
            let party = "Independent";
            if (partyQ) {
                const pe = await wikidata({ action: "wbgetentities", ids: partyQ, props: "labels", languages: "en" });
                party = normalizeParty(pe?.entities?.[partyQ]?.labels?.en?.value);
            }
            const wikipediaTitle: string | null = pEnt?.sitelinks?.enwiki?.title || null;
            return {
                ok: true,
                official: {
                    name: hit.label || requestedName, office: office.office, level: office.level, state: office.state,
                    district: office.district, party, wikidataId: hit.id, wikipediaTitle,
                    summary: `${hit.label} currently holds the office of ${label} according to Wikidata (${hit.id}).`,
                },
            };
        }
    }
    return { ok: false, reason: "Wikidata lists no current United States public office for that name" };
}

async function wikipediaThumbnail(title: string): Promise<string | null> {
    try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) return null;
        const data: any = await res.json();
        const src: string | undefined = data?.originalimage?.source || data?.thumbnail?.source;
        if (!src) return null;
        // Wikipedia appends utm_ query parameters; judge the file type on the path only.
        const path = new URL(src).pathname;
        return /\.(jpe?g|png)$/i.test(path) ? src.split("?")[0] : null;
    } catch { return null; }
}

async function sendRequestEmail(env: Env, to: string, official: VerifiedOfficial, slug: string): Promise<void> {
    if (!env.RESEND_API_KEY || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || to === "sentinel@dailyborg.com") return;
    const html = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #111; border: 2px solid #111; padding: 32px;">
            <p style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; border-bottom: 1px solid #111; padding-bottom: 8px;">The Daily Borg, Borg Record</p>
            <h1 style="font-size: 30px; font-weight: 900; margin: 0 0 16px 0;">Profile added.</h1>
            <p style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #444;">Your request was verified against public records. A Borg Record profile now exists for <strong>${official.name}</strong> (${official.office}, ${official.party}).</p>
            <a href="https://dailyborg.com/borg-record/politicians/${slug}" style="display: inline-block; background-color: #111; color: #fff; text-decoration: none; padding: 14px 22px; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 16px;">View the record</a>
        </div>`;
    try {
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: "The Daily Borg <notifications@dailyborg.com>", to: [to], subject: "Your requested Borg Record profile is live", html }),
        });
    } catch { /* email is best effort */ }
}

async function processRequests(env: Env): Promise<string> {
    const { results } = await env.DB.prepare(
        "SELECT id, requested_name, user_email FROM politician_requests WHERE status = 'Pending' ORDER BY created_at ASC LIMIT 5"
    ).all<{ id: string; requested_name: string; user_email: string }>();
    const pending = results || [];
    if (pending.length === 0) return "No pending requests";

    let added = 0, rejected = 0;
    for (const req of pending) {
        const name = (req.requested_name || "").replace(/\s+/g, " ").trim();
        try {
            if (name.length < 4 || name.length > 80 || !/^[a-z .,'\-]+$/i.test(name)) {
                await env.DB.prepare("UPDATE politician_requests SET status = 'Rejected', verification_notes = 'Name did not look like a real person name', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(req.id).run();
                rejected++; continue;
            }

            const existing = await env.DB.prepare("SELECT slug FROM politicians WHERE name = ? OR slug = ? LIMIT 1").bind(name, slugify(name)).first<{ slug: string }>();
            if (existing) {
                await env.DB.prepare("UPDATE politician_requests SET status = 'Verified', verification_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(`Already in the Borg Record: /borg-record/politicians/${existing.slug}`, req.id).run();
                continue;
            }

            const verdict = await verifyViaWikidata(name);
            if (!verdict.ok) {
                await env.DB.prepare("UPDATE politician_requests SET status = 'Rejected', verification_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(verdict.reason, req.id).run();
                rejected++; continue;
            }
            const o = verdict.official;
            const dupe = await env.DB.prepare("SELECT slug FROM politicians WHERE name = ? OR slug = ? OR wikidata_id = ? LIMIT 1").bind(o.name, slugify(o.name), o.wikidataId).first<{ slug: string }>();
            if (dupe) {
                await env.DB.prepare("UPDATE politician_requests SET status = 'Verified', verification_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(`Already in the Borg Record: /borg-record/politicians/${dupe.slug}`, req.id).run();
                continue;
            }

            const photo = o.wikipediaTitle ? await wikipediaThumbnail(o.wikipediaTitle) : null;
            let slug = slugify(o.name);
            if (o.level !== "Federal" && o.state) slug = `${slug}-${o.state.toLowerCase()}`;
            const polId = newId();
            await env.DB.batch([
                env.DB.prepare(`
                    INSERT INTO politicians (id, slug, name, office_held, party, district_state, state, country, region_level, candidate_status,
                        time_in_office, photo_url, photo_source, wikidata_id, wikipedia_title, source, latest_sync_timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'US', ?, 'Active', 'Serving', ?, ?, ?, ?, 'request', CURRENT_TIMESTAMP)`)
                    .bind(polId, slug, o.name, o.office, o.party, o.district, o.state, o.level, photo, photo ? "wikipedia" : null, o.wikidataId, o.wikipediaTitle),
                env.DB.prepare("INSERT INTO claims (id, politician_id, type, content, date, context) VALUES (?, ?, 'Fact', ?, DATE('now'), 'Wikidata public record')")
                    .bind(`clm_${crypto.randomUUID().slice(0, 12)}`, polId, o.summary),
                env.DB.prepare("UPDATE politician_requests SET status = 'Verified', verification_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(`Verified via Wikidata ${o.wikidataId}: ${o.office}, ${o.party}`, req.id),
            ]);
            added++;
            await sendRequestEmail(env, req.user_email, o, slug);
        } catch (err: any) {
            await env.DB.prepare("UPDATE politician_requests SET status = 'Rejected', verification_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(`Verification error: ${String(err?.message || err).slice(0, 200)}`, req.id).run();
            rejected++;
        }
    }
    return `Requests processed: ${pending.length} (${added} added, ${rejected} rejected)`;
}

// ------------------------------------------------------------------
// 5. Popularity: Wikipedia pageviews + last-7-day headline mentions
// ------------------------------------------------------------------
async function scorePopularity(env: Env): Promise<string> {
    const { results } = await env.DB.prepare(`
        SELECT id, name, wikipedia_title FROM politicians
        WHERE candidate_status = 'Active' AND (popularity_scored_at IS NULL OR popularity_scored_at < datetime('now', '-30 days'))
        ORDER BY COALESCE(popularity_scored_at, '') ASC, region_level ASC LIMIT 15`).all<{ id: string; name: string; wikipedia_title: string | null }>();
    const batch = results || [];
    if (batch.length === 0) return "Popularity: everyone scored within 30 days";

    const recent = await env.DB.prepare("SELECT title FROM articles WHERE publish_date > datetime('now', '-7 days') AND approval_status = 'approved' LIMIT 400").all<{ title: string }>();
    const titles = (recent.results || []).map(r => r.title.toLowerCase());

    const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

    const stmts: D1PreparedStatement[] = [];
    for (const p of batch) {
        let views = 0;
        try {
            const title = (p.wikipedia_title || p.name).replace(/ /g, "_");
            // Daily granularity: the monthly endpoint rejects any window that is not whole calendar months.
            const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${fmt(start)}/${fmt(end)}`;
            const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
            if (res.ok) {
                const data: any = await res.json();
                views = (data?.items || []).reduce((sum: number, it: any) => sum + (it.views || 0), 0);
            }
        } catch { /* no article, no views */ }
        const nameLc = p.name.toLowerCase();
        const mentions = titles.filter(t => t.includes(nameLc)).length;
        // Log scale so a senator with 40,000 monthly views is not flattened next to a president with 4,000,000.
        const wikiScore = views > 0 ? Math.min(70, Math.round(Math.log10(views + 1) * 12)) : 0;
        const mentionScore = Math.min(30, mentions * 6);
        stmts.push(env.DB.prepare("UPDATE politicians SET popularity_score = ?, popularity_scored_at = CURRENT_TIMESTAMP WHERE id = ?").bind(wikiScore + mentionScore, p.id));
    }
    await runBatches(env, stmts);
    return `Popularity scored for ${batch.length} officials`;
}

// ------------------------------------------------------------------
// 6. Photos for rows that still have none (executive, requests, state rows without an image)
// ------------------------------------------------------------------
async function refreshPhotos(env: Env): Promise<string> {
    const { results } = await env.DB.prepare(`
        SELECT id, name, wikipedia_title, bioguide_id FROM politicians
        WHERE (photo_url IS NULL OR photo_url = '') AND candidate_status = 'Active'
          AND (photo_source IS NULL OR (photo_source = 'none' AND wikipedia_title IS NOT NULL))
        ORDER BY region_level ASC LIMIT 10`).all<{ id: string; name: string; wikipedia_title: string | null; bioguide_id: string | null }>();
    const batch = results || [];
    if (batch.length === 0) return "Photos: nothing missing";
    const stmts: D1PreparedStatement[] = [];
    for (const p of batch) {
        // Only exact identifiers are used. A name search on Wikipedia could return a different person with
        // the same name, which is exactly the class of error this rebuild removes.
        let url: string | null = null; let source = "none";
        if (p.bioguide_id) { url = CONGRESS_PHOTO(p.bioguide_id); source = "unitedstates"; }
        else if (p.wikipedia_title) { url = await wikipediaThumbnail(p.wikipedia_title); source = url ? "wikipedia" : "none"; }
        stmts.push(env.DB.prepare("UPDATE politicians SET photo_url = ?, photo_source = ? WHERE id = ?").bind(url, source, p.id));
    }
    await runBatches(env, stmts);
    return `Photos resolved for ${batch.length} officials`;
}

// ------------------------------------------------------------------
// Orchestration
// ------------------------------------------------------------------
async function hourly(env: Env): Promise<string[]> {
    const out: string[] = [];
    const step = async (label: string, fn: () => Promise<string>) => {
        try { out.push(await fn()); }
        catch (e: any) { const msg = `${label} failed: ${e?.message || e}`; out.push(msg); await log(env, "provider_error", msg); }
    };
    await step("requests", () => processRequests(env));
    if (await isDue(env, "federal_roster_synced_at", 20)) await step("federal", () => syncFederalRoster(env));
    if (await isDue(env, "executive_synced_at", 20)) await step("executive", () => syncExecutive(env));
    await step("state", () => syncNextState(env));
    await step("popularity", () => scorePopularity(env));
    await step("photos", () => refreshPhotos(env));
    await step("votes", () => syncVotes(env));
    return out;
}

export default {
    async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(hourly(env).then(lines => console.log("[discovery]", lines.join(" | "))));
    },

    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "status";
        try {
            let lines: string[] = [];
            if (action === "federal") lines = [await syncFederalRoster(env)];
            else if (action === "executive") lines = [await syncExecutive(env)];
            else if (action === "state") lines = [await syncNextState(env, true)];
            else if (action === "requests") lines = [await processRequests(env)];
            else if (action === "popularity") lines = [await scorePopularity(env)];
            else if (action === "photos") lines = [await refreshPhotos(env)];
            else if (action === "votes") lines = [await syncVotes(env)];
            else if (action === "all") lines = await hourly(env);
            else {
                const fed = await kvGet(env, "federal_roster_synced_at");
                const exec = await kvGet(env, "executive_synced_at");
                const cursor = await kvGet(env, "state_cursor");
                return Response.json({ worker: "dailyborg-discovery", federal_roster_synced_at: fed, executive_synced_at: exec, state_cursor: cursor, votes: await votesStatus(env), actions: ["federal", "executive", "state", "requests", "popularity", "photos", "votes", "all"] });
            }
            return Response.json({ ok: true, action, result: lines });
        } catch (e: any) {
            return Response.json({ ok: false, action, error: String(e?.message || e) }, { status: 500 });
        }
    },
};
