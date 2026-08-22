import crypto from 'node:crypto';

/**
 * Draft preview, the site half.
 *
 * The CMS builds a signed link (see cms/src/lib/preview.ts) and this verifies
 * it. Without a signature the preview route would hand any unpublished draft to
 * anyone who guessed a slug, which is the opposite of what a draft is for.
 *
 * The key is derived from CMS_WEBHOOK_SECRET, already shared by both apps, so
 * preview needed no new configuration. Both sides must derive it identically:
 * change the info string here and you must change it there too.
 */
const PREVIEW_KEY_INFO = 'quadem:preview:v1';
const SESSION_INFO = 'quadem:preview-session:v1';

const baseSecret = (): string | null => {
  const s = import.meta.env.CMS_WEBHOOK_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
};

const derive = (info: string): Buffer | null => {
  const base = baseSecret();
  if (!base) return null;
  return crypto.createHmac('sha256', base).update(info).digest();
};

const timingSafeEqualStr = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** True when the link from the CMS is genuine and has not expired. */
export function verifyPreviewLink(
  collection: string,
  slug: string,
  exp: string | null,
  sig: string | null,
): boolean {
  if (!collection || !slug || !exp || !sig) return false;

  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const key = derive(PREVIEW_KEY_INFO);
  if (!key) return false;

  const expected = crypto
    .createHmac('sha256', key)
    .update(`${collection}:${slug}:${expiry}`)
    .digest('base64url');

  return timingSafeEqualStr(sig, expected);
}

/**
 * The cookie set after a valid link, so the following page load knows to render
 * the draft. Signed for the same reason the link is: an unsigned marker would
 * just be a header anyone could send.
 */
export function signPreviewSession(expiresAt: number): string | null {
  const key = derive(SESSION_INFO);
  if (!key) return null;
  const sig = crypto.createHmac('sha256', key).update(String(expiresAt)).digest('base64url');
  return `${expiresAt}.${sig}`;
}

/** True when this request is a genuine, unexpired preview session. */
export function isPreviewSession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  const idx = cookieValue.lastIndexOf('.');
  if (idx <= 0) return false;

  const expiresAt = Number(cookieValue.slice(0, idx));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = signPreviewSession(expiresAt);
  return Boolean(expected) && timingSafeEqualStr(cookieValue, expected!);
}

export const PREVIEW_COOKIE = 'quadem_preview';
/** Matches the link TTL in the CMS. */
export const PREVIEW_TTL_MS = 60 * 60 * 1000;
