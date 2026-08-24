import type { CollectionConfig } from 'payload'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { isAnyone } from '../access/isAnyone'

/**
 * Redirects, editable without a deploy.
 *
 * Until 2026-08-24 these lived in three hand-synced places: `redirects` in
 * `astro.config.mjs` (dev only), the `redirects` array in `vercel.json` (the
 * edge, and the only one that actually ran in production), and
 * `REDIRECTED_SERVICE_SLUGS` in `src/pages/sitemap.xml.ts` (so a redirected URL
 * stayed out of the sitemap). Adding one meant editing all three and shipping.
 * They are now read by `src/middleware.ts` on the site, and the sitemap derives
 * its exclusions from the same list.
 *
 * Only the www to apex rule stays in `vercel.json`, because it is
 * infrastructure rather than content: it has to work even when everything
 * downstream of it is broken.
 *
 * Paths are stored normalised (leading slash, no trailing slash) and matched
 * ignoring the trailing slash, so it does not matter which form gets typed in.
 */

/** Split a path from its query string and/or fragment, so we only touch the path. */
const splitPath = (value: string): [string, string] => {
  const cut = value.search(/[?#]/)
  return cut === -1 ? [value, ''] : [value.slice(0, cut), value.slice(cut)]
}

const isExternal = (value: string) => /^https?:\/\//i.test(value)

/** Leading slash, no trailing slash, no double slashes. `/` itself is rejected. */
const normaliseFrom = (value: unknown) => {
  if (typeof value !== 'string') return value
  let v = value.trim()
  if (!v) return v
  if (isExternal(v)) {
    // Someone pasted a full URL. Keep the path so the entry still works.
    try {
      const u = new URL(v)
      v = `${u.pathname}${u.search}${u.hash}`
    } catch {
      return v
    }
  }
  let [path, rest] = splitPath(v)
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return `${path}${rest}`
}

/**
 * Same, but internal destinations gain a trailing slash. The site runs
 * `trailingSlash: 'always'`, so sending a visitor to `/services/web-design`
 * makes Vercel bounce them again to `/services/web-design/`. Two hops for
 * nothing, and search engines follow every one of them.
 */
const normaliseTo = (value: unknown) => {
  if (typeof value !== 'string') return value
  const v = value.trim()
  if (!v || isExternal(v)) return v
  const normalised = normaliseFrom(v)
  if (typeof normalised !== 'string') return normalised
  const [path, rest] = splitPath(normalised)
  return `${path === '/' ? '/' : `${path}/`}${rest}`
}

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Redirect', plural: 'Redirects' },
  admin: {
    group: 'Settings',
    useAsTitle: 'fromPath',
    defaultColumns: ['fromPath', 'toPath', 'type', 'enabled', 'updatedAt'],
    description:
      'Send an old or mistyped address to the right page. Takes effect on the site within about a minute, with no deploy.',
  },
  access: {
    // The site reads these on every page request, using the editor API key.
    read: isAnyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    {
      name: 'fromPath',
      label: 'Old address',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'The address people are arriving on, starting with a slash. For example /case-study-1. The trailing slash does not matter.',
      },
      hooks: { beforeValidate: [({ value }) => normaliseFrom(value)] },
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !value.trim()) return 'Enter the old address.'
        const [path] = splitPath(value)
        if (path === '/') return 'The home page cannot be redirected.'
        if (!path.startsWith('/')) return 'Start the old address with a slash, for example /old-page.'
        if (/\s/.test(value)) return 'An address cannot contain spaces.'
        return true
      },
    },
    {
      name: 'toPath',
      label: 'Send them to',
      type: 'text',
      required: true,
      admin: {
        description:
          'Where they should end up. A page on this site starting with a slash, for example /projects/revamping-online-store/, or a full https:// address somewhere else.',
      },
      hooks: { beforeValidate: [({ value }) => normaliseTo(value)] },
      validate: (value: unknown, { siblingData }: any) => {
        if (typeof value !== 'string' || !value.trim()) return 'Enter where they should be sent.'
        if (/\s/.test(value)) return 'An address cannot contain spaces.'
        if (!value.startsWith('/') && !isExternal(value)) {
          return 'Start with a slash for a page on this site, or https:// for somewhere else.'
        }
        /*
          Compare paths only. `/x` sent to `/x/?utm=1` is still a loop: the
          middleware matches on the path and would send the visitor straight
          back, and the browser would bounce until it gave up.
        */
        const from = normaliseFrom(siblingData?.fromPath)
        if (typeof from === 'string' && from) {
          const fromKey = splitPath(from)[0]
          const toKey = isExternal(value) ? null : splitPath(normaliseFrom(value) as string)[0]
          if (toKey !== null && toKey === fromKey) {
            return 'This sends the address to itself, which would loop forever.'
          }
        }
        return true
      },
    },
    {
      name: 'type',
      label: 'Kind',
      type: 'select',
      required: true,
      defaultValue: 'permanent',
      options: [
        { label: 'Permanent (301). The page has moved for good.', value: 'permanent' },
        { label: 'Temporary (302). It will move back.', value: 'temporary' },
      ],
      admin: {
        description:
          'Permanent tells Google to pass the ranking from the old address to the new one, and browsers remember it for a long time. Choose temporary while you are still testing.',
      },
    },
    {
      name: 'enabled',
      label: 'Switched on',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Untick to stop this redirect without deleting it.' },
    },
    {
      name: 'note',
      label: 'Why this exists',
      type: 'textarea',
      admin: {
        description: 'For your own memory. Never shown on the site.',
      },
    },
  ],
}
