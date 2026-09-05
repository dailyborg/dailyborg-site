import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Google shut down the Civic Information "representatives" endpoint on 2025-04-30.
 * Address lookup is retired until a replacement source is chosen (see docs/STATUS.md).
 */
export async function POST() {
    return NextResponse.json(
        { success: false, error: 'Address lookup is not available. Pick a state on the Borg Record page to browse its officials.' },
        { status: 410 }
    );
}
