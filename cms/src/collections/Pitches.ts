import type { CollectionConfig } from 'payload'
import { APIError, addDataAndFileToRequest } from 'payload'

import { mimeForPath } from './PitchAssets'

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
 * Two ways in, and the folder is the one to use.
 *
 * **A folder.** Drop the whole exported site, styles, script, images and all.
 * The index goes into the `html` column and everything else becomes a row in
 * `pitch-assets`, keyed by its place inside the folder, so `images/hero.jpg`
 * is served at /pitch/<slug>/images/hero.jpg and the markup's own relative
 * references resolve without a single line of it being rewritten. See the
 * `/:id/folder` endpoint below.
 *
 * **One file.** Payload's own drop zone still takes a single self-contained
 * .html, which is all a one-page demo with inline styles needs.
 *
 * Neither file is stored as a file (`disableLocalStorage` here, and the assets
 * go to the bucket the media library uses). The index's text is read into the
 * `html` column, which is what the site serves, so the markup stays editable
 * here after it is dropped: fix a phone number in the box, save, and the live
 * demo changes.
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

/**
 * A folder that is bigger than this is not a pitch, it is a photo library. The
 * ceiling is on the whole folder rather than each file, because twenty
 * uncompressed photographs is the shape the problem actually takes.
 */
const MAX_FOLDER_BYTES = 40_000_000
const MAX_FILES = 150

/**
 * The path a file had inside the dropped folder, made safe to serve back.
 *
 * `..` is the whole reason this exists: these paths are matched against a URL
 * later, and a file called `../../etc/passwd` is a request to be careless.
 * Windows separators are normalised because a folder zipped on Windows and
 * unzipped on a Mac keeps them.
 */
const safePath = (raw: string) =>
  String(raw || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/')

/**
 * Which file is the page.
 *
 * The shallowest index.html wins, because an export is normally a folder with
 * the index at its top and the assets beneath, and a second index.html deeper
 * in the tree is a sub-page rather than the front door.
 */
const pickIndex = (paths: string[]): string | undefined => {
  const indexes = paths.filter((p) => /(^|\/)index\.html?$/i.test(p))
  if (indexes.length) {
    return indexes.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0]
  }
  // A single .html file called anything else is unambiguous enough to accept.
  const html = paths.filter((p) => /\.html?$/i.test(p))
  return html.length === 1 ? html[0] : undefined
}

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
      The name is first because Payload links exactly one cell per row, the
      first active column, and that is the way into the document. Putting the
      status dot there instead left the list with nothing to click: a custom
      cell replaces the one Payload draws the link with, and that dot drew no
      link of its own. Status is second, where it still answers "is this link
      working" at a glance, and its cell reads the expiry as well as the
      tickbox because a pitch can be ticked Live and still be a 404.
    */
    defaultColumns: ['title', 'live', 'client', 'viewCount', 'updatedAt'],
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
      async (req, { params }) => {
        /*
          Looked up here rather than taken from the `doc` the route offers.
          That argument is only populated when the collection's read access
          returns a query constraint; this one returns a plain true for anyone
          logged in, so Payload never loads the document and `doc` arrives
          undefined. Access has already been checked by that point either way,
          which is why this can go straight to the record.
        */
        const { docs } = await req.payload.find({
          collection: 'pitches',
          where: { filename: { equals: params.filename } },
          limit: 1,
          depth: 0,
          overrideAccess: false,
          req,
        })
        const html = docs[0]?.html
        // Always a Response, never a fall-through: falling through would send
        // Payload back to the disk it has already failed to find this on.
        if (typeof html !== 'string' || !html) {
          return new Response('This pitch has no markup saved against it.', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
        const name = String(params.filename || 'pitch.html').replace(/[^A-Za-z0-9._-]/g, '')
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
  /*
    Everything a dropped folder needs, in one request.

    The browser cannot upload a directory: it uploads the files inside one, each
    carrying the path it had. This takes them all, decides which is the index,
    reads that into `html`, and writes the rest to `pitch-assets` under the path
    the markup will ask for.

    Replaces rather than merges. A folder is a snapshot of a finished site, and
    a re-export with a renamed image would otherwise leave the old one behind to
    be served for ever, which is the sort of thing nobody finds until a client
    does.
  */
  endpoints: [
    {
      path: '/:id/folder',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

        const id = (req.routeParams as { id?: string })?.id
        if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'Missing pitch id' }, { status: 400 })

        // Custom endpoints get an unparsed body. This is what fills req.files
        // and req.data, and without it both are empty with no error anywhere.
        await addDataAndFileToRequest(req)

        const paths: string[] = Array.isArray((req.data as any)?.paths) ? (req.data as any).paths : []
        const incoming = Object.entries(req.files || {}).flatMap(([field, value]) =>
          (Array.isArray(value) ? value : [value]).map((file) => ({ field, file })),
        )

        if (!incoming.length) return Response.json({ error: 'No files arrived.' }, { status: 400 })
        if (incoming.length > MAX_FILES) {
          return Response.json(
            { error: `${incoming.length} files. The limit is ${MAX_FILES}, and a pitch that needs more is carrying something it does not use.` },
            { status: 400 },
          )
        }

        /*
          Paths come alongside the files rather than in the filename, because a
          multipart filename is sanitised and a folder is exactly the thing
          whose separators would be sanitised away. The field name carries the
          index into that list.
        */
        const named = incoming.map(({ field, file }) => {
          const index = Number(field.replace(/^f/, ''))
          const declared = Number.isInteger(index) ? paths[index] : undefined
          return { file, path: safePath(declared || file.name) }
        })

        const total = named.reduce((sum, f) => sum + (f.file.size || 0), 0)
        if (total > MAX_FOLDER_BYTES) {
          return Response.json(
            { error: `That folder is ${(total / 1_000_000).toFixed(1)}MB. The limit is ${MAX_FOLDER_BYTES / 1_000_000}MB, and a page that heavy is painful on a phone, which is where a prospect opens it.` },
            { status: 400 },
          )
        }

        const index = pickIndex(named.map((f) => f.path))
        if (!index) {
          return Response.json(
            { error: 'No index.html in that folder, so there is no page to serve. Drop the folder that has one at its top level.' },
            { status: 400 },
          )
        }

        const indexFile = named.find((f) => f.path === index)!
        const html = indexFile.file.data.toString('utf8')
        if (!/<[a-z!]/i.test(html)) {
          return Response.json({ error: 'That index.html does not look like HTML.' }, { status: 400 })
        }
        if (indexFile.file.size > MAX_BYTES) {
          return Response.json(
            { error: `The index is ${(indexFile.file.size / 1_000_000).toFixed(1)}MB, over the ${MAX_BYTES / 1_000_000}MB limit for the page itself.` },
            { status: 400 },
          )
        }

        // Everything the index sits beside, relative to wherever the index was
        // found. An export nested one folder deep is the normal case, and its
        // markup asks for "images/hero.jpg", not "site/images/hero.jpg".
        const base = index.slice(0, index.lastIndexOf('/') + 1)
        const assets = named.filter(
          (f) => f !== indexFile && (!base || f.path.startsWith(base)),
        )

        const skipped: string[] = []

        try {
          await req.payload.update({
            collection: 'pitches',
            id,
            data: { html },
            overrideAccess: false,
            req,
          })

          await req.payload.delete({
            collection: 'pitch-assets',
            where: { pitch: { equals: id } },
            overrideAccess: false,
            req,
          })

          for (const { file, path } of assets) {
            const relative = base ? path.slice(base.length) : path
            if (!relative) continue
            /*
              The type comes from the path, not from the upload. What a browser
              declares depends on the operating system's own table, and curl
              calls a stylesheet application/octet-stream, so trusting it meant
              a folder that uploaded from one machine and failed from another.
              A file of a kind we do not carry is left out rather than failing
              the whole folder, and counted in the reply.
            */
            const mimetype = mimeForPath(relative)
            if (!mimetype) {
              skipped.push(relative)
              continue
            }
            await req.payload.create({
              collection: 'pitch-assets',
              data: { pitch: Number(id), path: relative },
              file: {
                data: file.data,
                mimetype,
                // Unique across every pitch, because Payload keeps one unique
                // index on filename for the whole collection and two pitches
                // both having images/hero.jpg is the ordinary case.
                name: `${id}__${relative.replace(/\//g, '__')}`.slice(0, 200),
                size: file.size,
              },
              overrideAccess: false,
              req,
            })
          }
        } catch (err) {
          req.payload.logger.error({ err }, 'pitch folder upload failed')
          return Response.json(
            { error: err instanceof Error ? err.message : 'The folder did not save.' },
            { status: 500 },
          )
        }

        return Response.json({
          index,
          files: assets.length - skipped.length,
          skipped,
          bytes: total,
        })
      },
    },
  ],
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
    afterDelete: [
      /*
        Take the folder with it.

        Without this, deleting a pitch leaves its images in the bucket for ever,
        attached to a row pointing at a document that no longer exists. Logged
        and swallowed rather than thrown: the pitch is already gone by the time
        this runs, so failing here would report an error for a delete that
        actually happened.
      */
      async ({ req, id }) => {
        try {
          await req.payload.delete({
            collection: 'pitch-assets',
            where: { pitch: { equals: id } },
            overrideAccess: false,
            req,
          })
        } catch (err) {
          req.payload.logger.error({ err, id }, 'could not delete the files belonging to a deleted pitch')
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
      The folder drop. Above the health panel deliberately: this is where the
      page comes from now, and the panel below it is the report on what landed.
    */
    {
      name: 'folder',
      type: 'ui',
      admin: { components: { Field: './components/PitchFolderDrop#PitchFolderDrop' } },
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
      The markup itself, in a section that starts closed.

      A plain textarea rather than the code editor, which is not a downgrade so
      much as the correction of one. Payload's collapsible renders its contents
      and animates the height to zero, so "collapsed" hides the field without
      saving any of the work: the code editor mounted anyway, tokenising a
      quarter of a megabyte of markup on every visit to a screen where the
      usual job is to copy a link. The Exotiq pitch is 250KB.

      Both field types store as the same column, so this is a change of what
      renders and nothing else. Editing works exactly as it did, and the
      highlighting is worth less here than the speed: the markup arrives
      finished from a file, and what happens in this box is a phone number.
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
          type: 'textarea',
          admin: {
            rows: 20,
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
