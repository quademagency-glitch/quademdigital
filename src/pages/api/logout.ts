import type { APIRoute } from 'astro';
import { SESSION_COOKIE_OPTIONS, withoutSession } from '../../lib/session';

/*
  Signing out. A browser can be signed in to several client portals at once
  (lib/session.ts), so the Log out on a portal signs out of that one only and
  leaves the others open in their tabs. With no client named, every one goes.
*/
async function signOut(cookies: Parameters<APIRoute>[0]['cookies'], client: string) {
  const rest = client ? withoutSession(cookies.get('client_auth')?.value, client) : null;
  if (rest) cookies.set('client_auth', rest, SESSION_COOKIE_OPTIONS);
  else cookies.delete('client_auth', { path: '/' });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  await signOut(cookies, String(form?.get('client') ?? '').trim());
  return redirect('/portal/');
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  await signOut(cookies, '');
  return redirect('/portal/');
};
