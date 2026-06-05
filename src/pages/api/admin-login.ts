import type { APIRoute } from 'astro';

const ADMIN_PASSWORD = import.meta.env.CAMPAIGN_SECRET || 'Password123';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const data = await request.json();
        const { password } = data;

        if (password === ADMIN_PASSWORD) {
            cookies.set('admin_auth', 'authenticated', {
                path: '/',
                httpOnly: true,
                secure: import.meta.env.PROD,
                sameSite: 'strict',
                maxAge: 60 * 60 * 24, // 24 hours
            });
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
    } catch {
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
    }
};
