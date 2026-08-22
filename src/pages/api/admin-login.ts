import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { signAdminSession } from '../../lib/session';

/**
 * No fallback password. This used to default to the literal 'Password123',
 * which meant an unconfigured deployment shipped with a known password on an
 * endpoint that can email the entire subscriber list. Missing configuration now
 * refuses every login instead of accepting a guessable one.
 */
function adminPassword(): string | null {
    const p = import.meta.env.CAMPAIGN_SECRET?.trim();
    return p && p.length >= 12 ? p : null;
}

function matches(provided: string, expected: string): boolean {
    // Hash both sides first so timingSafeEqual never sees mismatched lengths,
    // which would throw and leak the expected length through the error path.
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const expected = adminPassword();
        if (!expected) {
            console.error('[admin-login] CAMPAIGN_SECRET missing or shorter than 12 characters');
            return new Response(JSON.stringify({ error: 'Admin login is not configured' }), { status: 503 });
        }

        const data = await request.json();
        const { password } = data;

        if (typeof password === 'string' && matches(password, expected)) {
            const session = signAdminSession();
            if (!session) {
                return new Response(JSON.stringify({ error: 'Admin login is not configured' }), { status: 503 });
            }
            cookies.set('admin_auth', session, {
                path: '/',
                httpOnly: true,
                secure: import.meta.env.PROD,
                sameSite: 'strict',
                maxAge: 60 * 60 * 24, // 24 hours
            });
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
    } catch {
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
    }
};
