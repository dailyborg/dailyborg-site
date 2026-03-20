import { getRequestContext } from '@cloudflare/next-on-pages';

const dummyDb = {
    prepare: () => ({
        bind: () => ({
            run: () => Promise.resolve({ success: true }),
            all: () => Promise.resolve({ success: true, results: [] }),
            first: () => Promise.resolve(null)
        })
    }),
    batch: () => Promise.resolve([])
};

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
        // Fallback to dummy
    }
    return dummyDb;
}
