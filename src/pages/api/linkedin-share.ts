import type { APIRoute } from "astro";

// Handle CORS preflight for Sanity Studio
export const OPTIONS: APIRoute = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { documentId, type, title, slug, excerpt } = body;

        if (!title || !slug) {
            return new Response(JSON.stringify({ error: 'Missing title or slug' }), { 
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const linkedInToken = import.meta.env.LINKEDIN_ACCESS_TOKEN;
        const linkedInOrgId = import.meta.env.LINKEDIN_ORGANIZATION_ID;

        if (!linkedInToken || !linkedInOrgId) {
            return new Response(JSON.stringify({ error: 'LinkedIn Access Token or Organization ID missing on server' }), { 
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const postUrl = type === 'offer' ? `https://quademdigital.com/offers/${slug}` : `https://quademdigital.com/blog/${slug}`;
        
        let commentary = '';
        if (type === 'offer') {
            commentary = `Check out our latest special offer: "${title}"\n\n${excerpt ? excerpt + '\n\n' : ''}Claim the offer here: ${postUrl}`;
        } else {
            commentary = `We just published a new article: "${title}"\n\n${excerpt ? excerpt + '\n\n' : ''}Read the full post here: ${postUrl}`;
        }

        const payload = {
            author: `urn:li:organization:${linkedInOrgId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: commentary
                    },
                    shareMediaCategory: 'ARTICLE',
                    media: [
                        {
                            status: 'READY',
                            description: {
                                text: excerpt || 'Read our latest blog post.'
                            },
                            originalUrl: postUrl,
                            title: {
                                text: title
                            }
                        }
                    ]
                }
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
        };

        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${linkedInToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('LinkedIn API Error:', data);
            return new Response(JSON.stringify({ error: data.message || 'LinkedIn API rejected the request' }), { 
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        return new Response(JSON.stringify({ success: true, message: 'Shared to LinkedIn successfully!' }), { 
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });

    } catch (error: any) {
        console.error('Share LinkedIn Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
};
