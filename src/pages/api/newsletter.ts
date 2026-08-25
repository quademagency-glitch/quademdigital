import type { APIRoute } from 'astro';
import { isValidEmail } from '../../utils/emailValidation';
import { recordSubscriber } from '../../lib/subscribers';
import { sendConfirmation } from '../../lib/confirmSubscription';

/**
 * The footer form had no method attribute, so it submitted a native GET here.
 * Only POST was exported, so every footer subscribe landed the visitor on a
 * 404. The form now posts, but keep this so a stray GET never shows a 404.
 */
export const GET: APIRoute = () =>
    new Response(null, { status: 303, headers: { Location: '/' } });

export const POST: APIRoute = async ({ request }) => {
    try {
        // Accept both the JSON fetch and a native form POST (the no-JS path).
        const contentType = request.headers.get('content-type') || '';
        let email: string | null;
        let isFormPost = false;

        if (contentType.includes('application/json')) {
            ({ email } = await request.json());
        } else {
            const form = await request.formData();
            email = form.get('email') ? String(form.get('email')) : null;
            isFormPost = true;
        }

        const bounce = (ok: boolean) =>
            new Response(null, {
                status: 303,
                headers: { Location: ok ? '/?check_inbox=1' : '/?subscribe_error=1' },
            });

        if (!email) {
            if (isFormPost) return bounce(false);
            return new Response(JSON.stringify({ error: 'Email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const emailCheck = isValidEmail(email);
        if (!emailCheck.valid) {
            if (isFormPost) return bounce(false);
            return new Response(JSON.stringify({ error: emailCheck.reason }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        /*
          1. Write to the list first, because that is the record.
             Resend used to be the only place a signup was stored, which meant
             the proof of consent lived in someone else's account and there was
             nowhere to ask whether this person had already opted out.
        */
        const subscriber = await recordSubscriber({
            email,
            source: 'newsletter',
            /*
              Pending, not subscribed. Anyone could type any address into this
              form and it went straight onto the list, which is how a list
              collects typos, addresses signed up by somebody else, and spam
              traps, and one spam trap is enough to get a sending domain
              blocked. Nobody counts as subscribed until they click a link in a
              message sent to the address itself.
            */
            status: 'pending',
        });

        /*
          Somebody who has already left is not put back on by filling the form
          again. recordSubscriber refuses to move them, so honour that here
          rather than sending them anything.
        */
        if (subscriber && !['pending', 'subscribed'].includes(subscriber.status)) {
            if (isFormPost) return bounce(true);
            return new Response(JSON.stringify({ success: true, message: 'Already handled' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        /*
          2. Someone already confirmed does not get asked again. Re-subscribing
             from the footer is usually a person who forgot they had, and a
             second "confirm your subscription" email reads as a mistake.
        */
        if (subscriber?.status === 'subscribed') {
            if (isFormPost) return bounce(true);
            return new Response(JSON.stringify({ success: true, message: 'Already subscribed' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        /*
          3. Ask them to confirm.

             The Resend audience add used to happen here. It now happens on
             /confirm/, so nobody reaches the audience without having proved
             they can read the inbox. The welcome email is gone with it: this
             message is the welcome, and sending both would mean two emails
             before anyone has agreed to one.
        */
        const asked = await sendConfirmation(email, subscriber?.unsubscribeToken || '');

        /*
          Ernest is told when somebody confirms, not when somebody types an
          address. That notification moved to /confirm/. Before, every typo and
          every address entered by a passer-by produced an email saying a new
          subscriber had arrived, which made the notification worth ignoring.
        */
        if (!asked) {
            if (isFormPost) return bounce(false);
            return new Response(JSON.stringify({
                success: false,
                error: 'The confirmation email could not be sent. Please try again.',
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (isFormPost) return bounce(true);
        return new Response(JSON.stringify({
            success: true,
            message: 'Check your inbox and click the link to confirm.',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Newsletter API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
