import type { APIRoute } from 'astro';
import { payloadFetch } from "../../lib/payload";
import { signSession } from "../../lib/session";

/**
 * Portal login.
 *
 * Two problems were fixed here together, because either alone still leaves the
 * portal open:
 *
 *  1. The endpoint had no rate limit, no lockout and no failure delay, while
 *     the codes behind it are six numeric digits. A million guesses against an
 *     unthrottled endpoint is minutes of work, and behind it sit client files,
 *     timelines and invoices.
 *
 *  2. On success it stored the client slug in the cookie as plain text, so
 *     guessing was optional anyway, because `Cookie: client_auth=quadem` walked in.
 *     The cookie is signed now (see lib/session.ts).
 */

// Module-scope, matching the pattern already used in lib/payload.ts. Per
// instance rather than global, so a determined attacker hitting many cold
// instances gets more attempts than the number below suggests: it raises the
// cost, it is not a wall. The real fix is the code length.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

// Keep the map from growing without bound on a long-lived instance.
function sweep() {
  const now = Date.now();
  for (const [ip, rec] of attempts) if (now - rec.first > WINDOW_MS) attempts.delete(ip);
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    const data = await request.json();
    const accessCode = data.accessCode;

    if (!accessCode) {
      return new Response(JSON.stringify({ error: "Access code is required" }), {
        status: 400,
      });
    }

    sweep();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      clientAddress ||
      'unknown';

    if (rateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please wait 15 minutes and try again." }),
        { status: 429 },
      );
    }

    // Query Payload for a client with this access code
    const clients = await payloadFetch('clients', {
      'where[accessCode][equals]': accessCode
    });
    const client = clients[0];

    if (!client) {
      // Fixed delay on failure: without it, the response time itself tells an
      // attacker whether a code exists, and unthrottled guessing stays cheap.
      await new Promise((r) => setTimeout(r, 600));
      return new Response(JSON.stringify({ error: "Invalid access code" }), {
        status: 401,
      });
    }

    const token = signSession(client.slug);
    if (!token) {
      // Fail closed. Signing off would mean issuing forgeable cookies again.
      return new Response(
        JSON.stringify({ error: "Sign-in is temporarily unavailable. Please contact us." }),
        { status: 503 },
      );
    }

    // Set a secure, HTTP-only cookie carrying the signed client slug
    cookies.set('client_auth', token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
};
