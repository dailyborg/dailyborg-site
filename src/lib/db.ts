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

export async function getD1Database() {
    if (process.env.NODE_ENV === 'development') {
        const { getLocalD1Database } = require('./local-db');
        return getLocalD1Database();
    }
    return dummyDb;
}

export async function getDbBinding() {
    if (process.env.NODE_ENV === 'development') {
        return getD1Database();
    }
    try {
        const { env } = getRequestContext();
        console.log("Cloudflare Context DB exists?", !!(env as any).DB);
        if ((env as any).DB) return (env as any).DB;
    } catch (e) {
        // Not in Cloudflare Pages/Worker context, return local mock
        return dummyDb;
    }
    return dummyDb;
}
