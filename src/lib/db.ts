import { getCloudflareContext } from '@opennextjs/cloudflare';

let localDbInstance: any = null;

/**
 * Fallback exclusively for local Next.js node server testing
 * Finds the correct isolated worker D1 instance
 */
export async function getD1Database() {
    if (localDbInstance) return localDbInstance;
    // If we are strictly in the Next.js Edge Runtime, we cannot import `fs` or `path`.
    // The Edge runtime is only used when deployed, at which point getCloudflareContext() should have worked.
    // If we're here on Edge, it means we don't have bindings and we can't use local files.
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_RUNTIME === 'edge') {
        console.warn("Attempted to load local mock DB inside the Edge Runtime. This is unsupported.");
        return null;
    }

    // Hide the imports from Next.js static analyzers by using a variable
    const fsMod = 'fs';
    const pathMod = 'path';
    const sqliteMod = 'better-sqlite3';

    // Dynamically import node modules to avoid Edge runtime build errors
    const fs = await import(/* webpackIgnore: true */ fsMod);
    const path = await import(/* webpackIgnore: true */ pathMod);
    const Database = (await import(/* webpackIgnore: true */ sqliteMod)).default;

    // Type casting helps avoid Edge compiler interpreting process.cwd
    const processAny = process as any;

    // We must find the exact sqlite file dynamically so this works on any machine
    // Next.js dev server creates its D1 emulator in the root .wrangler folder
    let d1Path = path.join(processAny.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
    if (!fs.existsSync(d1Path)) {
        // Fallback to worker directory if root doesn't exist
        d1Path = path.join(processAny.cwd(), 'workers', 'ingest', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
    }

    if (!fs.existsSync(d1Path)) {
        console.warn("Local D1 database not found at:", d1Path);
        return null;
    }

    const files = fs.readdirSync(d1Path)
        .filter((f: string) => f.endsWith('.sqlite'))
        .map((f: string) => ({ name: f, time: fs.statSync(path.join(d1Path, f)).mtime.getTime() }))
        .sort((a: any, b: any) => b.time - a.time);

    const sqliteFile = files.length > 0 ? files[0].name : undefined;

    if (!sqliteFile) {
        console.warn("No .sqlite file found in D1 directory.");
        return null;
    }

    const fullPath = path.join(d1Path, sqliteFile);
    localDbInstance = new Database(fullPath, { fileMustExist: true });

    // Polyfill the Cloudflare D1 .prepare().bind().run() syntax onto better-sqlite3 for local dev compatibility
    const d1Mock = {
        prepare: (query: string) => {
            const stmt = localDbInstance.prepare(query);
            return {
                bind: (...params: any[]) => {
                    return {
                        run: async () => {
                            try {
                                const info = stmt.run(...params);
                                return { success: true, meta: { changes: info.changes } };
                            } catch (e: any) {
                                console.error("Local DB Run Error:", e);
                                return { success: false, error: e.message };
                            }
                        },
                        all: async () => {
                            try {
                                const results = stmt.all(...params);
                                return { success: true, results };
                            } catch (e: any) {
                                console.error("Local DB All Error:", e);
                                return { success: false, results: [] };
                            }
                        }
                    };
                }
            };
        },
        batch: async (statements: any[]) => {
            // Rough mock for batch execution locally
            const results = [];
            for (const stmt of statements) {
                // Statements passed here are already bound if they follow the pattern
                // In local dev, we might just need to execute them
                try {
                    // Very naive batch mock since we can't extract the query easily
                    results.push({ success: true });
                } catch (e) {
                    results.push({ success: false });
                }
            }
            return results;
        }
    };

    return d1Mock;
}

export async function getDbBinding() {
    try {
        const { env } = await getCloudflareContext();
        if ((env as any).DB) return (env as any).DB;
    } catch (e) {
        // Not in Cloudflare Pages/Worker context, return local mock
        return getD1Database();
    }
    return getD1Database();
}
