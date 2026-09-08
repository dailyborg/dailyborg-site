/**
 * dailyborg-truth
 *
 * Records real, published fact-check rulings for the officials in the Borg Record.
 *
 * The previous version asked an 8-billion-parameter model to decide whether a real person had "lied",
 * then attached the result to whichever politician shared a last name with a word in the article.
 * That produced fabricated accusations against real people. This version does none of that.
 *
 * What it does instead:
 *   1. Every 6 hours it reads PolitiFact's public fact-check RSS feed.
 *   2. Each item links to /factchecks/<year>/<mon>/<day>/<speaker-slug>/..., so the speaker is identified
 *      by PolitiFact's own slug, and the ruling is the alt text of the Truth-O-Meter image in the item body.
 *   3. Spanish editions of a ruling are dropped on the evidence of their link alone (isSpanishEdition), so
 *      the same ruling is not counted twice against the same official. No English item is ever dropped.
 *   4. It stores the ruling only when the speaker slug matches exactly one of our politicians
 *      (letters and digits only, so "jd-vance" matches "j-d-vance"). A slug that matches two or more rows
 *      stores nothing and writes one validation_warning to ingestion_logs naming the candidates, because
 *      guessing which real person spoke is the failure this worker exists to prevent.
 *   5. It then recomputes the trust score for the affected officials from every ruling stored for them, and
 *      writes a trustworthiness_history row only when the score changed.
 *   6. Manual runs are POST ?action=sync, at most one every 10 minutes, held by a lock row in kv_store
 *      (key truth_manual_lock_until). A GET only answers with the status line and never syncs.
 *
 * Every stored row carries the PolitiFact URL as its source, so readers can verify each entry themselves.
 */

export interface Env {
    DB: D1Database;
}

const FEED_URL = "https://www.politifact.com/rss/factchecks/";
const USER_AGENT = "DailyBorg/2.0 (https://dailyborg.com; pressroom@dailyborg.com)";

const RATING_MAP: Record<string, string> = {
    "true": "true", "mostly true": "mostly_true", "half true": "half_true",
    "mostly false": "mostly_false", "false": "false", "pants on fire": "pants_on_fire", "pants on fire!": "pants_on_fire",
};
// How much each ruling pulls the trust score down (0 = fully truthful, 1 = fully false).
const FALSENESS: Record<string, number> = { true: 0, mostly_true: 0.2, half_true: 0.5, mostly_false: 0.8, false: 1, pants_on_fire: 1 };
const MIN_RULINGS_FOR_SCORE = 3;

// The month segment of a PolitiFact fact-check URL, English edition.
const MONTHS: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
// Month abbreviations only the Spanish edition uses. Observed on 2026-09-07: the Spanish ruling
// .../factchecks/2026/aug/27/byron-donalds/sarampion-brote-inmigracion-vacuna-florida/ answers with
// <html lang="es"> and a canonical URL of .../factchecks/2026/ago/27/..., against .../2026/aug/27/... for
// the English original. feb, mar, may, jun, jul, sep, oct and nov are spelled the same in both languages
// and so carry no signal.
const SPANISH_MONTHS = new Set(["ene", "abr", "ago", "dic", "set"]);

const MANUAL_LOCK_KEY = "truth_manual_lock_until";
const MANUAL_LOCK_MINUTES = 10;

function nameKey(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

// Small key/value helpers on top of the kv_store table, the same pattern the scraper and sentinel use.
async function kvGet(env: Env, key: string): Promise<string | null> {
    const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first<{ value: string }>();
    return row?.value ?? null;
}

async function kvSet(env: Env, key: string, value: string): Promise<void> {
    await env.DB.prepare("INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, value).run();
}

/**
 * True when the link is PolitiFact's Spanish edition of a ruling rather than the English original.
 *
 * The test reads the URL path and nothing else, so no English ruling can be dropped over the words it
 * happens to contain. Three markers count as Spanish:
 *   1. an "espanol" or "es" path segment,
 *   2. a Spanish month in the date segment of a /factchecks/ URL (see SPANISH_MONTHS),
 *   3. a slug whose last segment ends in "-es".
 * Known gap, recorded 2026-09-07: PolitiFact's RSS rewrites the Spanish month back to English, so a
 * Spanish item whose slug is plain Spanish words carries no marker at all in the feed link and is not
 * caught here. See workers/truth-engine/CLAUDE.md.
 */
export function isSpanishEdition(link: string): boolean {
    let path: string;
    try {
        path = new URL(link, "https://www.politifact.com").pathname.toLowerCase();
    } catch {
        return false;
    }
    const segments = path.split("/").filter(Boolean);
    if (segments.includes("espanol") || segments.includes("es")) return true;
    const factchecks = segments.indexOf("factchecks");
    if (factchecks >= 0 && SPANISH_MONTHS.has(segments[factchecks + 2] || "")) return true;
    return /-es$/.test(segments[segments.length - 1] || "");
}

function decodeEntities(s: string): string {
    return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/[“”]/g, "\"").replace(/[’]/g, "'").replace(/�/g, "'");
}

function tag(xml: string, name: string): string {
    const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    return m ? decodeEntities(m[1]).trim() : "";
}

interface Ruling { speakerSlug: string; statement: string; rating: string; analysis: string; url: string; date: string; }

/** True when the PolitiFact page at url is a Spanish edition (its html element carries lang="es"). A failed fetch counts as English so a network hiccup never hides a ruling. */
async function isSpanishPage(url: string): Promise<boolean> {
    try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return false;
        const head = (await res.text()).slice(0, 6000);
        return /<html[^>]*\slang=["']es\b/i.test(head);
    } catch {
        return false;
    }
}

export function parseFeed(xml: string): Ruling[] {
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const out: Ruling[] = [];
    for (const item of items) {
        const link = tag(item, "link");
        // PolitiFact republishes some rulings in Spanish under a second URL. Keep the English original only.
        // The decision is made on the link, never on the words of the statement.
        if (isSpanishEdition(link)) continue;
        const m = link.match(/\/factchecks\/(\d{4})\/([a-z]{3})\/(\d{1,2})\/([a-z0-9-]+)\//i);
        if (!m) continue;
        // An unrecognised month is an unrecognised edition of the site. Skip it rather than file a real
        // person's ruling under a date we invented.
        const month = MONTHS[m[2].toLowerCase()];
        if (!month) continue;
        const body = tag(item, "content:encoded");
        const alt = body.match(/alt="([^"]+)"/i)?.[1]?.toLowerCase().trim() || "";
        const rating = RATING_MAP[alt];
        if (!rating) continue;
        const statement = tag(item, "description") || tag(item, "title");
        const paragraph = decodeEntities((body.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
        const date = `${m[1]}-${month}-${m[3].padStart(2, "0")}`;
        out.push({ speakerSlug: m[4], statement: statement.slice(0, 500), rating, analysis: paragraph.slice(0, 600), url: link, date });
    }
    return out;
}

async function syncPolitiFact(env: Env): Promise<string> {
    const res = await fetch(FEED_URL, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`PolitiFact feed returned ${res.status}`);
    const rulings = parseFeed(await res.text());
    if (rulings.length === 0) return "PolitiFact feed had no parseable items";

    // One indexed lookup per distinct speaker slug in the feed (20 items, usually fewer than 15 speakers).
    const slugs = [...new Set(rulings.map(r => r.speakerSlug))];
    const keys = slugs.map(nameKey);
    // Politician slugs are stored as "susan-collins" or "susan-collins-me"; compare on the letters-only key
    // of the slug with any state suffix removed.
    const { results } = await env.DB.prepare(
        `SELECT slug FROM politicians WHERE candidate_status <> 'Former' AND (${slugs.map(() => "slug = ? OR slug LIKE ?").join(" OR ")})`
    ).bind(...slugs.flatMap(s => [s, `${s}-__`])).all<{ slug: string }>();
    const ourSlugs = results || [];

    // Every politician row a feed slug could stand for, so an ambiguous slug can be recognised as such.
    const candidates = new Map<string, string[]>();
    for (const row of ourSlugs) {
        const base = row.slug.replace(/-[a-z]{2}$/, "");
        const idx = keys.indexOf(nameKey(base));
        if (idx < 0) continue;
        const speaker = slugs[idx];
        const list = candidates.get(speaker) || [];
        if (!list.includes(row.slug)) list.push(row.slug);
        candidates.set(speaker, list);
    }

    // Only an exact single match may receive a ruling. When two of our officials answer to the same slug we
    // cannot know which one spoke, and inventing an answer about a real person is the whole failure this
    // worker exists to prevent, so nothing is stored and the clash is logged for the roster to fix.
    const bySpeaker = new Map<string, string>();
    let ambiguous = 0;
    for (const [speaker, list] of candidates) {
        if (list.length === 1) {
            bySpeaker.set(speaker, list[0]);
            continue;
        }
        ambiguous++;
        await logAmbiguousSpeaker(env, speaker, list);
    }

    let stored = 0, republished = 0, onFile = 0;
    const touched = new Set<string>();
    for (const r of rulings) {
        const slug = bySpeaker.get(r.speakerSlug);
        if (!slug) continue;
        const known = await env.DB.prepare("SELECT 1 AS x FROM fact_checks WHERE source_url = ? LIMIT 1").bind(r.url).first();
        if (known) { onFile++; continue; }
        // PolitiFact republishes some rulings in Spanish under a different URL, and the RSS link carries no
        // language marker (checked 2026-09-08). Date and rating are not a safe key either: one official can get
        // two different rulings with the same rating on one day. So the page itself is asked: a Spanish edition
        // declares <html lang="es">. One fetch per genuinely new ruling, a handful per run.
        if (await isSpanishPage(r.url)) { republished++; continue; }
        const result = await env.DB.prepare(
            "INSERT OR IGNORE INTO fact_checks (id, politician_slug, statement, rating, analysis_text, source_url, date) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), slug, r.statement, r.rating, `PolitiFact ruling: ${r.analysis}`, r.url, r.date).run();
        if (result.meta.changes > 0) { stored++; touched.add(slug); }
    }

    for (const slug of touched) await recomputeTrust(env, slug);
    const summary = `PolitiFact: ${rulings.length} rulings read, ${bySpeaker.size} matched our officials, ${stored} new stored, ${onFile} already on file, ${republished} Spanish editions skipped`;
    return ambiguous > 0 ? `${summary}, ${ambiguous} speaker slugs too ambiguous to store` : summary;
}

/**
 * One ingestion_logs row per ambiguous speaker slug, so the newsroom can see which roster rows collide.
 * Logging must never end the run, so a failed write is swallowed after the console line.
 */
async function logAmbiguousSpeaker(env: Env, speaker: string, candidates: string[]): Promise<void> {
    const message = `PolitiFact speaker "${speaker}" matches ${candidates.length} politicians (${candidates.join(", ")}). No ruling stored; the roster needs exactly one match.`;
    console.warn("[truth]", message);
    try {
        await env.DB.prepare("INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, ?, ?, ?)")
            .bind(crypto.randomUUID(), speaker.slice(0, 50), "validation_warning", message).run();
    } catch { /* logging must never fail the run */ }
}

/** Trust score = 100 minus the average falseness of every ruling stored for the official, once there are enough. */
async function recomputeTrust(env: Env, slug: string): Promise<void> {
    // Every stored ruling counts. A window of the newest 50 would have made the score depend on how many
    // times the sync had run rather than on the record itself.
    const { results } = await env.DB.prepare("SELECT rating FROM fact_checks WHERE politician_slug = ?").bind(slug).all<{ rating: string }>();
    const ratings = (results || []).map(r => r.rating).filter(r => r in FALSENESS);
    const pol = await env.DB.prepare("SELECT id, trustworthiness_score FROM politicians WHERE slug = ?").bind(slug).first<{ id: string; trustworthiness_score: number | null }>();
    if (!pol) return;
    if (ratings.length < MIN_RULINGS_FOR_SCORE) return;
    const avg = ratings.reduce((s, r) => s + FALSENESS[r], 0) / ratings.length;
    const score = Math.round(100 - avg * 100);
    if (pol.trustworthiness_score === score) return;
    await env.DB.batch([
        env.DB.prepare("UPDATE politicians SET trustworthiness_score = ?, last_scored_at = CURRENT_TIMESTAMP WHERE id = ?").bind(score, pol.id),
        env.DB.prepare("INSERT INTO trustworthiness_history (id, politician_id, score) VALUES (?, ?, ?)").bind(`th_${crypto.randomUUID().slice(0, 12)}`, pol.id, score),
    ]);
}

export default {
    async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(syncPolitiFact(env).then(r => console.log("[truth]", r)).catch(e => console.error("[truth]", e)));
    },
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        // A sync is a write to the public record, so it is POST only. Every other method, GET included,
        // falls through to the status line and changes nothing.
        if (request.method === "POST" && url.searchParams.get("action") === "sync") {
            // One manual run every 10 minutes, held by a timestamp in kv_store, so a stray caller cannot
            // hammer PolitiFact or burn the D1 free tier.
            try {
                const lockedUntil = await kvGet(env, MANUAL_LOCK_KEY);
                if (lockedUntil) {
                    const until = Date.parse(lockedUntil);
                    if (!isNaN(until) && until > Date.now()) {
                        return Response.json(
                            { ok: false, error: `The truth engine was triggered less than ${MANUAL_LOCK_MINUTES} minutes ago. Try again later.` },
                            { status: 429 }
                        );
                    }
                }
                await kvSet(env, MANUAL_LOCK_KEY, new Date(Date.now() + MANUAL_LOCK_MINUTES * 60000).toISOString());
            } catch (err: any) {
                // A D1 hiccup must not swallow the trigger. The sync below needs D1 as well and will report.
                console.error("[truth] Manual trigger lock unavailable:", err?.message || err);
            }

            try { return Response.json({ ok: true, result: await syncPolitiFact(env) }); }
            catch (e: any) { return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 }); }
        }
        return new Response("dailyborg-truth online. POST ?action=sync to read the PolitiFact feed now.", { status: 200 });
    },
};
