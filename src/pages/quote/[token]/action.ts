import type { APIRoute } from 'astro';
import { cmsQuote, noStore, TOKEN, visitorOf } from '../../../lib/quote';

export const prerender = false;

/**
 * What the quotation page does: report that it was opened in a browser (not
 * by a link scanner), and accept or decline. The page sends those as JSON, the
 * way the signing page does; a browser without JavaScript posts the plain form
 * instead, and gets a redirect back to the page either way.
 */
export const POST: APIRoute = async ({ params, request, redirect, clientAddress }) => {
  const token = params.token || '';
  const page = `/quote/${token}/`;
  if (!TOKEN.test(token)) return new Response(null, { status: 404, headers: noStore });

  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...noStore, 'Content-Type': 'application/json' } });
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { return json({ error: 'That request could not be read.' }, 400); }
    if (body.action !== 'accept' && body.action !== 'decline') {
      // The page's script, once it runs: the quotation was opened by a person.
      await cmsQuote('open', { token, record: true }).catch(() => null);
      return new Response(null, { status: 204, headers: noStore });
    }
    const res = await cmsQuote(body.action, {
      token,
      name: String(body.name || '').slice(0, 120),
      agree: body.agree === true,
      reason: String(body.reason || '').slice(0, 1000),
      ...visitorOf(request, () => clientAddress),
    }).catch(() => null);
    if (!res) return json({ error: 'We could not reach our system just now. Try again in a moment.' }, 502);
    const data = await res.json().catch(() => ({}));
    return json(res.ok ? { ok: true } : { error: data.error || 'That did not work. Try again.' }, res.ok ? 200 : res.status);
  }

  const form = await request.formData().catch(() => null);
  const action = String(form?.get('action') || '');
  const back = (error?: string) => redirect(error ? `${page}?e=${encodeURIComponent(error.slice(0, 200))}` : `${page}?done=${action}`, 303);
  if (action !== 'accept' && action !== 'decline') return back('That did not work. Try again.');

  const res = await cmsQuote(action, {
    token,
    name: String(form?.get('name') || '').slice(0, 120),
    agree: form?.get('agree') === 'on',
    reason: String(form?.get('reason') || '').slice(0, 1000),
    ...visitorOf(request, () => clientAddress),
  }).catch(() => null);
  if (!res) return back('We could not reach our system just now. Try again in a moment.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return back(data.error || 'That did not work. Try again.');
  return back();
};
