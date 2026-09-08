import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'edge';

// The scraper worker only understands these feeds. Anything else falls back to 'all'.
const CATEGORIES = ['all', 'politics', 'crime', 'business', 'entertainment', 'sports', 'science', 'education', 'standard'];

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    try {
        const body: any = await request.json().catch(() => ({}));

        // Allowed parameters. amount is a whole number of stories, 1 to 10, so one stray keystroke
        // in the admin panel cannot queue hundreds of articles against the daily budget.
        const rawAmount = parseInt(String(body.amount ?? ''), 10);
        const payload = {
            deep: body.deep === true,
            category: CATEGORIES.includes(String(body.category || '').toLowerCase()) ? String(body.category).toLowerCase() : 'all',
            amount: Number.isFinite(rawAmount) ? Math.min(10, Math.max(1, Math.trunc(rawAmount))) : 2
        };

        const scraperURL = 'https://dailyborg-scraper.pressroom.workers.dev';

        const response = await fetch(scraperURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Scraper Worker Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.text();

        return NextResponse.json({ success: true, message: data, payload });
    } catch (error: any) {
        console.error("Admin Scraper Trigger API Error:", error);
        return NextResponse.json({ error: "The scraper could not be reached. Please try again." }, { status: 500 });
    }
}
