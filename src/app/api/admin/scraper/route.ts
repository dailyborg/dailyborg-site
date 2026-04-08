import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    const expectedPass = process.env.ADMIN_PASSPHRASE || 'borg-admin-2026';

    if (authHeader !== `Bearer ${expectedPass}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body: any = await request.json().catch(() => ({}));
        
        // Allowed parameters
        const payload = {
            deep: body.deep === true,
            category: body.category || 'all',
            amount: body.amount ? parseInt(body.amount, 10) : 2 // Default to 2
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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
