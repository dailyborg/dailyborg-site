import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const fileId = resolvedParams.id;
        
        if (!fileId) {
            return new NextResponse('Missing ID', { status: 400 });
        }

        const ctx = getRequestContext();
        if (!ctx || !ctx.env) {
            return new NextResponse('Edge Context Missing', { status: 500 });
        }

        const env = ctx.env as any;
        const bucket = env.IMAGE_BUCKET;

        if (!bucket) {
            return new NextResponse('Bucket Binding Missing', { status: 500 });
        }

        const object = await bucket.get(fileId);

        if (object === null) {
            return new NextResponse('Image Not Found', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        
        // Cache heavily at the edge to save R2 read operations
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new NextResponse(object.body, {
            headers,
        });

    } catch (error) {
        console.error("Image Delivery Error:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
