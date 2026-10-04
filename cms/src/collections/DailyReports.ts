import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminField, adminOrMine, hasRole, isAdmin } from '../access/roles'
import { adminMineOrManaged } from '../access/managers'
import { inExamWeek, lighter, ymd } from '../lib/offDays'
import { countReport, dayBounds, deadlineOf } from '../lib/reportCounts'

/**
 * The daily report (spec 5.1, Agreement §2 and §4).
 *
 * One per person per working day, due before 18:00 Accra (19:00 Lagos). The
 * pipeline counts are worked out by the CMS from the leads (lib/reportCounts),
 * on every save, so nobody types them and nobody can type over them. Counts a
 * job role asks to be typed in, such as "designs delivered", go in `typed`.
 *
 * `standard` keeps a copy of the job role's targets as they were that day, so a
 * later change to the role does not recolour old reports.
 *
 * A report can be edited until midnight on its day, then it locks. Whether it
 * was on time is decided when it is first sent and never changes.
 */

type Std = { label: string; source: string; target: number | null; amberFrom: number | null; value: number | null }

const startOfToday = () => dayBounds(new Date()).start

export const DailyReports: CollectionConfig = {
  slug: 'daily-reports',
  labels: { singular: 'Daily report', plural: 'Daily reports' },
  admin: {
    group: 'Team',
    useAsTitle: 'title',
    defaultColumns: ['title', 'onTime', 'researchedCount', 'firstMessagesCount', 'followUpsDoneCount'],
    description: 'One per person per working day. The counts come from the pipeline; the person adds what the numbers cannot say.',
  },
  defaultSort: '-date',
  access: {
    read: adminMineOrManaged('user'),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: adminOrMine('user'),
    delete: isAdmin,
    readVersions: isAdmin,
  },
  versions: { maxPerDoc: 20 },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req, context }) => {
        const user = req.user as { id: number; role?: string; name?: string; email?: string } | null
        const team = hasRole(user, 'team')
        const now = new Date()

        if (operation === 'create') {
          if (team) data.user = user!.id
          if (!data.user) throw new APIError('Say whose report this is.', 400)
          data.date = dayBounds(data.date || now).start.toISOString()
          const existing = await req.payload.find({
            collection: 'daily-reports',
            where: { and: [{ user: { equals: data.user } }, { date: { equals: data.date } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          if (existing.docs.length) throw new APIError('That day already has a report. Open it to change it.', 409)
          data.submittedAt = now.toISOString()
          data.onTime = now <= deadlineOf(data.date)
        } else {
          for (const k of ['user', 'date', 'submittedAt', 'onTime']) data[k] = originalDoc?.[k]
          if (team) {
            if (dayBounds(originalDoc?.date).start < startOfToday()) {
              throw new APIError('Reports lock at midnight on their day. Ask Ernest if something needs correcting.', 403)
            }
          }
        }

        // A week with approved exam days is on the lighter standard (spec 5.11).
        // Ernest can also set it by hand; a team member cannot.
        const examWeek = await inExamWeek(req, Number(data.user), ymd(data.date))
        // When exam days are decided, that week is worked out again from the time off alone.
        data.examWeek = examWeek || (!team && !context?.examRecheck && Boolean(data.examWeek ?? originalDoc?.examWeek))

        const owner = await req.payload.findByID({ collection: 'users', id: data.user, depth: 1, overrideAccess: true, req }).catch(() => null)
        const counts = await countReport(req, data.user, data.date)
        Object.assign(data, counts)

        // Snapshot the job role's standard with today's values.
        const role = owner?.jobRole && typeof owner.jobRole === 'object' ? (owner.jobRole as { reportCounts?: { label: string; source: string; target?: number | null; amberFrom?: number | null }[] }) : null
        const typed: { label?: string; value?: number | null }[] = Array.isArray(data.typed) ? data.typed : (originalDoc?.typed ?? [])
        const valueFor = (source: string, label: string): number | null => {
          switch (source) {
            case 'researched':
              return counts.researchedCount
            case 'firstMessages':
              return counts.firstMessagesCount
            case 'followUps':
              return counts.followUpsDoneCount
            case 'replies':
              return counts.repliesCount
            default: {
              const t = typed.find((x) => x.label === label)
              return t?.value ?? null
            }
          }
        }
        const standard: Std[] = (role?.reportCounts ?? []).map((c) => ({
          label: c.label,
          source: c.source,
          // Follow-ups have no fixed target: the standard is every one due.
          target: c.source === 'followUps' && c.target == null ? counts.followUpsDueCount : data.examWeek ? lighter(c.target ?? null) : (c.target ?? null),
          amberFrom: data.examWeek ? lighter(c.amberFrom ?? null) : (c.amberFrom ?? null),
          value: valueFor(c.source, c.label),
        }))
        data.standard = standard
        const who = owner?.name || owner?.email || 'Report'
        data.title = `${who}, ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Accra' }).format(new Date(data.date))}`
        return data
      },
    ],
  },
  endpoints: [
    {
      /*
        The counts so far today, before the report is sent: what the Report
        screen shows while the person fills it in. An admin may ask about
        anyone with ?user=; a team member only ever gets their own.
      */
      path: '/preview',
      method: 'get',
      handler: async (req) => {
        const user = req.user as { id: number; role?: string } | null
        if (!hasRole(user, 'team', 'admin')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
        const who = hasRole(user, 'admin') && req.searchParams?.get('user') ? Number(req.searchParams.get('user')) : user!.id
        const date = req.searchParams?.get('date') || new Date().toISOString()
        const counts = await countReport(req, who, date)
        return Response.json({ ...counts, deadline: deadlineOf(date).toISOString() })
      },
    },
  ],
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
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
        { name: 'researchedCount', label: 'Researched', type: 'number', admin: { readOnly: true, width: '20%' } },
        { name: 'firstMessagesCount', label: 'First messages', type: 'number', admin: { readOnly: true, width: '20%' } },
        { name: 'followUpsDoneCount', label: 'Follow-ups done', type: 'number', admin: { readOnly: true, width: '20%' } },
        { name: 'followUpsDueCount', label: 'Follow-ups due', type: 'number', admin: { readOnly: true, width: '20%' } },
        { name: 'repliesCount', label: 'Replies', type: 'number', admin: { readOnly: true, width: '20%' } },
      ],
    },
    {
      name: 'typed',
      label: 'Typed counts',
      type: 'array',
      admin: { description: 'Counts the job role asks the person to type in.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { width: '70%' } },
            { name: 'value', type: 'number', min: 0, admin: { width: '30%' } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'city', label: 'City worked', type: 'text', admin: { width: '50%' } },
        {
          name: 'niche',
          label: 'Niche worked',
          type: 'select',
          options: [
            { label: 'Restaurants and food', value: 'food' },
            { label: 'Salons and beauty', value: 'beauty' },
            { label: 'Clinics and health', value: 'health' },
            { label: 'Fashion', value: 'fashion' },
            { label: 'Real estate', value: 'real-estate' },
            { label: 'Events', value: 'events' },
            { label: 'Fitness', value: 'fitness' },
            { label: 'Other', value: 'other' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'repliesSummary', label: 'Who replied and what they said', type: 'textarea' },
    { name: 'blockers', label: 'What got in the way', type: 'textarea' },
    { name: 'followUpsDueTomorrow', label: 'Follow-ups due next working day', type: 'json', admin: { readOnly: true } },
    { name: 'standard', type: 'json', admin: { readOnly: true, description: "The job role's targets that day, with the day's values." } },
    {
      type: 'row',
      fields: [
        { name: 'submittedAt', label: 'Sent', type: 'date', admin: { readOnly: true, width: '50%', date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, HH:mm' } } },
        { name: 'onTime', label: 'Before 18:00', type: 'checkbox', admin: { readOnly: true, width: '50%' } },
      ],
    },
    {
      name: 'examWeek',
      label: 'Exam week',
      type: 'checkbox',
      defaultValue: false,
      access: { update: adminField, create: adminField },
      admin: { position: 'sidebar', description: 'A lighter standard that day (Agreement §4). Admin only.' },
    },
  ],
}
