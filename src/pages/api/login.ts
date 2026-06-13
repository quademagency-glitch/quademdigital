import type { APIRoute } from 'astro';
import { payloadFetch } from "../../lib/payload";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const accessCode = data.accessCode;

    if (!accessCode) {
      return new Response(JSON.stringify({ error: "Access code is required" }), {
        status: 400,
      });
    }

    // Query Payload for a client with this access code
    const clients = await payloadFetch('clients', {
      'where[accessCode][equals]': accessCode
    });
    const client = clients[0];

    if (!client) {
      return new Response(JSON.stringify({ error: "Invalid access code" }), {
        status: 401,
      });
    }

    // Set a secure, HTTP-only cookie with the client's slug
    cookies.set('client_auth', client.slug, {
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
