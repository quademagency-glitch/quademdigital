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
export const PitchAssets: CollectionConfig = {
  slug: 'pitch-assets',
  labels: { singular: 'Pitch File', plural: 'Pitch Files' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'path',
    defaultColumns: ['path', 'pitch', 'filesize', 'updatedAt'],
    description:
      'The files that came with a pitch folder. Managed from the pitch itself: drop the folder there and these are rewritten.',
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
    /*
      What a static site is made of, and nothing that executes anywhere but a
      browser. No PHP, no archives, no binaries: this collection is served back
      to a prospect's browser by path, so the list is the allowlist.
    */
    mimeTypes: [
      'text/html',
      'text/css',
      'text/plain',
      'text/javascript',
      'application/javascript',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/avif',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'font/woff',
      'font/woff2',
      'font/ttf',
      'font/otf',
      'application/font-woff',
      'application/x-font-ttf',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
    ],
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
