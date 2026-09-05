/**
 * Edge cache for hot database reads.
 *
 * Uses the Cloudflare Cache API (caches.default), which every Pages Function and Worker has
 * without any binding or dashboard setting. Entries live in the data center that served the
 * request, so each data center does at most one database read per key per TTL.
 *
 * In local `next dev` (Node) there is no Cache API, so the loader simply runs every time.
 */

const CACHE_HOST = "https://cache.dailyborg.internal/";

function edgeCache(): Cache | null {
    try {
        const c = (globalThis as any).caches;
        return c && c.default ? (c.default as Cache) : null;
    } catch {
        return null;
    }
}

/**
 * Returns the cached JSON value for `key`, or runs `loader`, stores the result for `ttlSeconds`, and returns it.
 * Failures in the cache layer never fail the request; they fall through to the loader.
 */
export async function cachedJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cache = edgeCache();
    if (!cache) return loader();

    const cacheKey = new Request(CACHE_HOST + encodeURIComponent(key), { method: "GET" });
    try {
        const hit = await cache.match(cacheKey);
        if (hit) {
            return (await hit.json()) as T;
        }
    } catch {
        // fall through to loader
    }

    const data = await loader();
    try {
        const res = new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${Math.max(1, Math.floor(ttlSeconds))}`,
            },
        });
        await cache.put(cacheKey, res);
    } catch {
        // storing is best effort
    }
    return data;
}

/** Cache-Control header value for API responses that browsers may reuse for a short time. */
export function publicCacheHeaders(ttlSeconds: number, staleSeconds = ttlSeconds * 5): Record<string, string> {
    return { "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${staleSeconds}` };
}
