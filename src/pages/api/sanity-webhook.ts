import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify the request method
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.json();

    // Check if it's a clientPortal document
    if (body._type !== 'clientPortal') {
      return new Response('Ignored - Not a clientPortal document', { status: 200 });
    }

    const { clientName, clientEmail, accessCode } = body;

    if (!clientEmail || !accessCode) {
      return new Response('Missing required fields for email', { status: 400 });
    }

    const portalUrl = `https://quademdigital.com/portal`;

    // Construct the HTML Email
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://quademdigital.com/images/logo.webp" alt="Quadem Digital" width="150" />
        </div>
        <h1 style="color: #111; font-size: 24px; text-align: center; margin-bottom: 24px;">Your Client Portal is Ready!</h1>
        <p style="color: #444; font-size: 16px; line-height: 1.6;">Hi ${clientName},</p>
        <p style="color: #444; font-size: 16px; line-height: 1.6;">We have set up a secure, private dashboard for your project. You can log in at any time to check your project status, view recent updates, and securely access your deliverables (like invoices and design files).</p>
        
        <div style="background-color: #f9f9f9; border: 1px dashed #ccc; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Access Code</p>
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #00aEEF; letter-spacing: 2px;">${accessCode}</p>
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${portalUrl}" style="background-color: #00aEEF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block;">Log in to Portal</a>
        </div>

        <p style="color: #444; font-size: 16px; line-height: 1.6;">If you have any questions or have trouble logging in, please don't hesitate to reply to this email.</p>
        <br/>
        <p style="color: #444; font-size: 16px; line-height: 1.6;">Best,<br/><strong>The Quadem Digital Team</strong></p>
      </div>
    `;

    // Send the email via Resend
    const data = await resend.emails.send({
      from: 'Quadem Digital <support@quademdigital.com>',
      to: [clientEmail],
      subject: `Your Secure Client Portal - Quadem Digital`,
      html: htmlContent,
    });

    console.log("Resend Success:", data);

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
