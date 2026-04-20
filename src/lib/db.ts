import { getRequestContext } from '@cloudflare/next-on-pages';
import path from 'path';

let localDbInstance: any = null;

// Mock to prevent hard crashes if all else fails
const dummyDb = {
    prepare: () => ({
        bind: () => ({
            run: () => Promise.resolve({ success: true }),
            all: () => Promise.resolve({ success: true, results: [] }),
            first: () => Promise.resolve(null)
        }),
        run: () => Promise.resolve({ success: true }),
        all: () => Promise.resolve({ success: true, results: [] }),
        first: () => Promise.resolve(null)
    }),
    batch: () => Promise.resolve([])
};

async function getD1Database() {
    if (localDbInstance) return localDbInstance;

    if (typeof process !== 'undefined' && process.env && process.env.NEXT_RUNTIME === 'edge') {
        return null; // Not allowed to use native fs in Edge
    }

    try {
        const fsMod = 'fs';
        const pathMod = 'path';
        const sqliteMod = 'better-sqlite3';
        const fs = await import(/* webpackIgnore: true */ fsMod);
        const path = await import(/* webpackIgnore: true */ pathMod);
        const Database = (await import(/* webpackIgnore: true */ sqliteMod)).default;
        
        const processAny = process as any;
        let d1Path = path.join(processAny.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
        
        if (!fs.existsSync(d1Path)) {
            d1Path = path.join(processAny.cwd(), 'workers', 'ingest', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
        }

        if (!fs.existsSync(d1Path)) return dummyDb;

        const files = fs.readdirSync(d1Path)
            .filter((f: string) => f.endsWith('.sqlite'))
            .map((f: string) => ({ name: f, time: fs.statSync(path.join(d1Path, f)).mtime.getTime() }))
            .sort((a: any, b: any) => b.time - a.time);

        const sqliteFile = files.length > 0 ? files[0].name : undefined;
        if (!sqliteFile) return dummyDb;

        const fullPath = path.join(d1Path, sqliteFile);
        localDbInstance = new Database(fullPath, { fileMustExist: true });
        
        return {
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
                                    return { success: false, error: e.message };
                                }
                            },
                            all: async () => {
                                try {
                                    const results = stmt.all(...params);
                                    return { success: true, results };
                                } catch (e: any) {
                                    return { success: false, results: [] };
                                }
                            }
                        };
                    }
                };
            },
            batch: async () => []
        };
    } catch(e) {
        return dummyDb;
    }
}

export async function getDbBinding() {
    try {
        const ctx = getRequestContext();
        if (ctx && ctx.env) {
            const env = ctx.env as any;
            if (env.DB) return env.DB;
            if (env['dailyborg-db']) return env['dailyborg-db'];
            if (env.dailyborg_db) return env.dailyborg_db;
        }
    } catch (e) {
        // Not in Cloudflare context, fallback below
    }

    // Natively executed via npm run dev!
    if (process.env.NODE_ENV === 'development') {
        const devDb = await getD1Database();
        if (devDb) return devDb;
    }

    return dummyDb;
}
