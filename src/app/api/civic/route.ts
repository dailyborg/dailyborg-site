import { NextRequest, NextResponse } from 'next/server';
import { CivicService } from '@/lib/services/civic-service';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const address = body.address;

        if (!address || typeof address !== 'string') {
            return NextResponse.json({ success: false, error: 'Address is required to lookup localized politicians.' }, { status: 400 });
        }

        console.log(`[API /civic] Looking up officials for: ${address}`);
        const result = await CivicService.lookupAndIngest(address);

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            addressResolved: result.addressResolved,
            officialsFound: result.officialsFound,
            ingestedCount: result.ingestedCount,
            message: `Successfully resolved ${result.officialsFound} localized officials.`
        });

    } catch (error: any) {
        console.error("[API /civic] System boundary error:", error);
        return NextResponse.json({ success: false, error: 'Failed to complete the civic ingestion request.' }, { status: 500 });
    }
}
