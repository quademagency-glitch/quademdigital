import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin, nobody } from '../access/roles'
import { CHANNEL_KINDS, channelKey, preview } from '../lib/messages'
import { notify } from '../lib/notify'

/**
 * Messages (spec 14.8): direct messages between two people, and team channels,
 * Everyone plus one per job role, with files. Calls stay in WhatsApp and
 * Google Meet.
 *
 * A team member reads Everyone, their own role's channel and the direct
 * conversations they are in. Messages are company records: Ernest can read
 * any of them, and the portal says so; his own list shows only his
 * conversations and the channels.
 *
 * Who has read what is one row per person per channel (channel-reads), so two
 * people reading at once never overwrite each other.
 */

type Person = { id: number | string; role?: string | null; jobRole?: unknown; name?: string | null; email?: string | null }
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
const EDIT_WINDOW_MS = 10 * 60 * 1000

/** The channels a team member may read, as a query; `prefix` reaches them through a message or a file. */
export const channelsFor = (user: Person, prefix = ''): Where => {
  const role = idOf(user.jobRole)
  return {
    or: [
      { [`${prefix}kind`]: { equals: 'everyone' } },
      ...(role ? [{ and: [{ [`${prefix}kind`]: { equals: 'role' } }, { [`${prefix}jobRole`]: { equals: role } }] }] : []),
      { [`${prefix}members`]: { equals: user.id } },
    ],
  } as Where
}

/** Ernest's own list: the channels, and the conversations he is in. */
const listedFor = (user: Person): Where =>
  hasRole(user as never, 'admin') ? ({ or: [{ kind: { in: ['everyone', 'role'] } }, { members: { equals: user.id } }] } as Where) : channelsFor(user)

/** Everyone's channel, and one per job role in use, made the first time they are needed. */
async function ensureChannels(req: PayloadRequest, user: Person) {
  const want: { key: string; kind: 'everyone' | 'role'; name: string; jobRole?: number }[] = [{ key: channelKey.everyone(), kind: 'everyone', name: 'Everyone' }]
  const roles = hasRole(user as never, 'admin')
    ? (await req.payload.find({ collection: 'job-roles', where: { active: { not_equals: false } }, limit: 50, depth: 0, overrideAccess: true, req })).docs
    : idOf(user.jobRole)
      ? [await req.payload.findByID({ collection: 'job-roles', id: Number(idOf(user.jobRole)), depth: 0, overrideAccess: true, req }).catch(() => null)].filter(Boolean)
      : []
  for (const r of roles as { id: number; name: string }[]) want.push({ key: channelKey.role(r.id), kind: 'role', name: r.name, jobRole: r.id })
  const have = await req.payload.find({ collection: 'channels', where: { key: { in: want.map((w) => w.key) } }, limit: 100, depth: 0, overrideAccess: true, req })
  for (const w of want) {
    if (have.docs.some((c) => c.key === w.key)) continue
    await req.payload.create({ collection: 'channels', data: w as never, overrideAccess: true, req }).catch(() => undefined)
  }
}

/** Unread messages in each channel: written by someone else after the person last read it. */
async function unreadIn(req: PayloadRequest, user: Person, channels: { id: number | string }[]) {
  const reads = await req.payload.find({ collection: 'channel-reads', where: { user: { equals: user.id } }, limit: 500, depth: 0, overrideAccess: true, req })
  const lastRead = new Map(reads.docs.map((r) => [String(idOf(r.channel)), r.readAt as string]))
  const out = new Map<string, number>()
  for (const c of channels) {
    const since = lastRead.get(String(c.id))
    const { totalDocs } = await req.payload.count({
      collection: 'messages',
      where: { and: [{ channel: { equals: c.id } }, { author: { not_equals: user.id } }, ...(since ? [{ createdAt: { greater_than: since } }] : [])] },
      overrideAccess: true,
      req,
    })
    out.set(String(c.id), totalDocs)
  }
  return out
}

export const Channels: CollectionConfig = {
  slug: 'channels',
  labels: { singular: 'Channel', plural: 'Channels' },
  admin: { group: 'Team', useAsTitle: 'name', defaultColumns: ['name', 'kind', 'lastMessageAt'] },
  defaultSort: '-lastMessageAt',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : user && hasRole(user, 'team') ? channelsFor(user as Person) : false),
    create: nobody,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    // Its messages and read markers point at it and cannot be left behind.
    beforeDelete: [
      async ({ id, req }) => {
        for (const collection of ['messages', 'channel-reads'] as const) {
          await req.payload.db.deleteMany({ collection, where: { channel: { equals: id } }, req })
        }
      },
    ],
  },
  endpoints: [
    {
      /* The list for the Messages screen: names, the last message, and how many are unread. */
      path: '/mine',
      method: 'get',
      handler: async (req) => {
        const user = req.user as Person | null
        if (!user || !hasRole(user as never, 'admin', 'team')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        await ensureChannels(req, user)
        const found = await req.payload.find({ collection: 'channels', where: listedFor(user), sort: '-lastMessageAt', limit: 200, depth: 0, overrideAccess: true, req })
        const unread = await unreadIn(req, user, found.docs)
        const docs = []
        for (const c of found.docs) {
          let name = c.name as string | null
          let other: number | null = null
          if (c.kind === 'direct') {
            const otherId = ((c.members ?? []) as unknown[]).map(idOf).find((m) => String(m) !== String(user.id))
            const p = otherId ? await req.payload.findByID({ collection: 'users', id: Number(otherId), depth: 0, overrideAccess: true, req }).catch(() => null) : null
            name = p?.name || p?.email || 'Someone'
            other = otherId ? Number(otherId) : null
          }
          docs.push({ id: c.id, kind: c.kind, name, other, lastMessage: c.lastMessage ?? null, lastMessageAt: c.lastMessageAt ?? null, unread: unread.get(String(c.id)) ?? 0 })
        }
        // Everyone, then the role channels, then conversations, newest first.
        const rank = (k: unknown) => (k === 'everyone' ? 0 : k === 'role' ? 1 : 2)
        docs.sort((a, b) => rank(a.kind) - rank(b.kind) || String(b.lastMessageAt ?? '').localeCompare(String(a.lastMessageAt ?? '')))
        return Response.json({ docs, unread: docs.reduce((n, d) => n + d.unread, 0) })
      },
    },
    {
      /* Just the number, for the badges on every screen. */
      path: '/unread',
      method: 'get',
      handler: async (req) => {
        const user = req.user as Person | null
        if (!user || !hasRole(user as never, 'admin', 'team')) return Response.json({ unread: 0 })
        const found = await req.payload.find({ collection: 'channels', where: listedFor(user), limit: 200, depth: 0, overrideAccess: true, req })
        const unread = await unreadIn(req, user, found.docs)
        return Response.json({ unread: [...unread.values()].reduce((n, x) => n + x, 0) })
      },
    },
    {
      /* Who someone can message: the team, and Ernest. Names and job titles only. */
      path: '/people',
      method: 'get',
      handler: async (req) => {
        const user = req.user as Person | null
        if (!user || !hasRole(user as never, 'admin', 'team')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const found = await req.payload.find({
          collection: 'users',
          where: { or: [{ role: { equals: 'admin' } }, { and: [{ role: { equals: 'team' } }, { status: { in: ['invited', 'active', 'on-leave', 'on-notice'] } }] }] },
          sort: 'name',
          limit: 300,
          depth: 0,
          overrideAccess: true,
          req,
        })
        return Response.json({
          docs: found.docs.filter((u) => String(u.id) !== String(user.id)).map((u) => ({ id: u.id, name: u.name || u.email, jobTitle: u.role === 'admin' ? 'Founder' : (u.jobTitle ?? null) })),
        })
      },
    },
    {
      /* Open the conversation with someone, starting it if there is none yet. */
      path: '/direct',
      method: 'post',
      handler: async (req) => {
        const user = req.user as Person | null
        if (!user || !hasRole(user as never, 'admin', 'team')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const body = ((await req.json?.().catch(() => null)) ?? {}) as { with?: unknown }
        const other = await req.payload.findByID({ collection: 'users', id: Number(body.with), depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!other || String(other.id) === String(user.id) || !['admin', 'team'].includes(String(other.role)) || other.status === 'ended') {
          return Response.json({ error: 'Choose someone on the team.' }, { status: 400 })
        }
        const key = channelKey.direct(user.id, other.id)
        const found = await req.payload.find({ collection: 'channels', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
        const channel = found.docs[0] ?? (await req.payload.create({ collection: 'channels', data: { key, kind: 'direct', members: [user.id, other.id] } as never, overrideAccess: true, req }))
        return Response.json({ id: channel.id })
      },
    },
    {
      /* "I have read up to now", for the unread counts. One row per person per channel. */
      path: '/:id/read',
      method: 'post',
      handler: async (req) => {
        const user = req.user as Person | null
        if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const id = Number(req.routeParams?.id)
        const channel = await req.payload.findByID({ collection: 'channels', id, depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
        if (!channel) return Response.json({ error: 'Not found.' }, { status: 404 })
        const key = `${id}:${user.id}`
        const now = new Date().toISOString()
        const existing = await req.payload.find({ collection: 'channel-reads', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
        if (existing.docs[0]) await req.payload.db.updateOne({ collection: 'channel-reads', id: existing.docs[0].id, data: { readAt: now }, req, returning: false })
        else await req.payload.create({ collection: 'channel-reads', data: { key, channel: id, user: user.id, readAt: now } as never, overrideAccess: true, req }).catch(() => undefined)
        return Response.json({ ok: true })
      },
    },
  ],
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'name', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', required: true, options: [...CHANNEL_KINDS], index: true, admin: { width: '50%' } },
        { name: 'jobRole', label: 'Job role', type: 'relationship', relationTo: 'job-roles', index: true, admin: { width: '50%', condition: (d) => d?.kind === 'role' } },
      ],
    },
    { name: 'members', type: 'relationship', relationTo: 'users', hasMany: true, index: true, admin: { condition: (d) => d?.kind === 'direct' } },
    {
      type: 'row',
      fields: [
        { name: 'lastMessageAt', label: 'Last message', type: 'date', index: true, admin: { width: '40%', readOnly: true } },
        { name: 'lastMessage', label: 'Last message, in short', type: 'text', admin: { width: '60%', readOnly: true } },
      ],
    },
  ],
}

export const Messages: CollectionConfig = {
  slug: 'messages',
  labels: { singular: 'Message', plural: 'Messages' },
  admin: { group: 'Team', useAsTitle: 'body', defaultColumns: ['body', 'channel', 'author', 'createdAt'] },
  defaultSort: 'createdAt',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : user && hasRole(user, 'team') ? channelsFor(user as Person, 'channel.') : false),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: ({ req: { user } }) => (user ? ({ author: { equals: user.id } } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as Person
        if (operation === 'create') {
          data.author = user.id
          // Only into a channel they can see.
          const channel = await req.payload.findByID({ collection: 'channels', id: Number(idOf(data.channel)), depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
          if (!channel) throw new APIError('That conversation is not there, or it is not yours.', 404)
          data.body = String(data.body ?? '').trim().slice(0, 4000)
          if (!data.body && !data.attachment) throw new APIError('Write something, or add a file.', 400)
        } else {
          if (Date.now() - new Date(originalDoc?.createdAt).getTime() > EDIT_WINDOW_MS) throw new APIError('A message can be changed for ten minutes after it is sent.', 403)
          for (const k of Object.keys(data)) if (k !== 'body') data[k] = originalDoc?.[k]
          data.body = String(data.body ?? '').trim().slice(0, 4000)
          data.editedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const author = req.user as Person
        const channelId = Number(idOf(doc.channel))
        const line = preview(doc.body, Boolean(doc.attachment))
        // The list shows the newest first, with the last line. A plain column write: no hooks, no race over the whole row.
        await req.payload.db.updateOne({ collection: 'channels', id: channelId, data: { lastMessageAt: doc.createdAt, lastMessage: `${author.name || author.email}: ${line}`.slice(0, 160) }, req, returning: false })
        const channel = await req.payload.findByID({ collection: 'channels', id: channelId, depth: 0, overrideAccess: true, req })
        // A direct message tells the other person, by their own choice of email; channels show as unread instead.
        if (channel.kind === 'direct') {
          const to = ((channel.members ?? []) as unknown[]).map(idOf).filter((m) => String(m) !== String(author.id)) as number[]
          await notify(req, { to, kind: 'message', title: `${author.name || author.email} sent you a message`, body: line, link: `/messages/${channelId}`, action: 'Reply' })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'channel', type: 'relationship', relationTo: 'channels', required: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'body', type: 'textarea' },
    { name: 'attachment', label: 'File', type: 'relationship', relationTo: 'documents' },
    { name: 'editedAt', type: 'date', admin: { readOnly: true } },
  ],
}

export const ChannelReads: CollectionConfig = {
  slug: 'channel-reads',
  labels: { singular: 'Channel read', plural: 'Channel reads' },
  admin: { group: 'Team', hidden: true },
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : user ? ({ user: { equals: user.id } } as Where) : false),
    create: nobody,
    update: nobody,
    delete: isAdmin,
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'channel', type: 'relationship', relationTo: 'channels', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'readAt', type: 'date', required: true },
  ],
}
