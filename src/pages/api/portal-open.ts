import type { APIRoute } from 'astro';
import { verifyPortalOpen } from '../../lib/portalOpen';
import { SESSION_COOKIE_OPTIONS, withSession } from '../../lib/session';

/*
  "Open their portal" from the team portal (lib/portalOpen.ts): a link the CMS
  signed for one client, good for two minutes. It adds that client to the
  portals this browser is signed in to, as their access code would, and opens
  their portal in this tab. Anything wrong with the link is the sign-in page,
  never a hint of which part failed.
*/
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const client = url.searchParams.get('client');
  if (!verifyPortalOpen(client, url.searchParams.get('exp'), url.searchParams.get('sig'))) return redirect('/portal/');
  const token = withSession(cookies.get('client_auth')?.value, client!);
  if (!token) return redirect('/portal/');
  cookies.set('client_auth', token, SESSION_COOKIE_OPTIONS);
  return redirect(`/portal/?client=${encodeURIComponent(client!)}`);
};
