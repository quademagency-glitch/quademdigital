import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { verifyAdminSession } from '../../lib/session';
import { mailFrom } from '../../lib/mailFrom';

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const AUDIENCE_ID = '6f7f906d-e7ff-4217-b425-1e15eb61e099';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // This endpoint emails the entire subscriber list, so it is the one that
        // most needed the auth it did not have. It used to compare a secret from
        // the request body against a server default of 'Password123', and the
        // page that calls it hardcoded that same string into client-side
        // JavaScript. Anyone who viewed source could broadcast from the sending
        // domain. It now requires the signed admin cookie and no secret is sent
        // from the browser at all.
        if (!verifyAdminSession(cookies.get('admin_auth')?.value)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const { subject, previewText, htmlBody, videoUrl, videoFileUrl, ctaText, ctaUrl } = body;

        if (!subject || !htmlBody) {
            return new Response(JSON.stringify({ error: 'Subject and body are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Build video section
        let videoHtml = '';
        if (videoUrl) {
            // YouTube thumbnail
            const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
            const thumbnail = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` : null;
            videoHtml += `
                <div style="text-align: center; margin: 24px 0;">
                    ${thumbnail ? `<a href="${videoUrl}" target="_blank"><img src="${thumbnail}" alt="Watch Video" style="max-width: 100%; border-radius: 8px; border: 2px solid #333;" /></a>` : ''}
                    <p style="margin-top: 12px;"><a href="${videoUrl}" target="_blank" style="color: #00AEEF; font-weight: 600; text-decoration: none;">▶ Watch Video</a></p>
                </div>
            `;
        }
        if (videoFileUrl) {
            videoHtml += `
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${videoFileUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: rgba(0,174,239,0.1); border: 1px solid #00AEEF; border-radius: 8px; color: #00AEEF; font-weight: 600; text-decoration: none;">📥 Download Video</a>
                </div>
            `;
        }

        // Build CTA button
        let ctaHtml = '';
        if (ctaText && ctaUrl) {
            ctaHtml = `
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; background: #00AEEF; color: #000000; font-weight: 700; font-size: 16px; border-radius: 50px; text-decoration: none;">${ctaText}</a>
                </div>
            `;
        }

        // Full branded email template
        const fullHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a12; color: #dddddd;">
                <div style="background: linear-gradient(135deg, #050814, #0f1129); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <img src="https://quademdigital.com/images/logo.webp" alt="Quadem Digital" width="140" style="margin-bottom: 16px;" />
                </div>
                <div style="padding: 40px 30px; background-color: #0a0a12;">
                    ${htmlBody}
                    ${videoHtml}
                    ${ctaHtml}
                </div>
                <div style="padding: 30px; text-align: center; border-top: 1px solid #1a1a2e; background-color: #050814; border-radius: 0 0 8px 8px;">
                    <p style="color: #666; font-size: 13px; margin: 0 0 8px;">Quadem Digital Enterprise</p>
                    <p style="color: #666; font-size: 12px; margin: 0;">
                        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #00AEEF; text-decoration: underline;">Unsubscribe</a>
                    </p>
                </div>
            </div>
        `;

        // Create and send broadcast via Resend
        const { data, error: broadcastError } = await resend.broadcasts.create({
            audienceId: AUDIENCE_ID,
            from: mailFrom('Quadem Digital'),
            subject: subject,
            html: fullHtml,
            ...(previewText && { previewText }),
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
