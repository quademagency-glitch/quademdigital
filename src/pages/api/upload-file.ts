import type { APIRoute } from 'astro';
import { createClient } from '@sanity/client';

const CAMPAIGN_SECRET = import.meta.env.CAMPAIGN_SECRET || 'Password123';

const sanityClient = createClient({
    projectId: 'xectqauu',
    dataset: 'production',
    apiVersion: '2023-05-03',
    token: import.meta.env.SANITY_WRITE_TOKEN,
    useCdn: false,
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const secret = formData.get('secret') as string;
        const file = formData.get('file') as File;

        if (secret !== CAMPAIGN_SECRET) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        if (!file || file.size === 0) {
            return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
        }

        // Convert File to Buffer for Sanity upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Sanity
        const asset = await sanityClient.assets.upload('file', buffer, {
            filename: file.name,
            contentType: file.type,
        });

        return new Response(JSON.stringify({ 
            success: true, 
            url: asset.url,
            filename: file.name
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Upload failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
