import type { APIRoute } from 'astro';
import { cmsSign, cookiePath, noStore, SESSION_COOKIE, TOKEN, visitorOf } from '../../../lib/signing';

export const prerender = false;

const ACTIONS = new Set(['seen', 'code', 'verify', 'submit', 'decline']);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...noStore, 'Content-Type': 'application/json' } });

/**
 * Everything the signing page does: ask for a code, check it, sign, decline.
 * A correct code comes back from the CMS as a session, which is put in an
 * HTTP-only cookie here rather than handed to the page's script.
 */
export const POST: APIRoute = async ({ params, request, cookies, clientAddress }) => {
  const token = params.token || '';
  if (!TOKEN.test(token)) return json({ error: 'This signing link is not valid.' }, 404);
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return json({ error: 'That request could not be read.' }, 400); }
  const action = String(body.action || '');
  if (!ACTIONS.has(action)) return json({ error: 'Unknown action.' }, 400);

  const { action: _drop, ...rest } = body;
  // "seen" is the page reporting that it ran in a person's browser, which is
  // when the CMS records the link as opened (not when a link scanner fetches it).
  const target = action === 'seen' ? 'open' : action;
  const extra = action === 'seen' ? { record: true } : {};
  const res = await cmsSign(target, { ...rest, ...extra, token, session: cookies.get(SESSION_COOKIE)?.value, ...visitorOf(request, () => clientAddress) })
    .catch(() => null);
  if (!res) return json({ error: 'The signing service did not answer. Try again in a moment.' }, 502);
  const data = await res.json().catch(() => ({}));
  if (res.ok && action === 'verify' && typeof data.session === 'string') {
    cookies.set(SESSION_COOKIE, data.session, { path: cookiePath(token), httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict', maxAge: 2 * 60 * 60 });
    return json({ ok: true });
  }
  return json(data, res.status);
};
