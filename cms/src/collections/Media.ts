import type { CollectionConfig } from 'payload'

import {
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
  AVIF,
  IMAGE_WIDTHS,
  ORIGINAL_MAX_DIMENSION,
  VIDEO_ABSOLUTE_MAX_BYTES,
  VIDEO_AUTO_TRANSCODE_MAX_BYTES,
  WEBP,
} from '../lib/mediaPresets'

const isVideo = (mime?: string | null) => Boolean(mime?.startsWith('video'))

/** Shape shared by every generated video variant stored on the doc. */
const variantField = (name: string, label: string) => ({
  name,
  label,
  type: 'json' as const,
  admin: {
    readOnly: true,
    description: 'Generated automatically. Do not edit.',
    condition: (data: any) => isVideo(data?.mimeType),
  },
})

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'System' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'kind',
      label: 'Kind',
      type: 'select',
      options: [
        { label: 'Raw Upload', value: 'raw' },
        { label: 'Generated Mockup', value: 'mockup' },
      ],
      defaultValue: 'raw',
      admin: { description: 'Set automatically by the mockup pipeline for AI-generated device mockups.' },
    },
    {
      name: 'sourceImage',
      label: 'Source Image (for generated mockups)',
      type: 'relationship',
      relationTo: 'media',
      admin: { description: 'The raw image this mockup was generated from, when kind = Generated Mockup.' },
    },
    {
      name: 'videoUsage',
      label: 'How is this video used?',
      type: 'select',
      options: [
        { label: 'Background loop (silent, audio removed)', value: 'background' },
        { label: 'Plays with sound (keeps audio)', value: 'playable' },
      ],
      defaultValue: 'background',
      admin: {
        condition: (data: any) => isVideo(data?.mimeType),
        description:
          'Hero and service-page videos always play muted, so their audio track is bytes every visitor downloads and nobody hears. Choose "plays with sound" only for a video someone presses play on, such as a showreel in a case study.',
      },
    },
    {
      name: 'videoStatus',
      label: 'Optimisation status',
      type: 'select',
      options: [
        { label: 'Waiting to be optimised', value: 'pending' },
        { label: 'Optimising now', value: 'processing' },
        { label: 'Optimised', value: 'ready' },
        { label: 'Too large to optimise here', value: 'oversize' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        readOnly: true,
        condition: (data: any) => isVideo(data?.mimeType),
        description:
          'Until this reads "Optimised" the site plays the file exactly as it was uploaded, which is correct but heavy.',
      },
    },
    {
      name: 'videoError',
      label: 'Why optimisation failed',
      type: 'text',
      admin: {
        readOnly: true,
        condition: (data: any) => data?.videoStatus === 'failed' || data?.videoStatus === 'oversize',
      },
    },
    variantField('videoPoster', 'Poster frame'),
    variantField('videoMp4', 'MP4 (all browsers)'),
    variantField('videoMobile', 'MP4 (narrow screens)'),
    variantField('videoWebm', 'WebM (smaller, most browsers)'),
    {
      name: 'videoDuration',
      label: 'Duration (seconds)',
      type: 'number',
      admin: { readOnly: true, condition: (data: any) => isVideo(data?.mimeType) },
    },
    {
      name: 'videoWidth',
      type: 'number',
      admin: { readOnly: true, condition: (data: any) => isVideo(data?.mimeType) },
    },
    {
      name: 'videoHeight',
      type: 'number',
      admin: { readOnly: true, condition: (data: any) => isVideo(data?.mimeType) },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ req, data }) => {
        const file = req?.file
        if (!file) return data
        const mime = file.mimetype || ''
        const allowed = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES]
        // mimeTypes on the upload config only filters the file picker, which
        // is a convenience for whoever is clicking and no protection at all
        // for anything posting to the REST API.
        if (!allowed.includes(mime)) {
          throw new Error(
            `${mime || 'That file type'} cannot be uploaded here. Allowed: ${allowed.join(', ')}.`,
          )
        }
        if (isVideo(mime) && file.size > VIDEO_ABSOLUTE_MAX_BYTES) {
          throw new Error(
            `That video is ${(file.size / 1073741824).toFixed(1)}GB. Nothing on this site needs a file that large. Run "npm run optimize:video" on it first.`,
          )
        }
        return data
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (!isVideo(doc?.mimeType)) return
        const { deleteVideoDerivatives } = await import('../lib/videoPipeline')
        await deleteVideoDerivatives(req.payload, doc)
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, context, operation }) => {
        // The pipeline writes its results back through payload.update, which
        // fires this hook again. Without this guard that is an endless loop.
        if (context?.skipVideoPipeline) return doc
        if (!isVideo(doc?.mimeType) || !doc?.filename || !doc?.url) return doc

        const fileChanged = operation === 'create' || doc.filename !== previousDoc?.filename
        const usageChanged = doc.videoUsage !== previousDoc?.videoUsage
        if (!fileChanged && !usageChanged) return doc

        if ((doc.filesize || 0) > VIDEO_AUTO_TRANSCODE_MAX_BYTES) {
          req.payload.logger.warn(
            `media ${doc.id}: ${(doc.filesize / 1048576).toFixed(0)}MB video left untranscoded, over the ${VIDEO_AUTO_TRANSCODE_MAX_BYTES / 1048576}MB automatic limit`,
          )
          // Written through the adapter for the same reason the pipeline's
          // status writes are. See the note on setStatus in videoPipeline.ts.
          await req.payload.db.updateOne({
            collection: 'media',
            id: doc.id,
            data: {
              videoStatus: 'oversize',
              videoError: `This video is ${(doc.filesize / 1048576).toFixed(0)}MB, over the ${VIDEO_AUTO_TRANSCODE_MAX_BYTES / 1048576}MB the CMS will transcode on its own. Run "npm run optimize:video" on the original and upload the result.`,
            },
            returning: false,
          })
          return doc
        }

        // Deliberately not awaited. The editor's upload request returns as
        // soon as the file is stored; the transcode is minutes of work behind
        // a proxy that would time out long before it finished.
        const { processVideo } = await import('../lib/videoPipeline')
        void processVideo({
          payload: req.payload,
          id: doc.id,
          filename: doc.filename,
          keepAudio: doc.videoUsage === 'playable',
        })

        return doc
      },
    ],
  },
  upload: {
    mimeTypes: [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES],
    /*
      Nobody is ever served the original, so there is no reason to keep a 24
      megapixel phone photo at full size forever. `inside` caps the longest
      edge without cropping, and withoutEnlargement means a small upload is
      left exactly as it is rather than being blown up to the cap.
    */
    resizeOptions: {
      width: ORIGINAL_MAX_DIMENSION,
      height: ORIGINAL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    },
    formatOptions: WEBP,
    imageSizes: [
      // formatOptions has to be repeated per size. Set only at the top level it
      // applies to the uploaded file alone, and every resize falls back to
      // sharp's own default of quality 80 with effort 4. That is what made the
      // 800px copy of a blog cover 108KB when the 1024px original it was made
      // from was 137KB: 39% fewer pixels for 79% of the bytes. Same settings
      // everywhere means a derivative is never heavier per pixel than its
      // original.
      { name: 'thumb', width: IMAGE_WIDTHS.thumb, height: undefined, formatOptions: WEBP },
      { name: 'thumbnail', width: IMAGE_WIDTHS.thumbnail, height: undefined, formatOptions: WEBP },
      { name: 'card', width: IMAGE_WIDTHS.card, height: undefined, formatOptions: WEBP },
      { name: 'medium', width: IMAGE_WIDTHS.medium, height: undefined, formatOptions: WEBP },
      { name: 'large', width: IMAGE_WIDTHS.large, height: undefined, formatOptions: WEBP },
      { name: 'og', width: 1200, height: 630, formatOptions: WEBP },
      // AVIF alongside webp, for the two sizes big enough that a quarter fewer
      // bytes is worth several seconds of encoding. The frontend offers these
      // first in a <picture> and every browser that cannot read AVIF simply
      // ignores them and takes the webp, so there is nothing to detect.
      { name: 'mediumAvif', width: IMAGE_WIDTHS.medium, height: undefined, formatOptions: AVIF },
      { name: 'largeAvif', width: IMAGE_WIDTHS.large, height: undefined, formatOptions: AVIF },
    ],
  },
}
