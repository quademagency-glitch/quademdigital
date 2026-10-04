import type { APIRoute } from 'astro';
import { cmsSign, noStore, SESSION_COOKIE, TOKEN } from '../../../lib/signing';

export const prerender = false;

/** The document being signed, fetched from the private bucket through the CMS. */
export const GET: APIRoute = async ({ params, cookies }) => {
  const token = params.token || '';
  if (!TOKEN.test(token)) return new Response('Not found', { status: 404, headers: noStore });
  const res = await cmsSign('document', { token, session: cookies.get(SESSION_COOKIE)?.value });
  if (!res.ok) return new Response(await res.text(), { status: res.status, headers: { ...noStore, 'Content-Type': 'application/json' } });
  return new Response(res.body, {
    headers: { ...noStore, 'Content-Type': 'application/pdf', 'Content-Disposition': res.headers.get('content-disposition') || 'inline' },
  });
};
