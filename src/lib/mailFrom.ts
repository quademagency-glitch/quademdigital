/**
 * The addresses this site sends from.
 *
 * hello@quademdigital.com is not a real mailbox. It hard-bounced on 2026-06-05
 * and Resend has suppressed it ever since, which means every message sent from
 * it was accepted by the API, returned no error, and was then discarded. That
 * hid a $10k enquiry for 19 days. The recipient side was moved to ernest@ at
 * the time, but six senders were left with hello@ still in their `from:`, so
 * replies to those went to a dead address.
 *
 * Centralised because the address was previously copied into six files, which
 * is why fixing it once did not fix it everywhere. Change it here.
 *
 * MAIL_FROM_ADDRESS overrides, for when a real hello@ mailbox exists. Whatever
 * it is set to must be a verified sending identity in Resend first.
 */
const address = (): string =>
  import.meta.env.MAIL_FROM_ADDRESS?.trim() || 'ernest@quademdigital.com';

/** `Name <address>`, the form Resend expects. */
export const mailFrom = (name: string): string => `${name} <${address()}>`;

/** The default sender, for anything that does not need its own display name. */
export const MAIL_FROM = () => mailFrom('Quadem Digital');
