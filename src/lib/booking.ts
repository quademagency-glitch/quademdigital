/**
 * Where "book a call" goes, for the whole site.
 *
 * The booking link was hardcoded in three separate places, and two of them
 * pointed at https://calendly.com/quadem-agency/..., which is not a Calendly
 * account at all. It answers 404. Anyone who clicked Book a call on /global or
 * on the homepage price calculator reached a Calendly error page.
 *
 * The likely origin of the mistake is that `quadem_agency` IS the correct
 * handle on X, so it reads as right. Calendly is `quademdigitalenterprise`.
 * Handles differ per platform and that is exactly the sort of thing nobody
 * re-checks once it is written down.
 *
 * The live address is `contactPage.calendlyUrl` in the CMS, which Ernest can
 * change without a deploy, and which was already correct: the contact page has
 * been booking calls this whole time while /global could not. So this reads the
 * CMS and falls back to the verified account, and every call-to-action on the
 * site now resolves through here.
 *
 * scripts/check-booking-links.mjs fetches whatever this returns and fails if it
 * 404s, so the next wrong handle is caught before it ships rather than by a
 * prospect who quietly gives up.
 */
import { payloadFetchGlobal } from './payload';

/**
 * The verified account and event, used when the CMS is unreachable or the field
 * is empty. Confirmed live on 29 August 2026. Do not change this to a handle
 * from another platform without opening it in a browser first.
 */
export const BOOKING_FALLBACK = 'https://calendly.com/quademdigitalenterprise/free-strategy-call';

/** A Calendly event URL, and nothing else. Anything odd falls back. */
function usable(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (!v) return false;
    try {
        const url = new URL(v);
        return url.protocol === 'https:' && url.hostname.endsWith('calendly.com');
    } catch {
        return false;
    }
}

/**
 * The booking URL, from the CMS, with no query string attached. Callers add
 * their own parameters: the embeds add theme and campaign values, a plain link
 * adds none.
 */
export async function getBookingUrl(): Promise<string> {
    try {
        const contactPage = await payloadFetchGlobal('contactPage');
        const fromCms = (contactPage as any)?.calendlyUrl;
        if (usable(fromCms)) return (fromCms as string).trim().split('?')[0];
    } catch {
        // Fall through. A booking link that loads is worth more than an accurate
        // error, and the guard script is what keeps the fallback honest.
    }
    return BOOKING_FALLBACK;
}
