import type { CollectionConfig, Where } from 'payload'
import { hasRole, isAdmin, nobody } from '../access/roles'
import { notify, teamIds } from '../lib/notify'

/**
 * Polls (spec 14.8): a question with choices, sent to the team or to chosen
 * people, with the results to Ernest. Each person has one vote, which they
 * can change until the poll closes; votes are one row each (poll-votes), so
 * two people voting at once never overwrite each other.
 *
 * Confirmations (spec 14.8): an announcement marked "Must confirm" asks each
 * reader to press "I have read this"; Ernest sees who has not.
 */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

const forMe = ({ req: { user } }: { req: { user?: unknown } }) => {
  const u = user as { id: number; role?: string } | null
  if (hasRole(u, 'admin')) return true
  if (!u || !hasRole(u, 'team')) return false
  return { and: [{ status: { in: ['open', 'closed'] } }, { or: [{ audience: { equals: 'everyone' } }, { recipients: { equals: u.id } }] }] } as Where
}

export const Polls: CollectionConfig = {
  slug: 'polls',
  labels: { singular: 'Poll', plural: 'Polls' },
  admin: { group: 'Team', useAsTitle: 'question', defaultColumns: ['question', 'status', 'closesAt', 'createdAt'] },
  defaultSort: '-createdAt',
  access: { read: forMe as never, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.status === 'open' && originalDoc?.status !== 'open' && !originalDoc?.openedAt) data.openedAt = new Date().toISOString()
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status === 'open' && previousDoc?.status !== 'open' && !previousDoc?.openedAt) {
          const to = doc.audience === 'everyone' ? (await teamIds(req, ['active', 'on-leave', 'on-notice'])).map((u) => u.id) : ((doc.recipients ?? []) as unknown[]).map((r) => Number(idOf(r)))
          await notify(req, { to, kind: 'poll', title: `A quick question: ${doc.question}`, body: 'One tap to answer.', link: `/polls/${doc.id}`, key: `poll:${doc.id}`, action: 'Answer it' })
        }
        return doc
      },
    ],
    // Its votes point at it.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.db.deleteMany({ collection: 'poll-votes', where: { poll: { equals: id } }, req })
      },
    ],
  },
  endpoints: [
    {
      /* Vote, or change a vote, while the poll is open. */
      path: '/:id/vote',
      method: 'post',
      handler: async (req) => {
        const user = req.user as { id: number } | null
        if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const id = Number(req.routeParams?.id)
        const poll = await req.payload.findByID({ collection: 'polls', id, depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
        if (!poll) return Response.json({ error: 'Not found.' }, { status: 404 })
        if (poll.status !== 'open' || (poll.closesAt && new Date(poll.closesAt).getTime() + 86_400_000 <= Date.now())) return Response.json({ error: 'This poll has closed.' }, { status: 400 })
        const body = ((await req.json?.().catch(() => null)) ?? {}) as { choice?: unknown }
        const choice = String(body.choice ?? '')
        if (!((poll.choices ?? []) as { id?: string }[]).some((c) => c.id === choice)) return Response.json({ error: 'Choose one of the answers.' }, { status: 400 })
        const key = `${id}:${user.id}`
        const existing = await req.payload.find({ collection: 'poll-votes', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
        const at = new Date().toISOString()
        if (existing.docs[0]) await req.payload.db.updateOne({ collection: 'poll-votes', id: existing.docs[0].id, data: { choice, at }, req, returning: false })
        else await req.payload.create({ collection: 'poll-votes', data: { key, poll: id, user: user.id, choice, at } as never, overrideAccess: true, req })
        return Response.json({ ok: true })
      },
    },
  ],
  fields: [
    { name: 'question', type: 'text', required: true },
    { name: 'details', type: 'textarea' },
    {
      name: 'choices',
      type: 'array',
      minRows: 2,
      maxRows: 8,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
          ],
          admin: { width: '34%' },
        },
        {
          name: 'audience',
          type: 'select',
          required: true,
          defaultValue: 'everyone',
          options: [
            { label: 'The whole team', value: 'everyone' },
            { label: 'Chosen people', value: 'people' },
          ],
          admin: { width: '33%' },
        },
        { name: 'closesAt', label: 'Closes', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    { name: 'recipients', type: 'relationship', relationTo: 'users', hasMany: true, index: true, admin: { condition: (d) => d?.audience === 'people' } },
    { name: 'anonymous', label: 'Keep answers anonymous', type: 'checkbox', defaultValue: false, admin: { description: 'You see the counts, not who chose what.' } },
    { name: 'openedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}

export const PollVotes: CollectionConfig = {
  slug: 'poll-votes',
  labels: { singular: 'Poll vote', plural: 'Poll votes' },
  admin: { group: 'Team', hidden: true },
  access: {
    // Each person sees their own vote. Ernest sees the results; who voted what only when the poll is not anonymous (hook below).
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : user ? ({ user: { equals: user.id } } as Where) : false),
    create: nobody,
    update: nobody,
    delete: isAdmin,
  },
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        const reader = req.user as { id?: unknown; role?: string } | null
        if (reader?.role === 'admin' && doc && String(idOf(doc.user)) !== String(reader.id)) {
          const poll = await req.payload.findByID({ collection: 'polls', id: Number(idOf(doc.poll)), depth: 0, overrideAccess: true, req }).catch(() => null)
          if (poll?.anonymous) doc.user = null
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'poll', type: 'relationship', relationTo: 'polls', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'choice', type: 'text', required: true },
    { name: 'at', type: 'date' },
  ],
}

export const Confirmations: CollectionConfig = {
  slug: 'confirmations',
  labels: { singular: 'Confirmation', plural: 'Confirmations' },
  admin: { group: 'Team', hidden: true },
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : user ? ({ user: { equals: user.id } } as Where) : false),
    create: nobody,
    update: nobody,
    delete: isAdmin,
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'announcement', type: 'relationship', relationTo: 'announcements', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'at', type: 'date', required: true },
  ],
}
