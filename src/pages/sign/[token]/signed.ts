import type { APIRoute } from 'astro';
import { cmsSign, noStore, SESSION_COOKIE, TOKEN } from '../../../lib/signing';

export const prerender = false;

/** The finished copy, once everyone has signed. */
export const GET: APIRoute = async ({ params, cookies }) => {
  const token = params.token || '';
  if (!TOKEN.test(token)) return new Response('Not found', { status: 404, headers: noStore });
  const res = await cmsSign('signed', { token, session: cookies.get(SESSION_COOKIE)?.value });
  if (!res.ok) return new Response(await res.text(), { status: res.status, headers: { ...noStore, 'Content-Type': 'application/json' } });
  const name = (res.headers.get('content-disposition') || '').replace(/^inline/, 'attachment');
  return new Response(res.body, { headers: { ...noStore, 'Content-Type': 'application/pdf', 'Content-Disposition': name || 'attachment; filename="signed.pdf"' } });
};
