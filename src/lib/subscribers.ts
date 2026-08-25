import { isValidEmail } from '../utils/emailValidation';

/**
 * The mailing list, with one door into it.
 *
 * Before this, a signup was written to a Resend audience and nowhere else, and
 * the audience id was copied by hand into four files. Two problems came with
 * that. Resend held the only record of who had consented and when, which is the
 * one question that matters when somebody complains. And there was no place to
 * ask "has this person unsubscribed?", so every form that touched the list
 * happily added them back.
 *
 * Payload is the record now. Resend is the postman. Everything that puts a
 * person on the list goes through `recordSubscriber` so that the rules below
 * are applied once rather than remembered five times.
 */

/**
 * The Resend audience, named once and not configurable.
 *
 * It used to be read from RESEND_AUDIENCE_ID with this id as a fallback, and
 * that variable is set to `5e4d5e4d-5e4d-5e4d-5e4d-5e4d5e4d5e4d`, a placeholder
 * that has never been a real audience. There is exactly one audience on the
 * account, "General", and it is this one.
 *
 * The failure was invisible because **Resend answers 200 with an empty list for
 * an audience id that does not exist**, rather than 404. So the Monday report
 * has been stating "Newsletter contacts: 0" with complete confidence while five
 * people sat on the real list, and every won client was written to an audience
 * that is not there.
 *
 * An override buys the ability to change the list without a deploy, which has
 * never once been wanted, and costs a whole class of silent wrong answers.
 * One constant instead.
 */
export const NEWSLETTER_AUDIENCE_ID = '6f7f906d-e7ff-4217-b425-1e15eb61e099';

export type SubscriberSource =
  | 'newsletter'
  | 'contact-form'
  | 'lead-magnet'
  | 'client'
  | 'import'
  | 'manual'
  | 'other';

export interface SubscriberRecord {
  id: number | string;
  email: string;
  status: string;
  unsubscribeToken: string;
  /** True when this call created the row, rather than finding one already there. */
  isNew: boolean;
}

export interface RecordSubscriberInput {
  email: string;
  name?: string | null;
  source: SubscriberSource;
  sourceDetail?: string | null;
  interests?: string[] | null;
  /**
   * 'subscribed' for someone who asked to join the list. 'pending' for an
   * address that arrived another way, such as an enquiry form with no tick box
   * on it. Only 'subscribed' ever receives a campaign. Defaults to
   * 'subscribed'.
   */
  status?: 'subscribed' | 'pending';
  /**
   * Whether this counts as consent. Pass false when it does not, so that
   * `consentAt` stays empty rather than recording a claim nobody made. That
   * date is the evidence, and evidence that is not true is worse than none.
   * Defaults to true.
   */
  consented?: boolean;
}

/**
 * States nobody gets moved out of by filling in a form.
 *
 * Somebody who unsubscribed, hard bounced or pressed "spam" has given an
 * answer. Treating a later contact-form submission as fresh consent would put
 * them straight back on the list, which is how a sending domain ends up
 * blocklisted and is also simply not what they asked for. They can rejoin
 * deliberately through the newsletter form, which is handled below.
 */
const SETTLED = new Set(['unsubscribed', 'bounced', 'complained']);

const cmsUrl = (): string =>
  (import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000').replace(/\/$/, '');

const authHeaders = (): Record<string, string> | null => {
  const key = import.meta.env.PAYLOAD_API_KEY?.trim();
  if (!key) return null;
  return { 'Content-Type': 'application/json', Authorization: `users API-Key ${key}` };
};

const shape = (doc: any, isNew: boolean): SubscriberRecord => ({
  id: doc.id,
  email: doc.email,
  status: doc.status,
  unsubscribeToken: doc.unsubscribeToken,
  isNew,
});

/**
 * Put someone on the list, or update what is already known about them.
 *
 * Never throws. A mailing list write must not be able to take down a lead
 * capture, so every failure is logged and reported as null, and the caller
 * carries on. Returns the record, including the unsubscribe token, so the
 * caller can put a working unsubscribe link in whatever it sends next.
 */
export async function recordSubscriber(
  input: RecordSubscriberInput,
): Promise<SubscriberRecord | null> {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email).valid) return null;

  const headers = authHeaders();
  if (!headers) {
    console.error('[subscribers] PAYLOAD_API_KEY is not set, so the list cannot be written to');
    return null;
  }

  const base = cmsUrl();

  try {
    const found = await fetch(
      `${base}/api/subscribers?where[email][equals]=${encodeURIComponent(email)}&limit=1&depth=0`,
      { headers },
    );
    if (!found.ok) {
      console.error('[subscribers] lookup failed', found.status, await found.text());
      return null;
    }
    const existing = (await found.json())?.docs?.[0];

    if (existing) {
      const patch: Record<string, unknown> = {};

      // A name is worth filling in if it arrives later, but never worth
      // overwriting: the one already stored came from the person themselves.
      if (input.name && !existing.name) patch.name = input.name;

      // The earliest consent is the one that counts, so this is only ever set
      // when it is missing, and never by a caller that did not get consent.
      if (!existing.consentAt && input.consented !== false) {
        patch.consentAt = new Date().toISOString();
      }

      // Somebody who never confirmed, then asked again, is still just asking.
      // Anyone in a settled state stays there. See SETTLED above.
      if (existing.status === 'pending' && input.source === 'newsletter') {
        patch.status = 'subscribed';
      }

      if (Array.isArray(input.interests) && input.interests.length) {
        const merged = new Set([...(existing.interests || []), ...input.interests]);
        patch.interests = [...merged];
      }

      if (!Object.keys(patch).length) return shape(existing, false);

      const res = await fetch(`${base}/api/subscribers/${existing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error('[subscribers] update failed', res.status, await res.text());
        return shape(existing, false);
      }
      return shape((await res.json())?.doc ?? existing, false);
    }

    const res = await fetch(`${base}/api/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        name: input.name || null,
        status: input.status || 'subscribed',
        source: input.source,
        sourceDetail: input.sourceDetail || null,
        interests: input.interests?.length ? input.interests : null,
        consentAt: input.consented === false ? null : new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.error('[subscribers] create failed', res.status, await res.text());
      return null;
    }
    return shape((await res.json())?.doc, true);
  } catch (err) {
    console.error('[subscribers] could not reach the CMS', err);
    return null;
  }
}

/**
 * True when it is acceptable to send this person marketing email.
 *
 * Deliberately fails closed on an unknown answer: if the list cannot be read,
 * the safe assumption is that they might have opted out.
 */
export async function mayEmail(email: string): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(
      `${cmsUrl()}/api/subscribers?where[email][equals]=${encodeURIComponent(
        String(email).trim().toLowerCase(),
      )}&limit=1&depth=0`,
      { headers },
    );
    if (!res.ok) return false;
    const doc = (await res.json())?.docs?.[0];
    // Not on the list at all is fine: a transactional reply is not a campaign.
    if (!doc) return true;
    return !SETTLED.has(doc.status);
  } catch {
    return false;
  }
}

/** The link that takes someone off the list. Safe to put in any email. */
export const unsubscribeUrl = (token: string): string =>
  `${(import.meta.env.SITE_URL || 'https://quademdigital.com').replace(/\/$/, '')}/unsubscribe/?t=${encodeURIComponent(token)}`;
