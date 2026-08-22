import type { APIRoute } from 'astro';
import {
  verifyPreviewLink,
  signPreviewSession,
  PREVIEW_COOKIE,
  PREVIEW_TTL_MS,
} from '../../lib/preview';

/**
 * Entry point for the CMS "Preview" button.
 *
 * Verifies the signed link, marks this browser as previewing, then sends it to
 * the real page. The page itself decides to fetch the draft rather than the
 * published version, so preview shows the actual template rather than a
 * separate approximation of it that can drift.
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const collection = url.searchParams.get('collection') || '';
  const slug = url.searchParams.get('slug') || '';
  const exp = url.searchParams.get('exp');
  const sig = url.searchParams.get('sig');
  const path = url.searchParams.get('path') || '/';

  if (!verifyPreviewLink(collection, slug, exp, sig)) {
    return new Response('Preview link is invalid or has expired. Open it again from the CMS.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  // Only ever redirect somewhere on this site. Without this an attacker could
  // not forge the signature, but a leaked link could be rewritten to bounce a
  // visitor off to another domain carrying the site's name.
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/';

  const session = signPreviewSession(Date.now() + PREVIEW_TTL_MS);
  if (!session) {
    return new Response('Preview is not configured on this deployment.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  cookies.set(PREVIEW_COOKIE, session, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax', // must survive the cross-site navigation from the CMS
    maxAge: PREVIEW_TTL_MS / 1000,
  });

  return redirect(safePath, 307);
};
