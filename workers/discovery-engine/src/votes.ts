/**
 * Roll-call votes for the Borg Record. Two sources, cross-checked, no language model anywhere.
 *
 * House
 *   Document of record: House Clerk XML, https://clerk.house.gov/evs/{year}/roll{NNN}.xml
 *   Second source:      congress.gov API v3, /house-vote/{congress}/{session}/{roll} and .../members
 *   Published only when the result and every member position agree in both. A disagreement is stored as
 *   verification = 'mismatch' with NO member rows, and logged. If congress.gov does not have the vote yet the
 *   Clerk document is stored as 'unverified' (no member rows) and re-checked on later runs.
 *
 * Senate
 *   Document of record: senate.gov per-vote XML, vote_{congress}_{session}_{NNNNN}.xml
 *   Second source:      the Senate vote menu XML for the session (tallies and result per vote number).
 *   congress.gov has no Senate vote endpoint (checked 2026-09-05). The member rows are published only when the
 *   menu tallies, the document tallies and the counted member rows all agree. Labelled 'senate_xml', not
 *   'verified', so the site can say exactly what was checked.
 *
 * Budget: at most MAX_PER_RUN new roll calls per chamber per hourly run (a House vote is about 435 rows), plus
 * up to MAX_REVERIFY re-checks of earlier 'unverified' House votes. Rows read per run: the federal roster
 * (about 540) and a handful of kv_store rows.
 */
import { Env, USER_AGENT, kvGet, kvSet, runBatches, log } from "./shared";

const MAX_PER_RUN = 3;
const MAX_REVERIFY = 2;
const API = "https://api.congress.gov/v3";
const CLERK_XML = (year: number, roll: number) => `https://clerk.house.gov/evs/${year}/roll${String(roll).padStart(3, "0")}.xml`;
const CLERK_PAGE = (year: number, roll: number) => `https://clerk.house.gov/Votes/${year}${roll}`;
const SENATE_MENU = (c: number, s: number) => `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${c}_${s}.xml`;
const SENATE_XML = (c: number, s: number, n: number) => `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${c}${s}/vote_${c}_${s}_${String(n).padStart(5, "0")}.xml`;
const SENATE_PAGE = (c: number, s: number, n: number) => `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${c}${s}/vote_${c}_${s}_${String(n).padStart(5, "0")}.htm`;

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

export interface ParsedVote {
    chamber: "House" | "Senate";
    congress: number;
    session: number;
    roll: number;
    date: string;            // YYYY-MM-DD
    question: string;
    title: string;
    billLabel: string | null;
    voteType: string | null;
    result: string;
    yeas: number;
    nays: number;
    present: number;
    notVoting: number;
    url: string;
    members: Array<{ key: string; position: string }>;   // key = bioguide id (House) or LIS id (Senate)
}

// ------------------------------------------------------------------
// Small parsing helpers (regex on well-formed government XML; Workers have no DOM parser)
// ------------------------------------------------------------------
export function decodeXml(s: string): string {
    return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/\s+/g, " ").trim();
}

export function xmlText(xml: string, tag: string): string {
    const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
    return m ? decodeXml(m[1]) : "";
}

function xmlInt(xml: string, tag: string): number {
    const n = parseInt(xmlText(xml, tag), 10);
    return isNaN(n) ? 0 : n;
}

/** Yea/Aye, Nay/No, Present, Not Voting. Anything else is kept verbatim (it will not match and will not publish). */
export function normalizePosition(raw: string): string {
    const v = decodeXml(raw).toLowerCase();
    if (v === "yea" || v === "aye" || v === "yes") return "Yea";
    if (v === "nay" || v === "no") return "Nay";
    if (v === "present") return "Present";
    if (v === "not voting" || v === "" || v === "absent") return "Not Voting";
    return decodeXml(raw);
}

/** "6-Jan-2026", "January 6, 2026, 06:58 PM", "2026-01-06T14:57:00-05:00" become "2026-01-06" (else ""). */
export function toIsoDate(raw: string): string {
    const s = decodeXml(raw);
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{4})/);
    if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
    m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})/);
    if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
    return "";
}

export function currentCongress(d = new Date()): { congress: number; session: number; year: number } {
    const year = d.getUTCFullYear();
    return { congress: Math.floor((year - 1789) / 2) + 1, session: year % 2 === 1 ? 1 : 2, year };
}

function normResult(r: string): string {
    return r.toLowerCase().replace(/[^a-z]/g, "");
}

// ------------------------------------------------------------------
// House Clerk XML
// ------------------------------------------------------------------
export function parseHouseClerk(xml: string, year: number): ParsedVote | null {
    if (!/<rollcall-vote>/.test(xml)) return null;
    const metaStart = xml.indexOf("<vote-metadata>");
    const metaEnd = xml.indexOf("</vote-metadata>");
    const meta = metaStart >= 0 && metaEnd > metaStart ? xml.slice(metaStart, metaEnd) : xml;
    const roll = xmlInt(meta, "rollcall-num");
    const congress = xmlInt(meta, "congress");
    const sessionRaw = xmlText(meta, "session");
    const session = /^1/.test(sessionRaw) ? 1 : 2;
    const question = xmlText(meta, "vote-question");
    const legis = xmlText(meta, "legis-num");
    const desc = xmlText(meta, "vote-desc");
    const tStart = xml.indexOf("<totals-by-vote>");
    const totals = tStart >= 0 ? xml.slice(tStart, xml.indexOf("</totals-by-vote>", tStart)) : "";
    const members: ParsedVote["members"] = [];
    const re = /<recorded-vote>\s*<legislator\b([^>]*)>[^<]*<\/legislator>\s*<vote>([^<]*)<\/vote>\s*<\/recorded-vote>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
        const id = m[1].match(/name-id="([^"]+)"/);
        if (id) members.push({ key: id[1], position: normalizePosition(m[2]) });
    }
    if (!roll || !congress || members.length === 0) return null;
    const count = (p: string) => members.filter(x => x.position === p).length;
    const hasBill = legis && legis !== "QUORUM";
    return {
        chamber: "House", congress, session, roll,
        date: toIsoDate(xmlText(meta, "action-date")),
        question,
        title: desc || (hasBill ? `${question} on ${legis}` : question),
        billLabel: hasBill ? legis : null,
        voteType: xmlText(meta, "vote-type") || null,
        result: xmlText(meta, "vote-result"),
        yeas: totals ? xmlInt(totals, "yea-total") : count("Yea"),
        nays: totals ? xmlInt(totals, "nay-total") : count("Nay"),
        present: totals ? xmlInt(totals, "present-total") : count("Present"),
        notVoting: totals ? xmlInt(totals, "not-voting-total") : count("Not Voting"),
        url: CLERK_PAGE(year, roll),
        members,
    };
}

// ------------------------------------------------------------------
// Senate XML
// ------------------------------------------------------------------
export function parseSenateVote(xml: string): ParsedVote | null {
    if (!/<roll_call_vote>/.test(xml)) return null;
    const congress = xmlInt(xml, "congress");
    const session = xmlInt(xml, "session");
    const roll = xmlInt(xml, "vote_number");
    const members: ParsedVote["members"] = [];
    const re = /<member>([\s\S]*?)<\/member>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
        const lis = xmlText(m[1], "lis_member_id");
        if (lis) members.push({ key: lis, position: normalizePosition(xmlText(m[1], "vote_cast")) });
    }
    if (!roll || !congress || members.length === 0) return null;
    const cStart = xml.indexOf("<count>");
    const countBlock = cStart >= 0 ? xml.slice(cStart, xml.indexOf("</count>", cStart)) : "";
    const docName = xmlText(xml, "document_name");
    const title = xmlText(xml, "vote_title") || xmlText(xml, "vote_question_text");
    const majority = xmlText(xml, "majority_requirement");
    return {
        chamber: "Senate", congress, session, roll,
        date: toIsoDate(xmlText(xml, "vote_date")),
        question: xmlText(xml, "question") || xmlText(xml, "vote_question_text"),
        title: title.slice(0, 300),
        billLabel: docName || null,
        voteType: majority ? `${majority} majority` : null,
        result: xmlText(xml, "vote_result"),
        yeas: xmlInt(countBlock, "yeas"),
        nays: xmlInt(countBlock, "nays"),
        present: xmlInt(countBlock, "present"),
        notVoting: xmlInt(countBlock, "absent"),
        url: SENATE_PAGE(congress, session, roll),
        members,
    };
}

export interface SenateMenuEntry { number: number; yeas: number; nays: number; result: string; }

export function parseSenateMenu(xml: string): Map<number, SenateMenuEntry> {
    const out = new Map<number, SenateMenuEntry>();
    const re = /<vote>([\s\S]*?)<\/vote>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
        const n = xmlInt(m[1], "vote_number");
        if (!n) continue;
        const tStart = m[1].indexOf("<vote_tally>");
        const tally = tStart >= 0 ? m[1].slice(tStart, m[1].indexOf("</vote_tally>", tStart)) : m[1];
        out.set(n, { number: n, yeas: xmlInt(tally, "yeas"), nays: xmlInt(tally, "nays"), result: xmlText(m[1], "result") });
    }
    return out;
}

// ------------------------------------------------------------------
// congress.gov (second source for the House)
// ------------------------------------------------------------------
interface ApiHouseVote { result: string; members: Map<string, string>; billUrl: string | null; question: string; }

async function fetchApiHouseVote(env: Env, congress: number, session: number, roll: number): Promise<ApiHouseVote | "missing"> {
    if (!env.CONGRESS_API_KEY) throw new Error("CONGRESS_API_KEY is not set");
    const headers = { "User-Agent": USER_AGENT, "X-Api-Key": env.CONGRESS_API_KEY };
    const base = `${API}/house-vote/${congress}/${session}/${roll}`;
    const res = await fetch(`${base}?format=json`, { headers });
    if (res.status === 404) return "missing";
    if (!res.ok) throw new Error(`congress.gov ${res.status} for ${base}`);
    const detail: any = await res.json();
    const v = detail?.houseRollCallVote;
    if (!v) return "missing";
    const members = new Map<string, string>();
    let next: string | null = `${base}/members?format=json&limit=250`;
    for (let page = 0; next && page < 4; page++) {
        const r = await fetch(next, { headers });
        if (!r.ok) throw new Error(`congress.gov members ${r.status} for roll ${roll}`);
        const j: any = await r.json();
        for (const row of j?.houseRollCallVoteMemberVotes?.results || []) {
            if (row?.bioguideID) members.set(String(row.bioguideID), normalizePosition(String(row.voteCast || "")));
        }
        next = j?.pagination?.next ? String(j.pagination.next).replace(/([?&])api_key=[^&]*/, "$1") : null;
    }
    return { result: String(v.result || ""), members, billUrl: v.legislationUrl ? String(v.legislationUrl) : null, question: String(v.voteQuestion || "") };
}

/** Compares the Clerk document with congress.gov. Returns "" when they agree, else a short reason. */
export function compareHouse(clerk: ParsedVote, api: ApiHouseVote): string {
    if (normResult(clerk.result) !== normResult(api.result)) return `result differs (clerk "${clerk.result}", congress.gov "${api.result}")`;
    let differ = 0, missing = 0;
    for (const m of clerk.members) {
        const other = api.members.get(m.key);
        if (other === undefined) missing++;
        else if (other !== m.position) differ++;
    }
    const extra = api.members.size - (clerk.members.length - missing);
    if (differ || missing || extra) return `member positions differ: ${differ} different, ${missing} missing from congress.gov, ${extra} extra in congress.gov`;
    return "";
}

// ------------------------------------------------------------------
// Storage
// ------------------------------------------------------------------
type Verification = "verified" | "senate_xml" | "mismatch" | "unverified";

function voteId(v: ParsedVote): string {
    return `v_${v.chamber.toLowerCase()}_${v.congress}_${v.session}_${String(v.roll).padStart(v.chamber === "House" ? 3 : 5, "0")}`;
}

interface Roster { byBioguide: Map<string, string>; byLis: Map<string, string>; }

async function loadRoster(env: Env): Promise<Roster> {
    const { results } = await env.DB.prepare(
        "SELECT id, bioguide_id, lis_id FROM politicians WHERE region_level = 'Federal' AND candidate_status = 'Active' AND (bioguide_id IS NOT NULL OR lis_id IS NOT NULL)"
    ).all<{ id: string; bioguide_id: string | null; lis_id: string | null }>();
    const byBioguide = new Map<string, string>();
    const byLis = new Map<string, string>();
    for (const r of results || []) {
        if (r.bioguide_id) byBioguide.set(r.bioguide_id, r.id);
        if (r.lis_id) byLis.set(r.lis_id, r.id);
    }
    return { byBioguide, byLis };
}

function published(v: Verification): boolean {
    return v === "verified" || v === "senate_xml";
}

function voteStatements(env: Env, v: ParsedVote, verification: Verification, note: string, secondaryUrl: string | null, roster: Roster): { stmts: D1PreparedStatement[]; matched: number; unmatched: number } {
    const id = voteId(v);
    const now = new Date().toISOString();
    const stmts: D1PreparedStatement[] = [];
    stmts.push(env.DB.prepare(`
        INSERT INTO votes (id, bill_id, vote_date, title, result, url, chamber, congress, session, roll_number, question, bill_label, vote_type,
                           yeas, nays, present, not_voting, source_url_secondary, verification, verification_note, verified_at, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            vote_date = excluded.vote_date, title = excluded.title, result = excluded.result, url = excluded.url, question = excluded.question,
            bill_label = excluded.bill_label, vote_type = excluded.vote_type, yeas = excluded.yeas, nays = excluded.nays, present = excluded.present,
            not_voting = excluded.not_voting, source_url_secondary = excluded.source_url_secondary, verification = excluded.verification,
            verification_note = excluded.verification_note, verified_at = excluded.verified_at`)
        .bind(id, v.date, v.title.slice(0, 300), v.result.slice(0, 120), v.url, v.chamber, v.congress, v.session, v.roll, v.question.slice(0, 200),
            v.billLabel, v.voteType, v.yeas, v.nays, v.present, v.notVoting, secondaryUrl, verification, note.slice(0, 300),
            published(verification) ? now : null, now));
    let matched = 0, unmatched = 0;
    if (published(verification)) {
        for (const m of v.members) {
            const pid = v.chamber === "House" ? roster.byBioguide.get(m.key) : roster.byLis.get(m.key);
            if (!pid) { unmatched++; continue; }
            matched++;
            stmts.push(env.DB.prepare(
                "INSERT INTO politician_votes (politician_id, vote_id, position, rationale, member_key, created_at) VALUES (?, ?, ?, NULL, ?, ?) ON CONFLICT(politician_id, vote_id) DO UPDATE SET position = excluded.position, member_key = excluded.member_key"
            ).bind(pid, id, m.position, m.key, now));
        }
    }
    return { stmts, matched, unmatched };
}

// ------------------------------------------------------------------
// The hourly step
// ------------------------------------------------------------------
async function syncHouse(env: Env, roster: Roster, out: string[]): Promise<void> {
    const { year } = currentCongress();
    const cursorKey = `votes_house_${year}`;
    let cursor = parseInt((await kvGet(env, cursorKey)) || "0", 10) || 0;
    for (let i = 0; i < MAX_PER_RUN; i++) {
        const roll = cursor + 1;
        if (roll > 999) break;
        const res = await fetch(CLERK_XML(year, roll), { headers: { "User-Agent": USER_AGENT } });
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`House Clerk ${res.status} for roll ${roll}`);
        const clerk = parseHouseClerk(await res.text(), year);
        if (!clerk) break;   // the Clerk answers 200 with a placeholder page for rolls that do not exist yet
        const api = await fetchApiHouseVote(env, clerk.congress, clerk.session, clerk.roll);
        let verification: Verification;
        let note: string;
        let secondary: string | null = null;
        if (api === "missing") {
            verification = "unverified";
            note = "congress.gov does not list this roll call yet; will re-check";
        } else {
            secondary = api.billUrl || `${API}/house-vote/${clerk.congress}/${clerk.session}/${clerk.roll}`;
            const diff = compareHouse(clerk, api);
            if (diff) {
                verification = "mismatch";
                note = diff;
                await log(env, "provider_error", `House roll ${roll} (${year}) NOT published: ${diff}`);
            } else {
                verification = "verified";
                note = `House Clerk XML and congress.gov agree on the result and all ${clerk.members.length} positions`;
            }
        }
        const { stmts, matched, unmatched } = voteStatements(env, clerk, verification, note, secondary, roster);
        await runBatches(env, stmts);
        cursor = roll;
        await kvSet(env, cursorKey, String(cursor));
        out.push(`House ${year} roll ${roll}: ${verification}${verification === "verified" ? ` (${matched} members, ${unmatched} not in roster)` : ""}`);
    }
}

async function reverifyHouse(env: Env, roster: Roster, out: string[]): Promise<void> {
    const { results } = await env.DB.prepare(
        "SELECT congress, session, roll_number FROM votes WHERE verification = 'unverified' AND chamber = 'House' ORDER BY vote_date ASC LIMIT ?"
    ).bind(MAX_REVERIFY).all<{ congress: number; session: number; roll_number: number }>();
    for (const r of results || []) {
        const year = 1789 + (r.congress - 1) * 2 + (r.session === 1 ? 0 : 1);
        const res = await fetch(CLERK_XML(year, r.roll_number), { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) continue;
        const clerk = parseHouseClerk(await res.text(), year);
        if (!clerk) continue;
        const api = await fetchApiHouseVote(env, clerk.congress, clerk.session, clerk.roll);
        if (api === "missing") continue;
        const diff = compareHouse(clerk, api);
        const verification: Verification = diff ? "mismatch" : "verified";
        const note = diff || `House Clerk XML and congress.gov agree on the result and all ${clerk.members.length} positions`;
        if (diff) await log(env, "provider_error", `House roll ${r.roll_number} (${year}) NOT published on re-check: ${diff}`);
        const secondary = api.billUrl || `${API}/house-vote/${clerk.congress}/${clerk.session}/${clerk.roll}`;
        const { stmts, matched } = voteStatements(env, clerk, verification, note, secondary, roster);
        await runBatches(env, stmts);
        out.push(`House ${year} roll ${r.roll_number} re-checked: ${verification}${verification === "verified" ? ` (${matched} members)` : ""}`);
    }
}

async function syncSenate(env: Env, roster: Roster, out: string[]): Promise<void> {
    const { congress, session } = currentCongress();
    const cursorKey = `votes_senate_${congress}_${session}`;
    let cursor = parseInt((await kvGet(env, cursorKey)) || "0", 10) || 0;
    const menuRes = await fetch(SENATE_MENU(congress, session), { headers: { "User-Agent": USER_AGENT } });
    if (menuRes.status === 404) { out.push(`Senate ${congress}-${session}: no vote menu yet`); return; }
    if (!menuRes.ok) throw new Error(`Senate vote menu ${menuRes.status}`);
    const menu = parseSenateMenu(await menuRes.text());
    const max = Math.max(0, ...menu.keys());
    if (roster.byLis.size < 50) { out.push(`Senate: roster has only ${roster.byLis.size} LIS ids, waiting for the federal roster sync`); return; }
    for (let i = 0; i < MAX_PER_RUN && cursor < max; i++) {
        const n = cursor + 1;
        const entry = menu.get(n);
        const res = await fetch(SENATE_XML(congress, session, n), { headers: { "User-Agent": USER_AGENT } });
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`Senate vote XML ${res.status} for ${n}`);
        const doc = parseSenateVote(await res.text());
        if (!doc) break;
        const counted = { yeas: doc.members.filter(m => m.position === "Yea").length, nays: doc.members.filter(m => m.position === "Nay").length };
        let verification: Verification;
        let note: string;
        if (!entry) {
            verification = "unverified";
            note = "vote is not in the Senate vote menu yet; will re-check";
        } else if (entry.yeas !== doc.yeas || entry.nays !== doc.nays || counted.yeas !== doc.yeas || counted.nays !== doc.nays) {
            verification = "mismatch";
            note = `tallies differ: menu ${entry.yeas}-${entry.nays}, document ${doc.yeas}-${doc.nays}, counted members ${counted.yeas}-${counted.nays}`;
            await log(env, "provider_error", `Senate vote ${n} (${congress}-${session}) NOT published: ${note}`);
        } else if (entry.result && !normResult(doc.result).includes(normResult(entry.result))) {
            verification = "mismatch";
            note = `result differs: menu "${entry.result}", document "${doc.result}"`;
            await log(env, "provider_error", `Senate vote ${n} (${congress}-${session}) NOT published: ${note}`);
        } else {
            verification = "senate_xml";
            note = `senate.gov vote document and vote menu agree on the tally (${doc.yeas}-${doc.nays}) and result; ${doc.members.length} member positions counted`;
        }
        const { stmts, matched, unmatched } = voteStatements(env, doc, verification, note, SENATE_MENU(congress, session), roster);
        await runBatches(env, stmts);
        cursor = n;
        await kvSet(env, cursorKey, String(cursor));
        out.push(`Senate ${congress}-${session} vote ${n}: ${verification}${verification === "senate_xml" ? ` (${matched} senators, ${unmatched} not in roster)` : ""}`);
    }
}

export async function syncVotes(env: Env): Promise<string> {
    const out: string[] = [];
    const roster = await loadRoster(env);
    await syncHouse(env, roster, out);
    await reverifyHouse(env, roster, out);
    await syncSenate(env, roster, out);
    const msg = out.length ? `Votes: ${out.join("; ")}` : "Votes: nothing new";
    if (out.length) await log(env, "healthy", msg);
    return msg;
}

export async function votesStatus(env: Env): Promise<Record<string, string | null>> {
    const { congress, session, year } = currentCongress();
    return {
        house_cursor: await kvGet(env, `votes_house_${year}`),
        senate_cursor: await kvGet(env, `votes_senate_${congress}_${session}`),
        congress: `${congress}-${session}`,
    };
}
