import crypto from 'crypto'

/**
 * Preview links.
 *
 * Drafts are worth nothing if there is no way to look at one. These build the
 * "Preview" link Payload shows on a draft, pointing at a route on the Astro
 * site that is allowed to render unpublished content.
 *
 * The link is signed, because the site cannot otherwise tell a request from
 * this admin apart from a stranger guessing a slug, and an unsigned preview
 * route would publish every draft to anyone who found it.
 *
 * The key is derived from CMS_WEBHOOK_SECRET, which both apps already share
 * (it is what authenticates the client.won webhook), so preview needs no new
 * configuration. It is derived rather than used directly so that a leaked
 * preview link cannot be replayed against the webhook endpoint, and vice
 * versa. The site derives the same key the same way.
 */
const PREVIEW_KEY_INFO = 'quadem:preview:v1'

const previewKey = (): Buffer | null => {
  const base = process.env.CMS_WEBHOOK_SECRET?.trim()
  if (!base || base.length < 16) return null
  return crypto.createHmac('sha256', base).update(PREVIEW_KEY_INFO).digest()
}

/**
 * Signs collection + slug + expiry together, so a link cannot be edited to
 * point at a different document or to last longer than it was issued for.
 *
 * Be clear about what this does not do. Following a valid link sets a preview
 * cookie on the site, and that cookie is not scoped to this document: for the
 * hour it lasts, that browser can see any draft. Scoping it per document would
 * break navigation inside preview, and the only person who can generate a link
 * is an admin. So the honest guarantee is "an hour of draft access for whoever
 * holds a link", not "access to one post". Do not paste one into a shared
 * channel.
 */
export const signPreview = (collection: string, slug: string, exp: number): string | null => {
  const key = previewKey()
  if (!key) return null
  return crypto.createHmac('sha256', key).update(`${collection}:${slug}:${exp}`).digest('base64url')
}

const siteUrl = () =>
  (process.env.ASTRO_SITE_URL || 'https://quademdigital.com').replace(/\/$/, '')

/** Minutes a preview link stays valid. Long enough to read, short enough to expire. */
const TTL_MINUTES = 60

/**
 * Build the Preview link for one document. Returns null when the document has
 * no slug yet (a brand new unsaved draft) or the secret is missing, and Payload
 * then simply does not show the button, which is the honest outcome.
 */
export const previewUrl = (
  doc: Record<string, unknown> | undefined,
  collection: string,
  path: (slug: string) => string,
): string | null => {
  const slug = typeof doc?.slug === 'string' ? doc.slug : ''
  if (!slug) return null

  const exp = Date.now() + TTL_MINUTES * 60_000
  const sig = signPreview(collection, slug, exp)
  if (!sig) {
    console.error('[preview] CMS_WEBHOOK_SECRET missing or too short, no preview link')
    return null
  }

  const q = new URLSearchParams({ collection, slug, exp: String(exp), sig, path: path(slug) })
  return `${siteUrl()}/api/preview/?${q.toString()}`
}
