/**
 * Signed comment tokens.
 *
 * /api/comments used to trust a subscriber_id sent by the browser, so anyone who guessed or copied
 * an id could post as that subscriber. The auth route now hands out a short signed token instead and
 * the post route reads the subscriber id out of the signature, never out of the request body.
 *
 * Shape: <subscriber_id>.<expires>.<sig>
 *   expires = unix seconds, 30 days after the token was made
 *   sig     = first 32 hex characters of HMAC-SHA256(key, "<subscriber_id>.<expires>")
 *   key     = the raw SHA-256 digest bytes of "dailyborg-comments:" + ADMIN_PASSPHRASE
 *
 * The passphrase is read exactly the way src/lib/admin-auth.ts reads it, so there is no second
 * secret to configure. Web Crypto only: this runs on the edge runtime.
 */
import { readEnv } from "./admin-auth";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const KEY_PREFIX = "dailyborg-comments:";
const SIG_HEX_LENGTH = 32;

async function signingKey(): Promise<CryptoKey | null> {
    const passphrase = readEnv("ADMIN_PASSPHRASE");
    if (!passphrase || passphrase.length < 8) return null;
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(KEY_PREFIX + passphrase));
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function signPayload(payload: string): Promise<string | null> {
    const key = await signingKey();
    if (!key) return null;
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, SIG_HEX_LENGTH);
}

/** Returns a token for this subscriber, or null when ADMIN_PASSPHRASE is not configured. */
export async function makeCommentToken(subscriberId: string): Promise<string | null> {
    if (!subscriberId) return null;
    const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const payload = `${subscriberId}.${expires}`;
    const sig = await signPayload(payload);
    if (!sig) return null;
    return `${payload}.${sig}`;
}

/** Returns the subscriber id carried by a valid, unexpired token, otherwise null. */
export async function verifyCommentToken(token: unknown): Promise<string | null> {
    if (typeof token !== "string" || token.length < 8 || token.length > 300) return null;

    // Read from the right so a subscriber id containing a dot could never split the token wrongly.
    const lastDot = token.lastIndexOf(".");
    if (lastDot < 1) return null;
    const secondDot = token.lastIndexOf(".", lastDot - 1);
    if (secondDot < 1) return null;

    const subscriberId = token.slice(0, secondDot);
    const expiresRaw = token.slice(secondDot + 1, lastDot);
    const sig = token.slice(lastDot + 1);

    if (!subscriberId) return null;
    if (!/^[0-9]{1,12}$/.test(expiresRaw)) return null;
    if (!/^[0-9a-f]{32}$/.test(sig)) return null;

    const expires = parseInt(expiresRaw, 10);
    if (!Number.isFinite(expires) || expires * 1000 <= Date.now()) return null;

    const expected = await signPayload(`${subscriberId}.${expires}`);
    if (!expected) return null;

    let diff = 0;
    for (let i = 0; i < SIG_HEX_LENGTH; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0 ? subscriberId : null;
}
