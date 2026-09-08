import { NextResponse } from "next/server";
import { getDbBinding } from "@/lib/db";

export const runtime = 'edge';

const NAME_RE = /^[a-z .,'-]{4,80}$/i;
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PENDING_REQUESTS = 20;
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function POST(req: Request) {
    try {
        const body: any = await req.json().catch(() => ({}));
        const name = String(body.name || "").replace(/\s+/g, " ").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const link = body.link ? String(body.link).trim().slice(0, 500) : null;

        if (!NAME_RE.test(name)) return NextResponse.json({ error: "Please enter the official's full name (letters only)." }, { status: 400 });
        if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        if (link && !/^https?:\/\//i.test(link)) return NextResponse.json({ error: "Reference link must start with http:// or https://" }, { status: 400 });

        const db = await getDbBinding();

        // One request per official per month, whatever happened to the earlier one. politician_requests
        // is a small table, so the lower() comparison scans very little; the 30 day window and the
        // pending cap below are what keep it small.
        const recent = await db.prepare(
            "SELECT id FROM politician_requests WHERE lower(requested_name) = lower(?) AND created_at >= datetime('now', '-30 days') LIMIT 1"
        ).bind(name).first();
        if (recent) {
            return NextResponse.json({ success: true, id: (recent as any).id, message: "That official is already in the verification queue." }, { status: 200 });
        }

        // Hard ceiling on the queue. Index: idx_requests_status_created.
        const pendingCount = await db.prepare("SELECT COUNT(*) AS n FROM politician_requests WHERE status = 'Pending'").first();
        if (Number((pendingCount as any)?.n || 0) >= MAX_PENDING_REQUESTS) {
            return NextResponse.json({ error: "The verification queue is full right now. Please try again in a few days." }, { status: 429 });
        }

        const id = crypto.randomUUID();
        await db.prepare("INSERT INTO politician_requests (id, requested_name, user_email, reference_link, status) VALUES (?, ?, ?, ?, 'Pending')").bind(id, name, email, link).run();
        return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (error: any) {
        console.error("Politician Request API Error:", error);
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
}
