import type { CollectionConfig, FieldAccess, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { audit, dayText } from '../lib/audit'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'
import { eachDay, holidaysFor, isWeekend, ymd } from '../lib/offDays'

/**
 * Days off (spec 5.11 and 14.6): time off, exam days and sick days. A team
 * member asks; Ernest approves or declines. On approved working days no daily
 * report is expected, a missing one is not counted, and each lowers the
 * reports needed for the next data allowance (decided 3 October 2026).
 *
 * Exam days also put the rest of that week on the lighter standard (Agreement
 * §4). Time off comes out of the yearly days in the person's terms; exam and
 * sick days do not.
 *
 * The whole team sees who is away and when, for the team calendar. Only the
 * person and Ernest see what kind of day it is and why.
 */

export const TIME_OFF_KINDS = [
  { label: 'Time off', value: 'time-off' },
  { label: 'Exam days', value: 'exam' },
  { label: 'Sick', value: 'sick' },
]
const KIND_TEXT: Record<string, string> = { 'time-off': 'time off', exam: 'exam days', sick: 'sick leave' }

/** The person and admins see this field; the rest of the team does not. */
const ownerOrAdmin: FieldAccess = ({ req: { user }, doc }) => hasRole(user, 'admin') || Boolean(user && doc && String(refId(doc.member)) === String(user.id))

const range = (from: string, to: string) => (from === to ? dayText(from) : `${dayText(from)} to ${dayText(to)}`)

export const TimeOff: CollectionConfig = {
  slug: 'time-off',
  labels: { singular: 'Time off', plural: 'Time off' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'member', 'status', 'from', 'to'] },
  defaultSort: '-from',
  access: {
    read: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'team') && user) return { or: [{ member: { equals: user.id } }, { status: { equals: 'approved' } }] } as Where
      return false
    },
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ and: [{ member: { equals: user.id } }, { status: { equals: 'requested' } }] } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const team = hasRole(user, 'team')
        if (operation === 'create' && team) {
          data.member = user!.id
          data.status = 'requested'
        }
        if (operation === 'update' && team) {
          // While it waits, the person can change it or take it back; the decision is Ernest's.
          for (const k of ['member', 'decidedBy', 'decidedAt', 'decisionNote']) data[k] = originalDoc?.[k]
          if (data.status !== undefined && !['requested', 'cancelled'].includes(data.status)) data.status = originalDoc?.status
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const memberId = refId(merged.member)
        const person = await userById(req, memberId)
        if (!person || person.role !== 'team') throw new APIError('Choose the team member.', 400)
        if (!merged.from || !merged.to) throw new APIError('Choose the first and last day.', 400)
        const from = ymd(merged.from)
        const to = ymd(merged.to)
        if (to < from) throw new APIError('The last day is before the first.', 400)
        if (eachDay(from, to).length > 62) throw new APIError('Ask for up to two months at a time.', 400)
        data.from = `${from}T00:00:00.000Z`
        data.to = `${to}T00:00:00.000Z`

        if (['requested', 'approved'].includes(merged.status)) {
          const clash = await req.payload.find({
            collection: 'time-off',
            where: {
              and: [
                { member: { equals: memberId } },
                { status: { in: ['requested', 'approved'] } },
                { from: { less_than_equal: `${to}T23:59:59.999Z` } },
                { to: { greater_than_equal: `${from}T00:00:00.000Z` } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          if (clash.docs.length) throw new APIError(`Those days overlap ${range(ymd(clash.docs[0].from), ymd(clash.docs[0].to))}, already asked for.`, 400)
        }

        // Working days only: weekends and the person's public holidays are off anyway.
        const holidays = await holidaysFor(req, person.country)
        data.workingDays = eachDay(from, to).filter((d) => !isWeekend(d) && !holidays.has(d)).length

        if (data.status && data.status !== originalDoc?.status && ['approved', 'declined'].includes(data.status)) {
          data.decidedBy = user?.id ?? null
          data.decidedAt = new Date().toISOString()
        }
        // The whole team can read the title, so it says who and when, never why.
        data.title = `${person.name || person.email} · ${range(from, to)}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const memberId = refId(doc.member)
        const person = await userById(req, memberId)
        const name = person?.name || person?.email || 'A team member'
        const when = range(ymd(doc.from), ymd(doc.to))
        const days = `${doc.workingDays} working day${doc.workingDays === 1 ? '' : 's'}`
        const byTeam = hasRole(req.user, 'team')

        if (operation === 'create' && byTeam) {
          await notify(req, { to: await adminIds(req), kind: 'time-off', title: `${name} asks for ${KIND_TEXT[doc.kind]}: ${when}`, body: [days, doc.note].filter(Boolean).join(' · '), link: '/time-off', action: 'Decide' })
        }
        if (operation === 'update' && byTeam && doc.status === 'cancelled' && previousDoc?.status !== 'cancelled') {
          await notify(req, { to: await adminIds(req), kind: 'time-off', title: `${name} took back their request: ${when}`, link: '/time-off', email: false })
        }
        const decided = doc.status !== previousDoc?.status && ['approved', 'declined'].includes(doc.status)
        if (decided || (operation === 'create' && !byTeam && doc.status === 'approved')) {
          await audit(req, {
            action: `time-off.${doc.status}`,
            summary: `${KIND_TEXT[doc.kind][0].toUpperCase()}${KIND_TEXT[doc.kind].slice(1)} ${doc.status} for ${name}: ${when}`,
            person: memberId,
            subjectType: 'time-off',
            subjectId: doc.id,
            reason: doc.decisionNote,
          })
          await notify(req, {
            to: [memberId],
            kind: 'time-off',
            title: operation === 'create' ? `Ernest recorded ${KIND_TEXT[doc.kind]} for you: ${when}` : `Your ${KIND_TEXT[doc.kind]} was ${doc.status}: ${when}`,
            body: doc.decisionNote || (doc.status === 'approved' ? 'No daily report is expected on those days.' : undefined),
            link: '/time-off',
          })
        }

        // Exam days put the rest of their week on the lighter standard, so the
        // reports already sent that week are worked out again.
        if (doc.kind === 'exam' && (decided || operation === 'create')) {
          const first = new Date(doc.from)
          first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7))
          const last = new Date(doc.to)
          last.setUTCDate(last.getUTCDate() + (7 - ((last.getUTCDay() + 6) % 7)) - 1)
          const reports = await req.payload.find({
            collection: 'daily-reports',
            where: { and: [{ user: { equals: memberId } }, { date: { greater_than_equal: `${ymd(first)}T00:00:00.000Z` } }, { date: { less_than_equal: `${ymd(last)}T23:59:59.999Z` } }] },
            limit: 14,
            depth: 0,
            overrideAccess: true,
            req,
          })
          for (const r of reports.docs) {
            await req.payload.update({ collection: 'daily-reports', id: r.id, data: {}, overrideAccess: true, context: { examRecheck: true }, req }).catch((err) => req.payload.logger.error({ err }, 'Could not rework a report for exam week'))
          }
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      // The person's name, for the team calendar: team members cannot read other accounts.
      name: 'memberName',
      type: 'text',
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const id = refId(siblingData?.member)
            if (!id) return null
            const cache = ((req.context as Record<string, unknown>).memberNames ??= new Map<number, string>()) as Map<number, string>
            if (!cache.has(id)) {
              const u = await userById(req, id)
              cache.set(id, String(u?.name || 'A team member'))
            }
            return cache.get(id)
          },
        ],
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'member', type: 'relationship', relationTo: 'users', index: true, admin: { width: '34%' } },
        { name: 'kind', type: 'select', required: true, defaultValue: 'time-off', options: TIME_OFF_KINDS, access: { read: ownerOrAdmin }, admin: { width: '33%' } },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'requested',
          index: true,
          options: [
            { label: 'Asked for', value: 'requested' },
            { label: 'Approved', value: 'approved' },
            { label: 'Declined', value: 'declined' },
            { label: 'Taken back', value: 'cancelled' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'from', label: 'First day', type: 'date', required: true, index: true, admin: { width: '34%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'to', label: 'Last day', type: 'date', required: true, index: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'workingDays', label: 'Working days', type: 'number', admin: { width: '33%', readOnly: true, description: 'Weekends and their public holidays are not counted.' } },
      ],
    },
    { name: 'note', type: 'text', access: { read: ownerOrAdmin } },
    {
      name: 'doctorNote',
      label: "Doctor's note",
      type: 'relationship',
      relationTo: 'documents',
      access: { read: ownerOrAdmin },
      admin: { condition: (d) => d?.kind === 'sick', description: 'Optional. Kept as a personal document.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'decidedBy', label: 'Decided by', type: 'relationship', relationTo: 'users', admin: { width: '34%', readOnly: true } },
        { name: 'decidedAt', label: 'Decided on', type: 'date', admin: { width: '33%', readOnly: true } },
        { name: 'decisionNote', label: 'Note on the decision', type: 'text', access: { read: ownerOrAdmin }, admin: { width: '33%' } },
      ],
    },
  ],
}
