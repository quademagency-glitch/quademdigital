import type { CollectionConfig, Where } from 'payload'
import { adminField, hasRole, isAdmin } from '../access/roles'
import { notify, teamIds } from '../lib/notify'

/**
 * One message from Ernest to the whole team or to chosen people (spec 5.9).
 *
 * Publishing it emails each recipient and puts it in their bell; it sits at the
 * top of their Today screen until they open it or `pinnedUntil` passes.
 * `readBy` records who opened it and when, which only an admin sees; a team
 * member gets `readByMe` instead.
 */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: { singular: 'Announcement', plural: 'Announcements' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'status', 'audience', 'publishedAt'] },
  defaultSort: '-publishedAt',
  access: {
    read: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'team') && user)
        return { and: [{ status: { equals: 'published' } }, { or: [{ audience: { equals: 'everyone' } }, { recipients: { in: [user.id] } }] }] } as Where
      return false
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.db.deleteMany({ collection: 'confirmations', where: { announcement: { equals: id } }, req })
      },
    ],
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.status === 'published' && !originalDoc?.publishedAt && !data.publishedAt) data.publishedAt = new Date().toISOString()
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, context }) => {
        if (context?.receipt) return doc
        if (doc.status === 'published' && previousDoc?.status !== 'published') {
          const to =
            doc.audience === 'everyone'
              ? (await teamIds(req, ['active', 'invited', 'on-notice'])).map((u) => u.id)
              : ((doc.recipients ?? []) as unknown[]).map((r) => Number(idOf(r)))
          await notify(req, {
            to,
            kind: 'announcement',
            title: doc.mustConfirm ? `Please read and confirm: ${doc.title}` : doc.title,
            body: doc.body ?? undefined,
            link: `/announcements/${doc.id}`,
            key: `announcement:${doc.id}`,
            action: doc.mustConfirm ? 'Read and confirm' : 'Read it in the portal',
            // One everyone must confirm is emailed whatever each person chose (spec 14.8).
            important: Boolean(doc.mustConfirm),
          })
        }
        return doc
      },
    ],
  },
  endpoints: [
    {
      /*
        "I have read this", on an announcement marked Must confirm (spec 14.8).
        One row per person, so two people confirming at once never overwrite
        each other; Ernest sees who has and who has not.
      */
      path: '/:id/confirm',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const id = Number(req.routeParams?.id)
        const doc = await req.payload.findByID({ collection: 'announcements', id, depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
        if (!doc) return Response.json({ error: 'Not found.' }, { status: 404 })
        if (!doc.mustConfirm) return Response.json({ error: 'This one needs no confirming.' }, { status: 400 })
        const key = `${id}:${req.user.id}`
        const seen = await req.payload.find({ collection: 'confirmations', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
        if (!seen.docs.length) {
          await req.payload.create({ collection: 'confirmations', data: { key, announcement: id, user: req.user.id, at: new Date().toISOString() } as never, overrideAccess: true, req })
        }
        return Response.json({ ok: true })
      },
    },
    {
      // "I have opened it": the read receipt. Only for someone the announcement is for.
      path: '/:id/read',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const id = Number(req.routeParams?.id)
        const doc = await req.payload.findByID({ collection: 'announcements', id, depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
        if (!doc) return Response.json({ error: 'Not found.' }, { status: 404 })
        const full = await req.payload.findByID({ collection: 'announcements', id, depth: 0, overrideAccess: true, req })
        const readBy = ((full.readBy as { user?: unknown; at?: string }[]) ?? []).map((r) => ({ user: idOf(r.user), at: r.at }))
        if (!readBy.some((r) => String(r.user) === String(req.user!.id))) {
          await req.payload.update({
            collection: 'announcements',
            id,
            data: { readBy: [...readBy, { user: req.user.id, at: new Date().toISOString() }] } as never,
            overrideAccess: true,
            context: { receipt: true },
            req,
          })
        }
        return Response.json({ ok: true })
      },
    },
  ],
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', admin: { rows: 8 } },
    {
      type: 'row',
      fields: [
        {
          name: 'audience',
          type: 'select',
          defaultValue: 'everyone',
          options: [
            { label: 'Everyone on the team', value: 'everyone' },
            { label: 'Chosen people', value: 'chosen' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'draft',
          index: true,
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'recipients',
      label: 'Chosen people',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      filterOptions: { role: { equals: 'team' } },
      admin: { condition: (data) => data?.audience === 'chosen' },
    },
    {
      type: 'row',
      fields: [
        { name: 'pinnedUntil', label: 'Pinned until', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'publishedAt', label: 'Published', type: 'date', admin: { width: '50%', readOnly: true } },
      ],
    },
    // Before readBy, so it can read it before the field rule hides readBy from a team member.
    {
      name: 'mustConfirm',
      label: 'Must confirm',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Each reader presses "I have read this", and you see who has not. It is emailed to everyone, whatever they chose.' },
    },
    {
      name: 'confirmedByMe',
      type: 'checkbox',
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            if (!req.user || !siblingData?.mustConfirm || !siblingData?.id) return false
            const found = await req.payload.find({ collection: 'confirmations', where: { key: { equals: `${siblingData.id}:${req.user.id}` } }, limit: 1, depth: 0, overrideAccess: true, req })
            return found.docs.length > 0
          },
        ],
      },
    },
    {
      name: 'readByMe',
      type: 'checkbox',
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [({ siblingData, req }) => ((siblingData?.readBy as { user?: unknown }[]) ?? []).some((r) => String(idOf(r.user)) === String(req.user?.id))],
      },
    },
    {
      name: 'readBy',
      label: 'Read by',
      type: 'array',
      access: { read: adminField, create: adminField, update: adminField },
      admin: { readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'user', type: 'relationship', relationTo: 'users', admin: { width: '50%' } },
            { name: 'at', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
      ],
    },
  ],
}
