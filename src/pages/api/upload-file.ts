import type { APIRoute } from 'astro';

const CAMPAIGN_SECRET = import.meta.env.CAMPAIGN_SECRET || 'Password123';
const PUBLIC_PAYLOAD_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
const PAYLOAD_API_KEY = import.meta.env.PAYLOAD_API_KEY;

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

        // Upload file to Payload CMS Media collection
        const payloadFormData = new FormData();
        payloadFormData.append('file', file);
        
        const headers: Record<string, string> = {};
        if (PAYLOAD_API_KEY) {
            headers['Authorization'] = `users API-Key ${PAYLOAD_API_KEY}`;
        }
        
        const response = await fetch(`${PUBLIC_PAYLOAD_URL}/api/media`, {
            method: 'POST',
            headers,
            body: payloadFormData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Payload upload failed: ${errorText}`);
        }
        
        const asset = await response.json();

        return new Response(JSON.stringify({ 
            success: true, 
            url: `${PUBLIC_PAYLOAD_URL}${asset.doc.url}`,
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
