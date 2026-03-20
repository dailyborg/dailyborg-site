import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDbBinding } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function DebugPage() {
    let status = 'Initializing...';
    let dbError = null;
    let envKeys: string[] = [];
    let queryResult: any = null;

    try {
        const { env } = getRequestContext();
        envKeys = Object.keys(env || {});
        status = 'Context Found';
        
        const db = await getDbBinding();
        status = 'Binding Retrieved';
        
        const { results } = await db.prepare('SELECT count(*) as count FROM articles').all();
        queryResult = results;
        status = 'Query Successful';
    } catch (e: any) {
        dbError = e.message;
        status = 'Failed';
    }

    return (
        <div className="p-10 font-mono text-xs">
            <h1 className="text-xl font-bold mb-4 whitespace-nowrap">GRID DEBUG: {status}</h1>
            <div className="grid gap-4">
                <section className="border p-4">
                    <h2 className="font-bold border-b mb-2">Environment Keys</h2>
                    <pre>{JSON.stringify(envKeys, null, 2)}</pre>
                </section>
                {dbError && (
                    <section className="border p-4 bg-red-100 dark:bg-red-900">
                        <h2 className="font-bold border-b mb-2 text-red-600">Error</h2>
                        <pre>{dbError}</pre>
                    </section>
                )}
                {queryResult && (
                    <section className="border p-4">
                        <h2 className="font-bold border-b mb-2">D1 Results</h2>
                        <pre>{JSON.stringify(queryResult, null, 2)}</pre>
                    </section>
                )}
            </div>
        </div>
    );
}
