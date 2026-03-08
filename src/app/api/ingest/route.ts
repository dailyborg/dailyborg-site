import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// This is the public API route that receives articles (Mode A: RSS Intake).
// It defers the heavy AI lifting to a Cloudflare background worker.
export async function POST(request: Request) {
    try {
        const payload = await request.json();

        const context = await getCloudflareContext();
        const env = context.env as any;
        const queue = env.INGEST_QUEUE;

        if (!queue) {
            return NextResponse.json({ error: "Queue not bound" }, { status: 500 });
        }

        // Send to queue for async processing
        await queue.send(payload);

        return NextResponse.json({
            success: true,
            message: "Article ingestion queued.",
        }, { status: 202 });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
