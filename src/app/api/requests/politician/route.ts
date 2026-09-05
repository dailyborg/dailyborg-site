import { NextResponse } from "next/server";
import { getDbBinding } from "@/lib/db";

export const runtime = 'edge';

const NAME_RE = /^[A-Za-z][A-Za-z .,'\-]{2,78}[A-Za-z.]$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export async function POST(req: Request) {
    try {
        const body: any = await req.json().catch(() => ({}));
        const name = String(body.name || "").replace(/\s+/g, " ").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const link = body.link ? String(body.link).trim().slice(0, 500) : null;

        if (!NAME_RE.test(name)) return NextResponse.json({ error: "Please enter the official's full name (letters only)." }, { status: 400 });
        if (!EMAIL_RE.test(email) || email.length > 200) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        if (link && !/^https?:\/\//i.test(link)) return NextResponse.json({ error: "Reference link must start with http:// or https://" }, { status: 400 });

        const db = await getDbBinding();
        const pending = await db.prepare("SELECT id FROM politician_requests WHERE status = 'Pending' AND requested_name = ? LIMIT 1").bind(name).first();
        if (pending) return NextResponse.json({ success: true, id: (pending as any).id, message: "That official is already in the verification queue." }, { status: 200 });

        const id = crypto.randomUUID();
        await db.prepare("INSERT INTO politician_requests (id, requested_name, user_email, reference_link, status) VALUES (?, ?, ?, ?, 'Pending')").bind(id, name, email, link).run();
        return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (error: any) {
        console.error("Politician Request API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
