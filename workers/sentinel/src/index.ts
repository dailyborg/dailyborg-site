/**
 * sentinel-engine
 *
 * Hourly maintenance for The Daily Borg. Replaces three old workers (sentinel every 15 minutes,
 * image-medic, and the log/visit tables that grew forever).
 *
 * Every query here is index backed. The old version ran eleven full scans of the articles table
 * every fifteen minutes, which by itself could exhaust the D1 free tier (5,000,000 rows read per day).
 *
 *   1. Coverage check: how many approved articles per desk in the last 12 hours, and how fresh is the newest.
 *      Triggers the scraper (through a service binding) at most once per hour when content is stale or a desk is empty.
 *   2. Image repair: up to 5 recent articles with no hero image get a free Unsplash image. No paid generation here.
 *   3. Daily pruning: ingestion_logs older than 30 days, site_visits older than 90 days, trust history older than 1 year.
 *   4. Writes one log row per run only when it did something, plus one "healthy" heartbeat per day.
 */

export interface Env {
    DB: D1Database;
    SCRAPER?: Fetcher;              // service binding to dailyborg-scraper
    UNSPLASH_ACCESS_KEY?: string;
}

const DESKS = ["Politics", "Science", "Business", "Entertainment", "Sports", "Crime", "Education"];
const STOP_WORDS = new Set(["the", "a", "an", "of", "in", "on", "for", "to", "and", "is", "are", "as", "at", "by", "its", "how", "why", "what", "with", "from", "has", "have", "that", "this", "into", "over", "after", "new", "about", "says", "said", "amid", "will", "could"]);

async function kvGet(env: Env, key: string): Promise<string | null> {
    const v = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first<{ value: string }>();
    return v?.value ?? null;
}
async function kvSet(env: Env, key: string, value: string): Promise<void> {
    await env.DB.prepare("INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, value).run();
}
async function isDue(env: Env, key: string, hours: number): Promise<boolean> {
    const last = await kvGet(env, key);
    if (!last) return true;
    const t = Date.parse(last);
    return isNaN(t) || (Date.now() - t) > hours * 3600 * 1000;
}
async function log(env: Env, status: string, message: string): Promise<void> {
    try {
        await env.DB.prepare("INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, 'sentinel-health', ?, ?)").bind(crypto.randomUUID(), status, message.slice(0, 500)).run();
    } catch { /* never fail the run because logging failed */ }
}

async function triggerScraper(env: Env, payload: Record<string, unknown>): Promise<boolean> {
    // Only through the service binding. No public URL fallback, so a local test run can never
    // wake the production scraper by accident.
    if (!env.SCRAPER) {
        console.warn("[sentinel] SCRAPER service binding missing; not triggering");
        return false;
    }
    try {
        const res = await env.SCRAPER.fetch(new Request("https://scraper.internal/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
        return res.ok;
    } catch (e) {
        console.error("[sentinel] scraper trigger failed", e);
        return false;
    }
}

async function coverageCheck(env: Env, actions: string[]): Promise<void> {
    const recent = await env.DB.prepare(
        "SELECT desk, COUNT(*) AS c FROM articles WHERE publish_date > datetime('now', '-12 hours') AND approval_status = 'approved' GROUP BY desk"
    ).all<{ desk: string; c: number }>();
    const counts = new Map((recent.results || []).map(r => [r.desk, r.c]));
    const missing = DESKS.filter(d => !counts.get(d));

    const newest = await env.DB.prepare("SELECT MAX(publish_date) AS m FROM articles WHERE approval_status = 'approved'").first<{ m: string | null }>();
    const newestAgeHours = newest?.m ? (Date.now() - Date.parse(newest.m.replace(" ", "T") + (newest.m.endsWith("Z") ? "" : "Z"))) / 3600000 : 999;

    const stale = newestAgeHours > 24;
    if ((stale || missing.length > 0) && await isDue(env, "scraper_triggered_at", 1)) {
        const ok = stale
            ? await triggerScraper(env, { deep: true, category: "all", amount: 3 })
            : await triggerScraper(env, { deep: false, category: missing.length === 1 ? missing[0].toLowerCase() : "all", amount: 2 });
        if (ok) {
            await kvSet(env, "scraper_triggered_at", new Date().toISOString());
            actions.push(stale ? `scraper deep run (newest article ${newestAgeHours.toFixed(1)}h old)` : `scraper run for empty desks: ${missing.join(", ")}`);
        } else {
            actions.push("scraper trigger FAILED");
        }
    }
}

async function repairImages(env: Env, actions: string[]): Promise<void> {
    if (!env.UNSPLASH_ACCESS_KEY || env.UNSPLASH_ACCESS_KEY.length < 5) return;
    const { results } = await env.DB.prepare(
        "SELECT id, title, desk FROM articles WHERE (hero_image_url IS NULL OR hero_image_url = '') AND publish_date > datetime('now', '-3 days') ORDER BY publish_date DESC LIMIT 5"
    ).all<{ id: string; title: string; desk: string }>();
    const rows = results || [];
    if (rows.length === 0) return;

    let fixed = 0;
    for (const a of rows) {
        const keywords = a.title.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase())).slice(0, 3);
        const query = keywords.length > 0 ? keywords.join(" ") : (a.desk || "news");
        try {
            const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1&content_filter=high`, {
                headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` },
            });
            if (!res.ok) { if (res.status === 403 || res.status === 429) break; continue; }
            const data: any = await res.json();
            const url: string | undefined = data?.results?.[0]?.urls?.regular;
            if (url) {
                await env.DB.prepare("UPDATE articles SET hero_image_url = ? WHERE id = ?").bind(url, a.id).run();
                fixed++;
            }
        } catch (e) { console.warn("[sentinel] unsplash lookup failed", e); }
    }
    if (fixed > 0) actions.push(`hero images repaired: ${fixed}`);
}

async function dailyPruning(env: Env, actions: string[]): Promise<void> {
    if (!(await isDue(env, "pruned_at", 24))) return;
    await env.DB.batch([
        env.DB.prepare("DELETE FROM ingestion_logs WHERE created_at < datetime('now', '-30 days')"),
        env.DB.prepare("DELETE FROM site_visits WHERE created_at < datetime('now', '-90 days')"),
        env.DB.prepare("DELETE FROM trustworthiness_history WHERE scored_at < datetime('now', '-365 days')"),
        env.DB.prepare("DELETE FROM politician_requests WHERE status IN ('Rejected', 'Verified', 'Generated') AND created_at < datetime('now', '-90 days')"),
    ]);
    await kvSet(env, "pruned_at", new Date().toISOString());
    actions.push("daily pruning done");
}

async function run(env: Env): Promise<string> {
    const actions: string[] = [];
    try {
        await coverageCheck(env, actions);
        await repairImages(env, actions);
        await dailyPruning(env, actions);
        if (actions.length > 0) {
            await log(env, "healed", `Sentinel actions: ${actions.join("; ")}`);
        } else if (await isDue(env, "heartbeat_at", 24)) {
            await log(env, "healthy", "Sentinel daily heartbeat: coverage fresh, no repairs needed.");
            await kvSet(env, "heartbeat_at", new Date().toISOString());
        }
        return actions.length > 0 ? actions.join("; ") : "healthy";
    } catch (e: any) {
        await log(env, "error", `Sentinel error: ${e?.message || e}`);
        return `error: ${e?.message || e}`;
    }
}

export default {
    async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(run(env).then(r => console.log("[sentinel]", r)));
    },
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === "/__run_check" && request.method === "POST") {
            return Response.json({ ok: true, result: await run(env) });
        }
        return new Response("sentinel-engine online. POST /__run_check to run a maintenance pass.", { status: 200 });
    },
};
