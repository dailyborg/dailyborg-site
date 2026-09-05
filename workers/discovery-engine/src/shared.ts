/** Shared bindings and the small D1 helpers used by every discovery step. */

export interface Env {
    DB: D1Database;
    RESEND_API_KEY?: string;
    /** congress.gov API v3 key (free). Only used by votes.ts as the second source for House roll calls. */
    CONGRESS_API_KEY?: string;
}

export const USER_AGENT = "DailyBorg/2.0 (https://dailyborg.com; pressroom@dailyborg.com)";

export async function kvGet(env: Env, key: string): Promise<string | null> {
    const v = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first<{ value: string }>();
    return v?.value ?? null;
}

export async function kvSet(env: Env, key: string, value: string): Promise<void> {
    await env.DB.prepare("INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, value).run();
}

export async function isDue(env: Env, key: string, hours: number): Promise<boolean> {
    const last = await kvGet(env, key);
    if (!last) return true;
    const t = Date.parse(last);
    return isNaN(t) || (Date.now() - t) > hours * 3600 * 1000;
}

export async function runBatches(env: Env, stmts: D1PreparedStatement[], size = 40): Promise<void> {
    for (let i = 0; i < stmts.length; i += size) {
        await env.DB.batch(stmts.slice(i, i + size));
    }
}

export async function log(env: Env, status: string, message: string): Promise<void> {
    try {
        await env.DB.prepare("INSERT INTO ingestion_logs (id, event_slug, status, message) VALUES (?, 'discovery', ?, ?)")
            .bind(crypto.randomUUID(), status, message.slice(0, 500)).run();
    } catch { /* logging must never break the run */ }
}
