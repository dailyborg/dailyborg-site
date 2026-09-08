import { NextResponse } from "next/server";
import { getDbBinding } from "@/lib/db";
import { readEnv } from "@/lib/admin-auth";

export const runtime = "edge";

const MAX_PATH = 200;
const MAX_USER_AGENT = 200;

/**
 * Public endpoint: every page view from a browser posts here.
 *
 * It writes at most one row per visitor per path per day, so the D1 rows-written budget cannot be
 * drained by a reload loop, and it never trusts the client for the user agent.
 */
export async function POST(request: Request) {
    try {
        // 1. The admin's own browser carries a non-secret marker cookie. Skip counting those visits.
        //    (The old check read borg_admin_token, which held the passphrase itself.)
        const cookies = request.headers.get("cookie") || "";
        if (/(?:^|;\s*)borg_admin_ui=1(?:;|$)/.test(cookies)) {
            return NextResponse.json({ success: true, ignored: true });
        }

        const reqData = await request.json().catch(() => ({})) as any;
        const rawPath = typeof reqData.path === "string" ? reqData.path : "/";
        const path = rawPath.slice(0, MAX_PATH);

        // Also skip tracking for admin paths
        if (path.startsWith("/admin")) {
            return NextResponse.json({ success: true, ignored: true });
        }

        // 2. The user agent comes from the request itself, never from the body. There is no referrer
        //    column on site_visits, so no referrer is read or stored.
        const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, MAX_USER_AGENT);
        if (/bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python-requests|facebookexternalhit/i.test(userAgent)) {
            return NextResponse.json({ success: true, ignored: true });
        }

        // 3. Extract IP
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";

        // 4. IP-based Administrator Exclusion (Check if IP is in ADMIN_IPS env var)
        const adminIps = (readEnv("ADMIN_IPS") || "").split(",").map(i => i.trim()).filter(i => i.length > 0);
        if (adminIps.includes(ip)) {
            return NextResponse.json({ success: true, ignored: true });
        }

        // 5. Hash IP to ensure privacy but allow "Unique Visitor" counts

        // Use standard Web Crypto API (available in Edge runtime)
        const encoder = new TextEncoder();
        const data = encoder.encode(ip + new Date().toDateString()); // Salting with the date so hashes change daily (truly counts unique IP per day)
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const ipHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        const db = await getDbBinding();

        // 6. One row per visitor per path per day. This read is served by idx_site_visits_ip_date.
        const seen = await db.prepare(
            "SELECT 1 FROM site_visits WHERE ip_hash = ? AND path = ? AND created_at >= date('now') LIMIT 1"
        ).bind(ipHash, path).first();
        if (seen) {
            return NextResponse.json({ success: true, ignored: true });
        }

        const uuid = crypto.randomUUID();
        await db.prepare(`
            INSERT INTO site_visits (id, ip_hash, path, user_agent)
            VALUES (?, ?, ?, ?)
        `).bind(uuid, ipHash, path, userAgent).run();

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Analytics Tracker Error:", e);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
