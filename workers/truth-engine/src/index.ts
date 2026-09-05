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
 *   3. It stores the ruling only when the speaker slug matches one of our politicians exactly
 *      (letters and digits only, so "jd-vance" matches "j-d-vance").
 *   4. It then recomputes the trust score for the affected officials from the stored rulings, and writes a
 *      trustworthiness_history row only when the score changed.
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

function nameKey(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
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

export function parseFeed(xml: string): Ruling[] {
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const out: Ruling[] = [];
    for (const item of items) {
        const link = tag(item, "link");
        const m = link.match(/\/factchecks\/(\d{4})\/([a-z]{3})\/(\d{1,2})\/([a-z0-9-]+)\//i);
        if (!m) continue;
        const body = tag(item, "content:encoded");
        const alt = body.match(/alt="([^"]+)"/i)?.[1]?.toLowerCase().trim() || "";
        const rating = RATING_MAP[alt];
        if (!rating) continue;
        const statement = tag(item, "description") || tag(item, "title");
        // PolitiFact republishes some rulings in Spanish under a second URL. Keep the English original only.
        if (/[áéíóúñ¿¡]/i.test(statement) && /(el|la|los|las|de|que|en|una|del)/i.test(statement)) continue;
        const paragraph = decodeEntities((body.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
        const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
        const date = `${m[1]}-${months[m[2].toLowerCase()] || "01"}-${m[3].padStart(2, "0")}`;
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
    const bySpeaker = new Map<string, string>();
    for (const row of ourSlugs) {
        const base = row.slug.replace(/-[a-z]{2}$/, "");
        const k = nameKey(base);
        const idx = keys.indexOf(k);
        if (idx >= 0 && !bySpeaker.has(slugs[idx])) bySpeaker.set(slugs[idx], row.slug);
    }

    let stored = 0;
    const touched = new Set<string>();
    for (const r of rulings) {
        const slug = bySpeaker.get(r.speakerSlug);
        if (!slug) continue;
        const result = await env.DB.prepare(
            "INSERT OR IGNORE INTO fact_checks (id, politician_slug, statement, rating, analysis_text, source_url, date) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), slug, r.statement, r.rating, `PolitiFact ruling: ${r.analysis}`, r.url, r.date).run();
        if (result.meta.changes > 0) { stored++; touched.add(slug); }
    }

    for (const slug of touched) await recomputeTrust(env, slug);
    return `PolitiFact: ${rulings.length} rulings read, ${bySpeaker.size} matched our officials, ${stored} new stored`;
}

/** Trust score = 100 minus the average falseness of the official's stored rulings, once there are enough rulings. */
async function recomputeTrust(env: Env, slug: string): Promise<void> {
    const { results } = await env.DB.prepare("SELECT rating FROM fact_checks WHERE politician_slug = ? ORDER BY date DESC LIMIT 50").bind(slug).all<{ rating: string }>();
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
        if (url.searchParams.get("action") === "sync") {
            try { return Response.json({ ok: true, result: await syncPolitiFact(env) }); }
            catch (e: any) { return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 }); }
        }
        return new Response("dailyborg-truth online. ?action=sync to read the PolitiFact feed now.", { status: 200 });
    },
};
