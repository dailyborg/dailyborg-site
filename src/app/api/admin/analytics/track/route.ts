import { NextResponse } from "next/server";
import { getDbBinding } from "@/lib/db";

export const runtime = "edge";

export async function POST(request: Request) {
    try {
        // 1. Check for Admin token to exclude tracking
        const cookies = request.headers.get("cookie") || "";
        if (cookies.includes("borg_admin_token=")) {
            return NextResponse.json({ success: true, ignored: true });
        }

        // 2. Parse basic generic tracking payload
        const reqData = await request.json() as any;
        const path = reqData.path || "/";
        const userAgent = reqData.userAgent || request.headers.get("user-agent") || "unknown";

        // 3. Hash IP to ensure privacy but allow "Unique Visitor" counts
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
        
        // Use standard Web Crypto API (available in Edge runtime)
        const encoder = new TextEncoder();
        const data = encoder.encode(ip + new Date().toDateString()); // Salting with the date so hashes change daily (truly counts unique IP per day)
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const ipHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        const db = await getDbBinding();
        const uuid = crypto.randomUUID();

        await db.prepare(`
            INSERT INTO site_visits (id, ip_hash, path, user_agent)
            VALUES (?, ?, ?, ?)
        `).bind(uuid, ipHash, path, userAgent).run();

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Analytics Tracker Error:", e.message);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
