import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * Empty stand-in used only by `next dev` on this machine, where there is no Cloudflare request
 * context at all. It is never used on Pages: inside a real request a missing binding throws, so a
 * misconfigured deployment fails loudly instead of quietly answering "no rows" on every page.
 */
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

let warnedAboutMissingContext = false;

export async function getDbBinding() {
    let ctx: ReturnType<typeof getRequestContext> | null = null;
    try {
        ctx = getRequestContext();
    } catch (e) {
        // No Cloudflare request context: local `next dev` under Node. Warn once per process.
        if (!warnedAboutMissingContext) {
            warnedAboutMissingContext = true;
            console.warn("[db] No Cloudflare request context. Using the empty local stand-in database (next dev only).");
        }
        return dummyDb;
    }

    const env = (ctx?.env || {}) as any;
    const db = env.DB || env['dailyborg-db'] || env.dailyborg_db;
    if (!db) throw new Error("D1 binding DB is missing");
    return db;
}
