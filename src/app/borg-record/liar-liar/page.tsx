import { LiarLiarClient } from "@/components/LiarLiarClient";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function LiarLiarPage() {
    return <LiarLiarClient />;
}
