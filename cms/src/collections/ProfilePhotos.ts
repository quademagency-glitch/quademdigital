import type { CollectionConfig } from 'payload'
import { nobody } from '../access/roles'

/** Self-service pictures live in the private bucket, never the public Media library. */
export const ProfilePhotos: CollectionConfig = {
  slug: 'profile-photos',
  admin: { hidden: true },
  upload: { mimeTypes: ['image/webp'], focalPoint: false, crop: false },
  access: {
    read: ({ req: { user } }) => Boolean(user && ['admin', 'team'].includes(user.role) && user.status !== 'ended'),
    create: nobody, update: nobody, delete: nobody,
  },
  fields: [{ name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true }],
}
