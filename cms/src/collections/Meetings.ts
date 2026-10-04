import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { refId } from '../lib/moneyContext'
import { notify } from '../lib/notify'

/**
 * Meetings (spec 14.5): one-to-ones, office hours and team meetings, with a
 * Google Meet link, an agenda, notes, and action items that become tasks.
 *
 * Each record is one meeting. A repeating one makes its next date by itself
 * once it has passed (lib/teamReminders.ts), so each date keeps its own notes.
 * Ernest arranges them; the people invited see them, can add to the agenda
 * beforehand, and get a notice that morning.
 */
export const MEETING_KINDS = [
  { label: 'One-to-one', value: 'one-to-one' },
  { label: 'Office hours', value: 'office-hours' },
  { label: 'Team meeting', value: 'team' },
]
const REPEATS = [
  { label: 'Once', value: 'none' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Every two weeks', value: 'fortnightly' },
  { label: 'Every month', value: 'monthly' },
]

/** The date of the next meeting in a series. */
export function nextDate(startsAt: string, repeat: string): string | null {
  const d = new Date(startsAt)
  if (repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (repeat === 'fortnightly') d.setUTCDate(d.getUTCDate() + 14)
  else if (repeat === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else return null
  return d.toISOString()
}

/** Action items without a task get one, given to their owner. */
async function actionsToTasks(req: PayloadRequest, doc: Record<string, any>) {
  let changed = false
  const actions = await Promise.all(
    ((doc.actions ?? []) as Record<string, any>[]).map(async (a) => {
      if (refId(a.task) || !refId(a.owner) || !String(a.text ?? '').trim()) return a
      const task = await req.payload.create({
        collection: 'tasks',
        data: { title: a.text, assignedTo: refId(a.owner), dueAt: a.due || undefined, description: `From the meeting "${doc.title}".` } as never,
        overrideAccess: true,
        req,
      })
      changed = true
      return { ...a, task: task.id }
    }),
  )
  if (changed) await req.payload.update({ collection: 'meetings', id: doc.id, data: { actions } as never, overrideAccess: true, req, context: { tasksMade: true } })
}

export const Meetings: CollectionConfig = {
  slug: 'meetings',
  labels: { singular: 'Meeting', plural: 'Meetings' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'kind', 'startsAt', 'repeat'] },
  defaultSort: 'startsAt',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ attendees: { in: [user.id] } } as Where) : false),
    create: isAdmin,
    // The people invited can add to the agenda; the rest is Ernest's.
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ attendees: { in: [user.id] } } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (hasRole(req.user, 'team')) {
          for (const k of Object.keys(data)) if (k !== 'agenda') delete data[k]
          return data
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        if (!merged.startsAt) throw new APIError('Choose when.', 400)
        if (!(merged.attendees ?? []).length) throw new APIError('Choose who is invited.', 400)
        if (merged.meetLink && !/^https:\/\//.test(String(merged.meetLink))) throw new APIError('The Meet link starts with https://.', 400)
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.tasksMade || context?.series) return doc
        const who = ((doc.attendees ?? []) as unknown[]).map(refId).filter(Boolean) as number[]
        const when = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra' }).format(new Date(doc.startsAt))
        if (operation === 'create') {
          await notify(req, { to: who, kind: 'meeting', title: `${doc.title}: ${when} Accra`, body: doc.repeat && doc.repeat !== 'none' ? `${REPEATS.find((r) => r.value === doc.repeat)?.label}.` : undefined, link: `/meetings/${doc.id}`, action: 'Open it', key: `meeting:${doc.id}` })
        } else if (previousDoc && previousDoc.startsAt !== doc.startsAt) {
          await notify(req, { to: who, kind: 'meeting', title: `Moved: ${doc.title}, now ${when} Accra`, link: `/meetings/${doc.id}`, action: 'Open it' })
        }
        if (hasRole(req.user, 'admin')) await actionsToTasks(req, doc)
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', required: true, defaultValue: 'one-to-one', options: MEETING_KINDS, admin: { width: '25%' } },
        { name: 'startsAt', label: 'When', type: 'date', required: true, index: true, admin: { width: '30%', date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, HH:mm' } } },
        { name: 'minutes', label: 'Minutes', type: 'number', defaultValue: 30, min: 5, admin: { width: '20%' } },
        { name: 'repeat', type: 'select', defaultValue: 'none', options: REPEATS, admin: { width: '25%' } },
      ],
    },
    { name: 'attendees', label: 'Who', type: 'relationship', relationTo: 'users', hasMany: true, index: true },
    { name: 'meetLink', label: 'Google Meet link', type: 'text', admin: { description: 'Such as https://meet.google.com/abc-defg-hij' } },
    { name: 'agenda', type: 'textarea', admin: { description: 'Anyone invited can add to it beforehand.' } },
    { name: 'notes', type: 'textarea', admin: { description: 'What was said and agreed.' } },
    {
      name: 'actions',
      label: 'Action items',
      type: 'array',
      admin: { description: 'Each one with an owner becomes a task when you save.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'text', type: 'text', required: true, admin: { width: '45%' } },
            { name: 'owner', type: 'relationship', relationTo: 'users', admin: { width: '25%' } },
            { name: 'due', type: 'date', admin: { width: '15%', date: { pickerAppearance: 'dayOnly' } } },
            { name: 'task', type: 'relationship', relationTo: 'tasks', admin: { width: '15%', readOnly: true } },
          ],
        },
      ],
    },
    { name: 'nextMade', label: 'Next in the series', type: 'relationship', relationTo: 'meetings', admin: { readOnly: true } },
  ],
}

/**
 * Run with the reminders: the morning notice for today's meetings, and the
 * next date of every repeating meeting that has passed.
 */
export async function meetingReminders(req: PayloadRequest, now: Date) {
  const day = now.toISOString().slice(0, 10)
  if (now.getUTCHours() >= 7 && now.getUTCHours() < 9) {
    const today = await req.payload.find({ collection: 'meetings', where: { and: [{ startsAt: { greater_than_equal: `${day}T00:00:00.000Z` } }, { startsAt: { less_than: `${day}T23:59:59.999Z` } }] }, limit: 100, depth: 0, overrideAccess: true, req })
    for (const m of today.docs as Record<string, any>[]) {
      const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra' }).format(new Date(m.startsAt))
      await notify(req, { to: ((m.attendees ?? []) as unknown[]).map(refId), kind: 'meeting', title: `Today at ${time} Accra: ${m.title}`, body: m.meetLink ? `Join: ${m.meetLink}` : undefined, link: `/meetings/${m.id}`, action: 'Open it', key: `meeting-today:${m.id}:${day}` })
    }
  }
  const passed = await req.payload.find({
    collection: 'meetings',
    where: { and: [{ repeat: { not_equals: 'none' } }, { startsAt: { less_than: now.toISOString() } }, { nextMade: { exists: false } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const m of passed.docs as Record<string, any>[]) {
    const startsAt = nextDate(m.startsAt, m.repeat)
    if (!startsAt) continue
    const next = await req.payload.create({
      collection: 'meetings',
      data: { title: m.title, kind: m.kind, startsAt, minutes: m.minutes, repeat: m.repeat, attendees: m.attendees, meetLink: m.meetLink } as never,
      overrideAccess: true,
      req,
      context: { series: true },
    })
    await req.payload.update({ collection: 'meetings', id: m.id, data: { nextMade: next.id } as never, overrideAccess: true, req, context: { series: true } })
  }
}
