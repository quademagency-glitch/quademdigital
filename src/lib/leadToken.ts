import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 24 * 60 * 60 * 1000;
const key = () => import.meta.env.CMS_WEBHOOK_SECRET?.trim();
export const canSignLeadToken = () => Boolean(key() && key()!.length >= 16);

function signature(id: string | number, email: string, expires: number) {
    const secret = key();
    if (!secret || secret.length < 16) return null;
    return createHmac('sha256', secret)
        .update(JSON.stringify(['quadem:lead-update:v1', String(id), email.trim().toLowerCase(), expires]))
        .digest('base64url');
}

export function signLeadToken(id: string | number, email: string, now = Date.now()) {
    const expires = now + TTL_MS;
    const sig = signature(id, email, expires);
    return sig ? `${expires}.${sig}` : null;
}

export function verifyLeadToken(id: string | number, email: unknown, token: unknown, now = Date.now()) {
    if (typeof email !== 'string' || !email.trim() || typeof token !== 'string') return false;
    const [expiry, sig, extra] = token.split('.');
    const expires = Number(expiry);
    if (extra || !sig || !Number.isSafeInteger(expires) || expires <= now || expires > now + TTL_MS) return false;
    const expected = signature(id, email, expires);
    if (!expected) return false;
    const actualBytes = Buffer.from(sig);
    const expectedBytes = Buffer.from(expected);
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
