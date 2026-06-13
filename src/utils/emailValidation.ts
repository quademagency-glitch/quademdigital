const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'grr.la',
  'sharklasers.com', 'tempmail.com', 'throwaway.email', 'yopmail.com',
  'spam4.me', 'trashmail.com', 'trashmail.me', 'fakeinbox.com', 'getnada.com',
  'maildrop.cc', '10minutemail.com', 'temp-mail.org', 'dispostable.com',
  'nada.email', 'getairmail.com', 'filzmail.com', 'spamgourmet.com',
  'spamgourmet.net', 'spamgourmet.org', 'mailnull.com', 'spamfree24.org',
  'mytrashmail.com', 'throwam.com', 'tempr.email', 'discard.email',
  'mailnesia.com', 'trashmail.at', 'trashmail.io', 'crap.email',
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): { valid: boolean; reason?: string } {
  const trimmed = email.trim();
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Please enter a valid email address.' };
  }
  const domain = trimmed.split('@')[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Disposable email addresses are not allowed.' };
  }
  return { valid: true };
}
