import type { APIRoute } from 'astro';
import { sanityClient } from "sanity:client";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const accessCode = data.accessCode;

    if (!accessCode) {
      return new Response(JSON.stringify({ error: "Access code is required" }), {
        status: 400,
      });
    }

    // Query Sanity for a client with this access code
    const client = await sanityClient.fetch(
      `*[_type == "clientPortal" && accessCode == $accessCode][0]{ slug }`,
      { accessCode }
    );

    if (!client) {
      return new Response(JSON.stringify({ error: "Invalid access code" }), {
        status: 401,
      });
    }

    // Set a secure, HTTP-only cookie with the client's slug
    cookies.set('client_auth', client.slug.current, {
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
