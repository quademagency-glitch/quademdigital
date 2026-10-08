import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { adminMineOrManaged } from '../access/managers'
import { dayBounds } from '../lib/reportCounts'
import { adminIds, notify } from '../lib/notify'

/**
 * A working day with no report needed, agreed instead of missed: training,
 * setting up, a day out with a client. The team member asks with a reason and
 * Ernest agrees or declines; Ernest can also set one himself, agreed at once,
 * for someone who cannot open the portal. Sick days and leave are time off,
 * not this. An agreed day reads "No report needed" and never counts against
 * them.
 */

export const REASONS = [
  { label: 'Training or setting up', value: 'training' },
  { label: 'With a client', value: 'client' },
  { label: 'Other', value: 'other' },
]
const REASON_TEXT = Object.fromEntries(REASONS.map((r) => [r.value, r.label]))
const BACK_DAYS = 14
const DAY = 86_400_000
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
const dayText = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso))

export const ReportExcusals: CollectionConfig = {
  slug: 'report-excusals',
  labels: { singular: 'Day without a report', plural: 'Days without a report' },
  admin: { group: 'Team', useAsTitle: 'note', defaultColumns: ['user', 'date', 'reason', 'status'], description: 'Working days with no report needed, asked for by the team member or set by Ernest.' },
  defaultSort: '-date',
  access: {
    read: adminMineOrManaged('user'),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: isAdmin,
    // A team member can take back a request that is still waiting.
    delete: ({ req: { user } }) => (hasRole(user, 'admin') ? true : user ? ({ and: [{ user: { equals: user.id } }, { status: { equals: 'requested' } }] } as Where) : false),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const admin = hasRole(user, 'admin')
        if (operation === 'create') {
          if (!admin) {
            data.user = user!.id
            data.status = 'requested'
          } else {
            // The founder setting a day agrees it there and then (the field's default has already filled in 'requested').
            data.status = 'approved'
            data.decidedBy = user!.id
            data.decidedAt = new Date().toISOString()
          }
          if (!data.user) throw new APIError('Say whose day it is.', 400)
          if (!data.date) throw new APIError('Choose the day.', 400)
          const day = dayBounds(data.date).start
          const wd = day.getUTCDay()
          if (wd === 0 || wd === 6) throw new APIError('Weekends need no report.', 400)
          const todayStart = dayBounds(new Date()).start
          if (day > todayStart) throw new APIError('Ask on the day or after it, not before.', 400)
          if (!admin && todayStart.getTime() - day.getTime() > BACK_DAYS * DAY) throw new APIError(`A day can be asked for up to ${BACK_DAYS} days back. Ask Ernest for anything older.`, 400)
          data.date = day.toISOString()
          if (!['training', 'client', 'other'].includes(data.reason)) throw new APIError('Say why: training or setting up, with a client, or other.', 400)
          if (data.reason === 'other' && !String(data.note ?? '').trim()) throw new APIError('Say a few words about why.', 400)
          const [report, already] = await Promise.all([
            req.payload.find({ collection: 'daily-reports', where: { and: [{ user: { equals: data.user } }, { date: { equals: data.date } }] }, limit: 1, depth: 0, overrideAccess: true, req }),
            req.payload.find({ collection: 'report-excusals', where: { and: [{ user: { equals: data.user } }, { date: { equals: data.date } }, { status: { not_equals: 'declined' } }] }, limit: 1, depth: 0, overrideAccess: true, req }),
          ])
          if (report.docs.length) throw new APIError('That day has a report already.', 409)
          if (already.docs.length) throw new APIError(already.docs[0].status === 'approved' ? 'That day is already agreed.' : 'That day is already asked for.', 409)
        } else {
          for (const k of ['user', 'date']) data[k] = originalDoc?.[k]
          if (data.status && data.status !== originalDoc?.status && data.status !== 'requested') {
            data.decidedBy = user?.id ?? null
            data.decidedAt = new Date().toISOString()
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const who = await req.payload.findByID({ collection: 'users', id: Number(idOf(doc.user)), depth: 0, overrideAccess: true, req }).catch(() => null)
        const name = who?.name || who?.email || 'Someone'
        const why = [REASON_TEXT[doc.reason], doc.note].filter(Boolean).join(': ')
        if (operation === 'create' && doc.status === 'requested') {
          await notify(req, { to: await adminIds(req), kind: 'report', title: `${name} asks for a day without a report: ${dayText(doc.date)}`, body: why, link: '/team', action: 'Decide' })
        } else if (doc.status !== previousDoc?.status && (doc.status === 'approved' || doc.status === 'declined') && hasRole(req.user, 'admin') && String(idOf(doc.user)) !== String(req.user?.id)) {
          await notify(req, {
            to: [idOf(doc.user) as number],
            kind: 'report',
            title: doc.status === 'approved' ? `No report needed on ${dayText(doc.date)}: agreed` : `A day without a report was declined: ${dayText(doc.date)}`,
            body: why,
            link: '/report',
          })
        }
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'user', label: 'Person', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { width: '50%' } },
        { name: 'date', type: 'date', required: true, index: true, admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'reason', type: 'select', required: true, options: REASONS, admin: { width: '50%' } },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'requested',
          index: true,
          options: [
            { label: 'Asked for', value: 'requested' },
            { label: 'Agreed', value: 'approved' },
            { label: 'Declined', value: 'declined' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'note', label: 'Why', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'decidedBy', label: 'Decided by', type: 'relationship', relationTo: 'users', admin: { readOnly: true, width: '50%' } },
        { name: 'decidedAt', label: 'Decided', type: 'date', admin: { readOnly: true, width: '50%' } },
      ],
    },
  ],
}
