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
        const { env } = getRequestContext();
        if ((env as any)?.DB) {
            return (env as any).DB;
        }
    } catch (e) {
        // Not in Cloudflare Pages/Worker context, return local mock
    }
    return dummyDb;
}
