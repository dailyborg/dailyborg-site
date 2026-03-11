import { NextResponse } from "next/server";
import { getDbBinding } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body: any = await req.json();
        const { name, email, link } = body;

        if (!name || !email) {
            return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
        }

        const db = await getDbBinding();
        const id = crypto.randomUUID();

        const stmt = db.prepare(`
            INSERT INTO politician_requests (id, requested_name, user_email, reference_link, status)
            VALUES (?, ?, ?, ?, 'Pending')
        `).bind(id, name, email, link || null);

        await stmt.run();

        return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (error: any) {
        console.error("Politician Request API Error:", error);
        require('fs').writeFileSync('apicrash.log', String(error) + '\n' + String(error.stack));
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
