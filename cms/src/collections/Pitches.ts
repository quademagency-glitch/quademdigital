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

export const Pitches: CollectionConfig = {
  slug: 'pitches',
  labels: { singular: 'Pitch Site', plural: 'Pitch Sites' },
  // Newest work first. The pitch you are thinking about is the one you touched
  // last, not the one you made first.
  defaultSort: '-updatedAt',
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    /*
      `live` is first because it is the column that answers "is this link
      working", and its cell reads the expiry date too: a pitch can be ticked
      Live and still be a 404. `viewCount` is next because the question after
      "is it up" is "have they opened it".
    */
    defaultColumns: ['live', 'title', 'client', 'viewCount', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'notes'],
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
    /*
      Hands the file back, out of the column it was read into.

      Nothing is stored, so Payload's own file route went looking on the disk
      for something that was never written there and logged
      "File <name> for collection pitches is missing on the disk" every time the
      admin rendered the upload card. The document is the file, so this answers
      with the document.

      `attachment`, never inline. Serving the pitch as a page from
      cms.quademdigital.com would put a copy of it outside every protection the
      site's own route gives it: no noindex, no expiry, no off switch. This is a
      download of the markup, for getting a file back out.

      Access is already checked before handlers run, so this is behind the same
      "must be logged in" rule as the rest of the collection.
    */
    handlers: [
      (_req, { doc }) => {
        const { html, filename } = doc as unknown as { html?: unknown; filename?: unknown }
        if (typeof html !== 'string' || !html) return
        const name = String(filename || 'pitch.html').replace(/[^A-Za-z0-9._-]/g, '')
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${name}"`,
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        })
      },
    ],
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
    /*
      The link panel sits at the top of the sidebar, because it is what this
      screen is for. Every other field exists to make that one line correct.
    */
    {
      name: 'linkPanel',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: './components/PitchLinkPanel#PitchLinkPanel' },
      },
    },
    /*
      Rendered by PitchViews on the edit screen, which turns the number into a
      sentence. It stays a real field rather than a `ui` one so that it can
      also be a column in the list, where a number is exactly what is wanted.
      `hidden` would have taken the column away with the input.
    */
    {
      name: 'viewCount',
      label: 'Opened',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        readOnly: true,
        components: { Field: './components/PitchViews#PitchViews' },
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
        components: { Cell: './components/PitchStatusCell#PitchStatusCell' },
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
      name: 'client',
      label: 'Prospect',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        position: 'sidebar',
        description: 'Optional. Link it to the client record once they exist as one.',
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

    {
      name: 'title',
      label: 'Name',
      type: 'text',
      required: true,
      admin: {
        description:
          'For your own list, not shown to the client. "Accra Dental Clinic mock-up" reads better in six months than "index". Leave it empty and the page\'s own title is used.',
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
    /*
      Reads the markup as it stands and says what it will do once it is not on
      this machine. The mistake the format invites is a reference to a second
      file that was never uploaded, and it stays silent until the prospect
      opens an unstyled page.
    */
    {
      name: 'health',
      type: 'ui',
      admin: { components: { Field: './components/PitchHealth#PitchHealth' } },
    },
    /*
      The markup itself, collapsed. It is the most important field on the
      document and the one least often edited: it arrives whole from the file
      above, and rendering a 200KB code box on every visit to this screen is a
      cost paid for nothing.
    */
    {
      type: 'collapsible',
      label: 'The page itself',
      admin: {
        initCollapsed: true,
        description: 'The markup being served. Open it for a small fix, drop the file again to replace it.',
      },
      fields: [
        {
          name: 'html',
          label: 'HTML',
          type: 'code',
          admin: {
            language: 'html',
            description: 'Filled in from the file you drop.',
          },
        },
      ],
    },

    /* Written by the page itself, never by hand: the beacon in
       src/pages/pitch/[...slug].ts posts to /api/pitch-view/ when somebody
       opens the pitch. Hidden because the panel above says it in words. */
    { name: 'firstViewedAt', type: 'date', admin: { readOnly: true, hidden: true } },
    { name: 'lastViewedAt', type: 'date', admin: { readOnly: true, hidden: true } },
  ],
}
