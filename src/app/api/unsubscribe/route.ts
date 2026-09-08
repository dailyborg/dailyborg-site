import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/unsubscribe?t=<token>
 *
 * One click, no login, no account lookup. The token is the private 32 hex character value stored on
 * the subscriber row (migration 0014); the welcome email and every briefing carry the subscriber's own
 * link. Unsubscribing sets frequency to 'unsubscribed', which is the value the briefing worker skips.
 */
const TOKEN_RE = /^[0-9a-f]{32}$/;

function page(title: string, message: string, status: number): Response {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
</head>
<body style="margin:0;background:#020617;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:80px 24px;text-align:center;">
<h1 style="font-size:22px;font-weight:700;margin:0 0 12px 0;">The Daily Borg</h1>
<p style="font-size:16px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">${message}</p>
<a href="https://dailyborg.com" style="color:#93c5fd;font-size:14px;text-decoration:none;">dailyborg.com</a>
</div>
</body>
</html>`;
    return new Response(html, {
        status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

const NOT_VALID = () => page('Unsubscribe', 'This unsubscribe link is not valid.', 404);

export async function GET(request: Request) {
    try {
        const token = new URL(request.url).searchParams.get('t') || '';
        if (!TOKEN_RE.test(token)) return NOT_VALID();

        const db = await getDbBinding();
        const res = await db.prepare("UPDATE subscribers SET frequency = 'unsubscribed', updated_at = CURRENT_TIMESTAMP WHERE unsubscribe_token = ?")
            .bind(token).run();

        const changes = Number((res as any)?.meta?.changes ?? 0);
        if (changes === 0) return NOT_VALID();

        return page('Unsubscribed', 'You are unsubscribed from The Daily Borg. Sorry to see you go.', 200);
    } catch (error: any) {
        console.error("Unsubscribe Error:", error);
        return NOT_VALID();
    }
}
