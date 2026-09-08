import type { CollectionConfig } from 'payload'

/**
 * The rest of the folder.
 *
 * A pitch used to be one self-contained .html file, and the panel on the pitch
 * screen spent its time telling Ernest that `images/hero.jpg` would 404,
 * because there was nowhere to put it. This is that nowhere.
 *
 * One row per file in the dropped folder, apart from the index, which is read
 * into the pitch's own `html` column as before. `path` is the file's place
 * inside the folder ("images/hero.jpg", "css/style.css"), which is exactly what
 * the markup asks for, so nothing in the demo has to be rewritten: the site
 * serves /pitch/<slug>/images/hero.jpg out of this collection and the browser
 * resolves the relative reference to it on its own.
 *
 * Written by the folder endpoint on the Pitches collection, not by hand.
 * Dropping a folder again replaces every row for that pitch, and deleting a
 * pitch deletes its files, so nothing is left behind in the bucket.
 */
/**
 * What a static site is made of, by extension, and nothing that runs anywhere
 * but a browser. No PHP, no archives, no binaries.
 *
 * The extension decides the type, rather than whatever the browser said when
 * it handed the file over. Payload takes a non-image's type straight from the
 * upload, and what arrives there is a guess: curl calls a stylesheet
 * `application/octet-stream`, and a browser's guess depends on the operating
 * system's own table, so a font or an .avif can arrive as nothing in
 * particular. This list is both the allowlist and the answer, so the same
 * folder uploads the same way from anywhere, and the type served back to a
 * prospect is one this codebase chose.
 */
export const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain',
  map: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  pdf: 'application/pdf',
}

/** The type for a path, or nothing at all if we do not carry that kind of file. */
export const mimeForPath = (path: string): string | undefined =>
  MIME_BY_EXT[(path.split('.').pop() || '').toLowerCase()]

export const PitchAssets: CollectionConfig = {
  slug: 'pitch-assets',
  labels: { singular: 'Pitch File', plural: 'Pitch Files' },
  /*
    Not in the CMS.

    This is plumbing, not a thing to open: the files belong to a pitch, they are
    written by dropping a folder on that pitch, and they are listed on that
    pitch's own screen. A nav entry called "Pitch Files" is a second place to
    look after the same thing, and Ernest said so the day it appeared.

    `hidden` takes it out of the nav and out of the admin routes. The
    collection itself has to exist: it is where the bytes live, and the site
    reads it to serve /pitch/<slug>/images/hero.jpg.
  */
  admin: {
    hidden: true,
    useAsTitle: 'path',
  },
  /*
    Authenticated, like the pitches themselves. The site reads these with the
    admin API key and serves the bytes itself, so a prospect never talks to the
    CMS and the list of what a pitch is made of is not a public endpoint.
  */
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    // Every type MIME_BY_EXT can produce, and only those. The endpoint sets
    // the type from the path, so anything reaching this validator was chosen
    // here rather than declared by whatever did the uploading.
    mimeTypes: [...new Set(Object.values(MIME_BY_EXT))],
  },
  fields: [
    {
      name: 'pitch',
      type: 'relationship',
      relationTo: 'pitches',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'path',
      label: 'Path inside the folder',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'What the markup asks for. The site serves it at /pitch/<slug>/<path>.',
      },
    },
  ],
}
