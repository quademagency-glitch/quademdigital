import type { CollectionConfig } from 'payload'
import { isAdmin, nobody } from '../access/roles'

/**
 * The bell in the team portal (spec 5.13). Each row belongs to one person and
 * only they see it, admins included. Rows are made by the CMS (lib/notify.ts),
 * never typed; the only change anyone makes is marking one read.
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: 'Notification', plural: 'Notifications' },
  admin: {
    group: 'Team',
    useAsTitle: 'title',
    defaultColumns: ['title', 'user', 'kind', 'readAt', 'createdAt'],
    hidden: ({ user }) => user?.role !== 'admin',
  },
  defaultSort: '-createdAt',
  access: {
    read: ({ req: { user } }) => (user ? { user: { equals: user.id } } : false),
    create: nobody,
    update: ({ req: { user } }) => (user ? { user: { equals: user.id } } : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        // Marking read is the only change; everything else stays as it was made.
        if (operation === 'update') {
          const readAt = data.readAt === null ? null : (data.readAt ?? originalDoc?.readAt ?? new Date().toISOString())
          for (const k of Object.keys(data)) data[k] = originalDoc?.[k]
          data.readAt = readAt
        }
        return data
      },
    ],
  },
  endpoints: [
    {
      path: '/read-all',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const now = new Date().toISOString()
        await req.payload.update({
          collection: 'notifications',
          where: { and: [{ user: { equals: req.user.id } }, { readAt: { exists: false } }] },
          data: { readAt: now },
          overrideAccess: true,
          req,
        })
        return Response.json({ ok: true })
      },
    },
  ],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'kind', type: 'text', index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'link', type: 'text', admin: { description: 'A page in the team portal.' } },
    { name: 'key', type: 'text', unique: true, admin: { hidden: true } },
    { name: 'readAt', type: 'date', index: true },
  ],
}
