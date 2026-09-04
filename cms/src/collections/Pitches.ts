import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

/**
 * Pitch sites: a finished sample site, dropped in as a file, served at
 * quademdigital.com/pitch/<slug>/ and kept out of every index.
 *
 * The Wardrobe Theatre pitch is the reason this exists. That page was a
 * self-contained HTML document sent to one prospect, and putting it online
 * took a route file (src/pages/wardrobe/index.ts), a `Disallow` line in
 * public/robots.txt, a commit and a deploy. Doing that once was fine. Doing it
 * for every prospect means a code change per sales conversation, and the day
 * the robots line is forgotten the mock-up ranks for the prospect's own brand
 * name, which is the opposite of a pitch.
 *
 * So the document lives here instead. Drop the file, save, send the link.
 *
 * What goes in the drop zone is one self-contained .html file: styles, script
 * and fonts inline, images either as data: URIs or at an https:// address.
 * There is no second file to upload, because there is nowhere to upload it to;
 * a demo with `<link href="styles.css">` will render unstyled. Anything in the
 * CMS media library already has an https:// address and can be linked from the
 * markup, which is the intended way to use a picture too big to inline.
 *
 * The file itself is never stored (`disableLocalStorage`). Its text is read
 * out of the upload and kept in the `html` column, which is what the site
 * serves. That means no bucket to configure, nothing to lose on a redeploy,
 * and the markup stays editable here after it is dropped: fix a phone number
 * in the code box, save, and the live demo changes.
 *
 * Not indexed, by four separate mechanisms, because one of them silently not
 * working is how a private page ends up in a search result:
 *   - `Disallow: /pitch/` in public/robots.txt
 *   - /pitch/ excluded from the sitemap (src/pages/sitemap.xml.ts)
 *   - a `noindex, nofollow, noarchive` meta tag injected into every response
 *   - the same rule as an `X-Robots-Tag` header, which works even if the
 *     injection misses because the document has no <head>
 */

/**
 * Big enough for a single-page demo with its type and a few inlined images,
 * small enough to stay well under Vercel's response ceiling on the way out.
 * A demo above this is nearly always one with an uncompressed photograph
 * pasted into it as a data: URI.
 *
 * Checked in beforeChange rather than through `upload.limits`, which Payload
 * only accepts on the top-level config, where it would apply to video uploads
 * in the media library too.
 */
const MAX_BYTES = 2_000_000

/** Lowercase, hyphens, and `/` for the rare pitch that wants a second page. */
const PITCH_SLUG = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^[-/]+|[-/]+$/g, '')

const siteUrl = () => (process.env.ASTRO_SITE_URL || 'https://quademdigital.com').replace(/\/$/, '')

export const Pitches: CollectionConfig = {
  slug: 'pitches',
  labels: { singular: 'Pitch Site', plural: 'Pitch Sites' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'live', 'expiresAt', 'updatedAt'],
    description:
      'Sample sites sent to prospects. Drop a single self-contained .html file and it goes live at /pitch/<slug>/, hidden from search. Nothing here is ever listed on the site.',
  },
  /*
    Authenticated reads only.

    The site's own request carries the admin API key (see src/lib/payload.ts),
    which satisfies this the same way it does for invoices. A stranger hitting
    cms.quademdigital.com/api/pitches gets nothing, so the list of who is being
    pitched, and at what price, is not a public endpoint.
  */
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    // The bytes are read into the `html` column below and then thrown away.
    // Nothing ever serves this file from storage, so storing it would only
    // create something to lose.
    disableLocalStorage: true,
    /*
      Wider than it looks like it should be. What a browser reports for a
      dragged .html depends on the operating system, and a drop refused with
      "file type not allowed" is a dead end with nothing to do about it. The
      guard that matters is in beforeChange, which reads the file and rejects
      anything that is not markup with a message that says what to do instead.
    */
    mimeTypes: ['text/html', 'application/xhtml+xml', 'text/plain', 'application/octet-stream'],
    // A pitch can also be pasted straight into the code box, which is how a
    // one-line fix gets made without exporting the file again.
    filesRequiredOnCreate: false,
  },
  hooks: {
    beforeOperation: [
      /*
        Payload puts a unique index on `filename`, and the file being dropped
        here is called `index.html` every single time. Left alone, the second
        pitch would fail to save with a database error about a duplicate key.

        The name is not used for anything (the file is not stored and no URL
        points at it), so it is replaced with something guaranteed unique
        before Payload ever looks at it. beforeOperation runs before the upload
        is processed, which is why this is not in beforeChange.
      */
      ({ req }) => {
        if (req.file?.name) {
          const stem = slugify(String((req.data as any)?.slug || (req.data as any)?.title || 'pitch')) || 'pitch'
          req.file.name = `${stem.replace(/\//g, '-')}-${Date.now().toString(36)}.html`
        }
      },
    ],
    beforeChange: [
      /*
        The dropped file becomes the page. Everything else on this document is
        bookkeeping around it.
      */
      ({ req, data }) => {
        const file = req.file
        if (file?.data) {
          if (file.size > MAX_BYTES) {
            throw new APIError(
              `That file is ${(file.size / 1_000_000).toFixed(1)}MB. The limit is 2MB, and a demo over it is usually one with a full-size photograph pasted in as a data: URI. Link the picture from the media library instead.`,
              400,
            )
          }
          const html = file.data.toString('utf8')
          if (!/<[a-z!]/i.test(html)) {
            throw new APIError('That file does not look like HTML. Drop the exported index.html, not a zip or a screenshot.', 400)
          }
          data.html = html

          // Take the document's own <title> when nothing has been typed, so
          // dropping a file and pressing save is the whole job.
          if (!data.title) {
            const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            if (match) data.title = match[1].trim().slice(0, 120)
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      label: 'Name',
      type: 'text',
      required: true,
      admin: {
        description:
          'For your own list, not shown to the client. "Accra Dental Clinic mock-up" reads better in six months than "index".',
      },
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            const raw = value || data?.title || ''
            return raw ? slugify(String(raw)) : value
          },
        ],
      },
      validate: (value: unknown) =>
        typeof value === 'string' && PITCH_SLUG.test(value)
          ? true
          : 'Lowercase letters, numbers and hyphens. A "/" is allowed if this pitch has more than one page.',
      admin: {
        description:
          'The last part of the link: quademdigital.com/pitch/<slug>/. Use the client\'s name. Changing it after you have sent the link breaks the link you sent.',
      },
    },
    {
      name: 'link',
      label: 'Link to send',
      type: 'text',
      virtual: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Copy this into the email. It works as soon as the pitch is saved and Live is ticked.',
      },
      hooks: {
        afterRead: [({ data }) => (data?.slug ? `${siteUrl()}/pitch/${data.slug}/` : '')],
      },
    },
    {
      name: 'client',
      label: 'Prospect',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        position: 'sidebar',
        description: 'Optional. Link it to the client record once they exist as one.',
      },
    },
    /*
      The off switch.

      A pitch that has been turned down, or won and built, should stop being
      reachable at a link the prospect may have forwarded. Unticking this 404s
      the page immediately and keeps the document here for reference.
    */
    {
      name: 'live',
      label: 'Live',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Untick and the link 404s. The pitch itself is kept.',
      },
    },
    {
      name: 'expiresAt',
      label: 'Expires at',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
        description:
          'Optional. After this date the link 404s on its own, so a mock-up you quoted a price on cannot still be live a year later.',
      },
    },
    {
      name: 'html',
      label: 'The page',
      type: 'code',
      admin: {
        language: 'html',
        description:
          'Filled in from the file you drop. Edit it here for small fixes; drop the file again to replace it wholesale.',
      },
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        description: 'For you. What was quoted, what they asked for, what to change next.',
      },
    },
  ],
}
