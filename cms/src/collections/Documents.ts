import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { adminField, hasRole } from '../access/roles'
import { managedIds } from '../access/managers'
import { adminIds, notify, teamIds } from '../lib/notify'

/**
 * Every file the team works with (spec 5.6), in the private documents bucket,
 * never Media, which the world can read.
 *
 * Three kinds:
 * - library: the handbook, price sheet, scripts, pitch examples, brand files
 *   and training. Everyone on the team reads them; only an admin adds or
 *   replaces one. Replacing keeps the old file as an earlier version
 *   (`replaces` / `current`), and "Tell the team" sends a notice.
 * - personal: one person's own paperwork, such as their signed agreement and
 *   payout receipts. That person and admins. A person can add their own.
 * - record: a file on a lead or a task, such as a chat screenshot or a
 *   client's brief. Whoever can see the record, and admins.
 *
 * Downloads go through the CMS, which checks access every time and then hands
 * out a link that works for five minutes (signedDownloads in payload.config).
 * The library records when each team member first opens each version.
 *
 * ID copies and bank account numbers never come here (section 13).
 */

const MAX_BYTES = 20 * 1024 * 1024
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export const DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Documents' },
  admin: {
    group: 'Team',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'category', 'member', 'current', 'createdAt'],
    description: 'Files for the team. Private: never put ID copies or bank account numbers here.',
  },
  upload: {
    mimeTypes: DOCUMENT_TYPES,
  },
  access: {
    read: async ({ req }) => {
      const user = req.user
      if (hasRole(user, 'admin')) return true
      if (!hasRole(user, 'team') || !user) return false
      // A manager opens their people's receipts, to decide an expense claim. No other personal file.
      const people = await managedIds(req)
      return {
        or: [
          { kind: { equals: 'library' } },
          { and: [{ kind: { equals: 'personal' } }, { member: { equals: user.id } }] },
          ...(people.length ? [{ and: [{ kind: { equals: 'personal' } }, { category: { equals: 'receipt' } }, { member: { in: people } }] }] : []),
          { and: [{ kind: { equals: 'record' } }, { 'lead.assignedTo': { equals: user.id } }] },
          { and: [{ kind: { equals: 'record' } }, { 'task.assignedTo': { equals: user.id } }] },
          { and: [{ kind: { equals: 'record' } }, { 'task.createdBy': { equals: user.id } }] },
        ],
      } as Where
    },
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: ({ req: { user } }) => hasRole(user, 'admin'),
    // A team member can take back their own upload within the hour.
    delete: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      if (!hasRole(user, 'team') || !user) return false
      return { and: [{ uploadedBy: { equals: user.id } }, { createdAt: { greater_than: new Date(Date.now() - 3_600_000).toISOString() } }] } as Where
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        if (operation !== 'create') return data
        const size = (req.file as { size?: number } | undefined)?.size ?? data.filesize
        if (size && size > MAX_BYTES) throw new APIError('Files can be up to 20 MB.', 400)

        data.uploadedBy = user?.id ?? null
        if (hasRole(user, 'team')) {
          if (data.kind === 'library') throw new APIError('Only Ernest adds files to the team library.', 403)
          if (data.kind === 'personal') data.member = user!.id
        }
        if (data.kind === 'personal' && !data.member) throw new APIError('Say whose file this is.', 400)
        if (data.kind === 'record') {
          if (!data.lead === !data.task) throw new APIError('A file on a record belongs to one lead or one task.', 400)
          const collection = data.lead ? 'leads' : 'tasks'
          const record = await req.payload
            .findByID({ collection, id: Number(idOf(data.lead ?? data.task)), depth: 0, overrideAccess: false, user: user ?? undefined, req })
            .catch(() => null)
          if (!record) throw new APIError('That record is not there, or it is not yours.', 404)
        }
        if (data.kind === 'library' && data.replaces) {
          const old = await req.payload.findByID({ collection: 'documents', id: Number(idOf(data.replaces)), depth: 0, overrideAccess: true, req }).catch(() => null)
          if (!old || old.kind !== 'library') throw new APIError('The file being replaced is not in the library.', 400)
          data.title = data.title || old.title
          data.category = data.category || old.category
          // A new version of a policy is a policy, and asks everyone again.
          if (old.mustAccept) data.mustAccept = true
          data.version = (Number(old.version) || 1) + 1
        } else {
          data.version = 1
        }
        data.current = true
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const by = req.user as { id: number; name?: string } | null
        if (doc.kind === 'library' && doc.replaces) {
          await req.payload.db.updateOne({ collection: 'documents', id: Number(idOf(doc.replaces)), data: { current: false }, returning: false, req })
        }
        // A policy to accept asks everyone, and a new version asks again (spec 14.10).
        if (doc.kind === 'library' && doc.mustAccept) {
          await notify(req, {
            to: (await teamIds(req, ['active', 'invited', 'on-notice'])).map((u) => u.id),
            kind: 'policy',
            title: doc.replaces ? `Updated policy to accept: ${doc.title}` : `Policy to accept: ${doc.title}`,
            body: 'Read it, then press "I accept" on its page.',
            link: `/policies`,
            key: `policy:${doc.id}`,
            action: 'Read it',
          })
        }
        if (doc.kind === 'library' && doc.tellTeam && !doc.mustAccept) {
          await notify(req, {
            to: (await teamIds(req, ['active', 'invited', 'on-notice'])).map((u) => u.id),
            kind: 'library',
            title: doc.replaces ? `Updated in the library: ${doc.title}` : `New in the library: ${doc.title}`,
            body: doc.note || undefined,
            link: `/documents/${doc.id}`,
            key: `library:${doc.id}`,
            action: 'Open it',
          })
        }
        // Cost sheets and receipts come with their payout or payment, which already tells the person.
        if (doc.kind === 'personal' && !['cost-sheet', 'receipt'].includes(doc.category) && String(idOf(doc.member)) !== String(by?.id)) {
          await notify(req, {
            to: [Number(idOf(doc.member))],
            kind: 'library',
            title: `${by?.name || 'Ernest'} added a file for you: ${doc.title}`,
            link: '/documents',
            email: false,
          })
        }
        return doc
      },
    ],
  },
  endpoints: [
    {
      // "I accept": a team member accepts this version of a policy. A new version asks again.
      path: '/:id/accept',
      method: 'post',
      handler: async (req) => {
        if (!hasRole(req.user, 'team')) return Response.json({ error: 'Only a team member accepts a policy.' }, { status: 403 })
        const id = Number(req.routeParams?.id)
        const doc = (await req.payload.findByID({ collection: 'documents', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
        if (!doc || doc.kind !== 'library' || !doc.mustAccept) return Response.json({ error: 'That is not a policy to accept.' }, { status: 404 })
        if (doc.current === false) return Response.json({ error: 'A newer version is out. Accept that one.' }, { status: 409 })
        const accepted = ((doc.acceptedBy as { user?: unknown; at?: string }[]) ?? []).map((r) => ({ user: idOf(r.user), at: r.at }))
        if (!accepted.some((r) => String(r.user) === String(req.user!.id))) {
          await req.payload.update({ collection: 'documents', id, data: { acceptedBy: [...accepted, { user: req.user!.id, at: new Date().toISOString() }] } as never, overrideAccess: true, req })
          const by = req.user as { name?: string }
          await notify(req, { to: await adminIds(req), kind: 'policy', title: `${by.name || 'A team member'} accepted: ${doc.title}`, link: '/policies', email: false })
        }
        return Response.json({ ok: true })
      },
    },
    {
      // "Opened at 08:40": the first time each person opens each library version.
      path: '/:id/opened',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const id = Number(req.routeParams?.id)
        const doc = await req.payload.findByID({ collection: 'documents', id, depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
        if (!doc) return Response.json({ error: 'Not found.' }, { status: 404 })
        if (doc.kind !== 'library' || !hasRole(req.user, 'team')) return Response.json({ ok: true })
        const full = await req.payload.findByID({ collection: 'documents', id, depth: 0, overrideAccess: true, req })
        const opened = ((full.openedBy as { user?: unknown; at?: string }[]) ?? []).map((r) => ({ user: idOf(r.user), at: r.at }))
        if (!opened.some((r) => String(r.user) === String(req.user!.id))) {
          await req.payload.update({
            collection: 'documents',
            id,
            data: { openedBy: [...opened, { user: req.user.id, at: new Date().toISOString() }] } as never,
            overrideAccess: true,
            req,
          })
        }
        return Response.json({ ok: true })
      },
    },
  ],
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'library',
          index: true,
          options: [
            { label: 'Team library', value: 'library' },
            { label: 'One person', value: 'personal' },
            { label: 'On a lead or task', value: 'record' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'category',
          type: 'select',
          options: [
            { label: 'Handbook', value: 'handbook' },
            { label: 'Price sheet', value: 'price-sheet' },
            { label: 'Script', value: 'script' },
            { label: 'Pitch example', value: 'pitch-example' },
            { label: 'Brand', value: 'brand' },
            { label: 'Training', value: 'training' },
            { label: 'Agreement', value: 'agreement' },
            { label: 'Policy', value: 'policy' },
            { label: 'Cost sheet', value: 'cost-sheet' },
            { label: 'Receipt', value: 'receipt' },
            { label: 'Other', value: 'other' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'note', type: 'textarea', admin: { description: 'Optional: what it is, or what changed.' } },
    { name: 'member', label: 'Whose', type: 'relationship', relationTo: 'users', index: true, admin: { condition: (d) => d?.kind === 'personal' } },
    { name: 'lead', type: 'relationship', relationTo: 'leads', index: true, admin: { condition: (d) => d?.kind === 'record' } },
    { name: 'task', type: 'relationship', relationTo: 'tasks', index: true, admin: { condition: (d) => d?.kind === 'record' } },
    {
      type: 'row',
      fields: [
        { name: 'replaces', label: 'New version of', type: 'relationship', relationTo: 'documents', admin: { width: '50%', condition: (d) => d?.kind === 'library' } },
        { name: 'version', type: 'number', admin: { width: '25%', readOnly: true } },
        { name: 'current', label: 'Newest version', type: 'checkbox', defaultValue: true, index: true, admin: { width: '25%', readOnly: true } },
      ],
    },
    {
      name: 'mustAccept',
      label: 'A policy everyone must accept',
      type: 'checkbox',
      defaultValue: false,
      admin: { condition: (d) => d?.kind === 'library', description: 'Each person presses "I accept"; you see who has. A new version asks again.' },
    },
    // Before acceptedBy, so it can read it before the field rule hides it from a team member.
    {
      name: 'acceptedByMe',
      type: 'checkbox',
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [({ siblingData, req }) => ((siblingData?.acceptedBy as { user?: unknown }[]) ?? []).some((r) => String(idOf(r.user)) === String(req.user?.id))],
      },
    },
    {
      name: 'acceptedBy',
      label: 'Accepted by',
      type: 'array',
      access: { read: adminField, create: adminField, update: adminField },
      admin: { readOnly: true, condition: (d) => d?.kind === 'library' && d?.mustAccept },
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'users' },
        { name: 'at', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'tellTeam',
      label: 'Tell the team',
      type: 'checkbox',
      defaultValue: false,
      admin: { condition: (d) => d?.kind === 'library', description: 'Sends everyone a notice and an email when you save.' },
    },
    { name: 'uploadedBy', label: 'Added by', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    // Before openedBy, so it can read it before the field rule hides openedBy from a
    // team member: whether the viewer has opened this version (the joining checklist).
    {
      name: 'openedByMe',
      type: 'checkbox',
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [({ siblingData, req }) => ((siblingData?.openedBy as { user?: unknown }[]) ?? []).some((r) => String(idOf(r.user)) === String(req.user?.id))],
      },
    },
    {
      name: 'openedBy',
      label: 'Opened by',
      type: 'array',
      access: { read: adminField, create: adminField, update: adminField },
      admin: { readOnly: true, condition: (d) => d?.kind === 'library' },
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
