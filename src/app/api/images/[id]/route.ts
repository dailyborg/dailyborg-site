import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// Flat object keys only: no slashes, no traversal, nothing that could address another prefix.
const ID_RE = /^[a-zA-Z0-9._-]{1,120}$/;

// The Content-Type is decided here, from the extension, never taken from the stored R2 metadata.
// An uploader cannot make the browser treat an object as HTML or as a script.
const CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
};
const DEFAULT_CONTENT_TYPE = 'image/jpeg';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const fileId = resolvedParams.id;

        if (!fileId || !ID_RE.test(fileId)) {
            return new NextResponse('Invalid ID', { status: 400 });
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

        const extension = fileId.includes('.') ? fileId.split('.').pop()!.toLowerCase() : '';
        const headers = new Headers();
        headers.set('etag', object.httpEtag);
        headers.set('Content-Type', CONTENT_TYPES[extension] || DEFAULT_CONTENT_TYPE);
        headers.set('X-Content-Type-Options', 'nosniff');

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
