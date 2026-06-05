import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { createClient } from '@sanity/client';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

// Sanity write client for updating campaign status
const sanityWriteClient = createClient({
    projectId: 'xectqauu',
    dataset: 'production',
    apiVersion: '2023-05-03',
    token: import.meta.env.SANITY_WRITE_TOKEN,
    useCdn: false,
});

const CAMPAIGN_SECRET = import.meta.env.CAMPAIGN_SECRET || 'Password123';
const AUDIENCE_ID = '6f7f906d-e7ff-4217-b425-1e15eb61e099';

// Convert Sanity Portable Text blocks to simple HTML for email
function portableTextToHtml(blocks: any[]): string {
    if (!blocks || !Array.isArray(blocks)) return '';

    return blocks.map(block => {
        // Handle image blocks
        if (block._type === 'image' && block.asset?._ref) {
            const ref = block.asset._ref;
            const url = `https://cdn.sanity.io/images/xectqauu/production/${ref.replace('image-', '').replace('-jpg', '.jpg').replace('-png', '.png').replace('-webp', '.webp').replace('-jpeg', '.jpeg')}?auto=format&fit=max&w=600&q=85`;
            const alt = block.alt || '';
            const caption = block.caption || '';
            return `<div style="text-align: center; margin: 24px 0;">
                <img src="${url}" alt="${alt}" style="max-width: 100%; border-radius: 8px;" />
                ${caption ? `<p style="color: #999; font-size: 14px; margin-top: 8px;">${caption}</p>` : ''}
            </div>`;
        }

        // Handle text blocks
        if (block._type !== 'block') return '';

        const style = block.style || 'normal';
        let text = '';

        if (block.children) {
            text = block.children.map((child: any) => {
                let content = child.text || '';
                if (child.marks && child.marks.length > 0) {
                    child.marks.forEach((mark: string) => {
                        if (mark === 'strong') content = `<strong>${content}</strong>`;
                        if (mark === 'em') content = `<em>${content}</em>`;
                        if (mark === 'underline') content = `<u>${content}</u>`;
                    });

                    // Handle link marks
                    const markDefs = block.markDefs || [];
                    child.marks.forEach((markKey: string) => {
                        const markDef = markDefs.find((m: any) => m._key === markKey);
                        if (markDef && markDef._type === 'link') {
                            content = `<a href="${markDef.href}" style="color: #00AEEF; text-decoration: underline;">${content}</a>`;
                        }
                    });
                }
                return content;
            }).join('');
        }

        if (!text.trim()) return '<br/>';

        switch (style) {
            case 'h1': return `<h1 style="color: #ffffff; font-size: 28px; margin: 24px 0 12px;">${text}</h1>`;
            case 'h2': return `<h2 style="color: #ffffff; font-size: 24px; margin: 20px 0 10px;">${text}</h2>`;
            case 'h3': return `<h3 style="color: #ffffff; font-size: 20px; margin: 16px 0 8px;">${text}</h3>`;
            case 'h4': return `<h4 style="color: #ffffff; font-size: 18px; margin: 14px 0 8px;">${text}</h4>`;
            case 'blockquote': return `<blockquote style="border-left: 3px solid #00AEEF; padding-left: 16px; margin: 16px 0; color: #cccccc; font-style: italic;">${text}</blockquote>`;
            default: return `<p style="color: #dddddd; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">${text}</p>`;
        }
    }).join('\n');
}

// Extract YouTube/Vimeo thumbnail
function getVideoThumbnail(url: string): string | null {
    if (!url) return null;
    
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    
    // Vimeo - return a placeholder since Vimeo thumbnails need an API call
    return null;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { campaignId, secret } = body;

        // Validate secret
        if (secret !== CAMPAIGN_SECRET) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!campaignId) {
            return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Fetch campaign from Sanity
        const campaign = await sanityWriteClient.fetch(
            `*[_type == "emailCampaign" && _id == $id][0] {
                subject,
                previewText,
                body,
                videoUrl,
                "videoFileUrl": videoFile.asset->url,
                ctaText,
                ctaUrl,
                status
            }`,
            { id: campaignId }
        );

        if (!campaign) {
            return new Response(JSON.stringify({ error: 'Campaign not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (campaign.status === 'sent') {
            return new Response(JSON.stringify({ error: 'Campaign has already been sent' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Build HTML email
        const bodyHtml = portableTextToHtml(campaign.body);
        
        // Video section
        let videoHtml = '';
        if (campaign.videoUrl) {
            const thumbnail = getVideoThumbnail(campaign.videoUrl);
            videoHtml = `
                <div style="text-align: center; margin: 24px 0;">
                    ${thumbnail ? `<a href="${campaign.videoUrl}" target="_blank"><img src="${thumbnail}" alt="Watch Video" style="max-width: 100%; border-radius: 8px; border: 2px solid #333;" /></a>` : ''}
                    <p style="margin-top: 12px;"><a href="${campaign.videoUrl}" target="_blank" style="color: #00AEEF; font-weight: 600; text-decoration: none;">▶ Watch Video</a></p>
                </div>
            `;
        }
        if (campaign.videoFileUrl) {
            videoHtml += `
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${campaign.videoFileUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: rgba(0,174,239,0.1); border: 1px solid #00AEEF; border-radius: 8px; color: #00AEEF; font-weight: 600; text-decoration: none;">📥 Download Video</a>
                </div>
            `;
        }

        // CTA button
        let ctaHtml = '';
        if (campaign.ctaText && campaign.ctaUrl) {
            ctaHtml = `
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${campaign.ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; background: #00AEEF; color: #000000; font-weight: 700; font-size: 16px; border-radius: 50px; text-decoration: none;">${campaign.ctaText}</a>
                </div>
            `;
        }

        const fullHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a12; color: #dddddd;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #050814, #0f1129); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <img src="https://quademdigital.com/images/logo.png" alt="Quadem Digital" width="140" style="margin-bottom: 16px;" />
                </div>
                
                <!-- Body -->
                <div style="padding: 40px 30px; background-color: #0a0a12;">
                    ${bodyHtml}
                    ${videoHtml}
                    ${ctaHtml}
                </div>
                
                <!-- Footer -->
                <div style="padding: 30px; text-align: center; border-top: 1px solid #1a1a2e; background-color: #050814; border-radius: 0 0 8px 8px;">
                    <p style="color: #666; font-size: 13px; margin: 0 0 8px;">Quadem Digital Enterprise</p>
                    <p style="color: #666; font-size: 12px; margin: 0;">
                        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #00AEEF; text-decoration: underline;">Unsubscribe</a>
                    </p>
                </div>
            </div>
        `;

        // Send broadcast via Resend
        const { data, error: broadcastError } = await resend.broadcasts.create({
            audienceId: AUDIENCE_ID,
            from: 'Quadem Digital <hello@quademdigital.com>',
            subject: campaign.subject,
            html: fullHtml,
            ...(campaign.previewText && { previewText: campaign.previewText }),
        });

        if (broadcastError) {
            console.error('Broadcast error:', broadcastError);
            return new Response(JSON.stringify({ error: 'Failed to create broadcast', details: broadcastError }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Send the broadcast
        if (data?.id) {
            await resend.broadcasts.send(data.id);
        }

        // Update campaign status in Sanity
        await sanityWriteClient.patch(campaignId)
            .set({ status: 'sent', sentAt: new Date().toISOString() })
            .commit();

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Campaign sent successfully!',
            broadcastId: data?.id
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Campaign API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
