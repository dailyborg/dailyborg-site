/**
 * Admin authentication for /api/admin/* and other privileged routes.
 *
 * The passphrase comes from the ADMIN_PASSPHRASE environment variable on the Pages project.
 * There is deliberately no fallback value: if the variable is missing, every admin call is refused.
 */
import { NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export function readEnv(name: string): string | undefined {
    const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
    if (fromProcess) return fromProcess;
    try {
        const env = getRequestContext().env as Record<string, unknown>;
        const v = env?.[name];
        return typeof v === "string" ? v : undefined;
    } catch {
        return undefined;
    }
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const [ha, hb] = await Promise.all([
        crypto.subtle.digest("SHA-256", enc.encode(a)),
        crypto.subtle.digest("SHA-256", enc.encode(b)),
    ]);
    const va = new Uint8Array(ha), vb = new Uint8Array(hb);
    let diff = 0;
    for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
    return diff === 0 && a.length === b.length;
}

/** Returns true when the request carries `Authorization: Bearer <ADMIN_PASSPHRASE>`. */
export async function isAdminRequest(request: Request): Promise<boolean> {
    const expected = readEnv("ADMIN_PASSPHRASE");
    if (!expected || expected.length < 8) return false;
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) return false;
    return constantTimeEqual(header.slice(7).trim(), expected);
}

/** Convenience: returns a 401 response when the request is not from the admin, otherwise null. */
export async function requireAdmin(request: Request): Promise<NextResponse | null> {
    if (await isAdminRequest(request)) return null;
    const configured = !!readEnv("ADMIN_PASSPHRASE");
    return NextResponse.json(
        { error: configured ? "Unauthorized" : "Admin access is not configured. Set ADMIN_PASSPHRASE on the Pages project." },
        { status: 401 }
    );
}
