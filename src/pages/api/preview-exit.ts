import type { APIRoute } from 'astro';
import { PREVIEW_COOKIE } from '../../lib/preview';

/** Leave preview and go back to seeing the site as a visitor sees it. */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  cookies.delete(PREVIEW_COOKIE, { path: '/' });
  const to = url.searchParams.get('to');
  const safePath = to && to.startsWith('/') && !to.startsWith('//') ? to : '/';
  return redirect(safePath, 307);
};
