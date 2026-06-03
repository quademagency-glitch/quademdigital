import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('client_auth', { path: '/' });
  return redirect('/portal');
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('client_auth', { path: '/' });
  return redirect('/portal');
};
