import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { adminField, hasRole, isAdmin } from '../access/roles'
import { audit, dayText } from '../lib/audit'
import { refId, termsOn, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'

/**
 * The yearly appraisal (spec 14.10, Agreement §7): the person's
 * self-assessment, Ernest's assessment and an outcome. A rise is recorded as a
 * dated change in their terms, from the day Ernest gives, so it never
 * rewrites past money.
 *
 * Steps: Ernest starts it (waiting for the self-assessment); the person writes
 * theirs and sends it (with Ernest); Ernest writes his, chooses the outcome and
 * any rise, and closes it (done).
 */
const OUTCOMES = [
  { label: 'Satisfactory', value: 'satisfactory' },
  { label: 'Needs improvement', value: 'needs-improvement' },
  { label: 'Unsatisfactory', value: 'unsatisfactory' },
]

const TERMS_KEYS = ['currency', 'commission', 'salaryTrigger', 'salary', 'foundingPartner', 'dataAllowance', 'leave', 'targets', 'missedMonths'] as const

export const Appraisals: CollectionConfig = {
  slug: 'appraisals',
  labels: { singular: 'Appraisal', plural: 'Appraisals' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'status', 'outcome', 'dueDate'] },
  defaultSort: '-createdAt',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ member: { equals: user.id } } as Where) : false),
    create: isAdmin,
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ and: [{ member: { equals: user.id } }, { status: { equals: 'self' } }] } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const team = hasRole(req.user, 'team')
        if (originalDoc?.status === 'done') throw new APIError('This appraisal is closed.', 403)
        if (team) {
          // The person writes their self-assessment and sends it on.
          const self = String(data.selfAssessment ?? originalDoc?.selfAssessment ?? '').trim()
          for (const k of Object.keys(data)) if (k !== 'selfAssessment' && k !== 'status') delete data[k]
          if (data.status && data.status !== 'self') {
            if (!self) throw new APIError('Write your self-assessment first.', 400)
            data.status = 'review'
            data.selfSentAt = new Date().toISOString()
          }
          return data
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const person = await userById(req, refId(merged.member))
        if (!person || person.role !== 'team') throw new APIError('Choose the team member.', 400)
        if (operation === 'create') data.status = data.status || 'self'
        if (merged.status === 'done') {
          if (!merged.outcome) throw new APIError('Choose the outcome.', 400)
          if (!String(merged.adminAssessment ?? '').trim()) throw new APIError('Write your assessment.', 400)
          if (Number(merged.raisePercent) > 0 && !merged.raiseFrom) throw new APIError('Say from which day the rise applies.', 400)
          data.closedAt = new Date().toISOString()
        }
        data.title = `${person.name || person.email} · ${merged.period || 'Yearly appraisal'}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const memberId = refId(doc.member)
        const person = await userById(req, memberId)
        const name = person?.name || person?.email || 'A team member'
        if (operation === 'create') {
          await notify(req, { to: [memberId], kind: 'appraisal', title: 'Your yearly appraisal: write your self-assessment', body: doc.dueDate ? `By ${dayText(doc.dueDate)}.` : undefined, link: '/reviews', action: 'Write it', key: `appraisal:${doc.id}` })
        }
        if (doc.status === 'review' && previousDoc?.status === 'self') {
          await notify(req, { to: await adminIds(req), kind: 'appraisal', title: `${name} sent their self-assessment`, link: `/reviews/appraisals/${doc.id}`, action: 'Open it' })
        }
        if (doc.status === 'done' && previousDoc?.status !== 'done') {
          // A rise becomes their terms from the day given (spec 14.3).
          let newTerms: number | null = null
          const pct = Number(doc.raisePercent) || 0
          if (pct > 0 && doc.raiseFrom) {
            const from = String(doc.raiseFrom).slice(0, 10)
            const current = await termsOn(req, memberId!, from)
            if (current?.salary?.amountMinor) {
              const values: Record<string, unknown> = {}
              for (const k of TERMS_KEYS) values[k] = current[k]
              const before = Number(current.salary.amountMinor)
              // Whole units of their currency, as salaries are paid.
              const after = Math.round((before * (100 + pct)) / 100 / 100) * 100
              values.salary = { ...current.salary, amountMinor: after }
              const created = await req.payload.create({
                collection: 'member-terms',
                data: { ...values, user: memberId, effectiveFrom: from, reason: `Yearly appraisal: ${doc.outcome}, +${pct}%` } as never,
                overrideAccess: true,
                req,
              })
              newTerms = Number(created.id)
              await req.payload.db.updateOne({ collection: 'appraisals', id: doc.id, data: { termsCreated: newTerms }, returning: false, req })
            }
          }
          await audit(req, { action: 'appraisal.closed', summary: `${name}'s appraisal closed: ${doc.outcome}${pct ? `, +${pct}% from ${dayText(doc.raiseFrom)}` : ''}`, person: memberId, subjectType: 'appraisals', subjectId: doc.id })
          await notify(req, {
            to: [memberId],
            kind: 'appraisal',
            title: `Your appraisal is closed: ${OUTCOMES.find((o) => o.value === doc.outcome)?.label.toLowerCase()}`,
            body: pct ? `A ${pct}% rise from ${dayText(doc.raiseFrom)}${newTerms ? ', now in your terms' : ''}.` : undefined,
            link: '/reviews',
            action: 'Read it',
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'member', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { width: '34%' } },
        { name: 'period', type: 'text', admin: { width: '33%', description: 'Such as: first year, Oct 2026 to Sep 2027.' } },
        { name: 'dueDate', label: 'Due', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'self',
      index: true,
      options: [
        { label: 'Waiting for their self-assessment', value: 'self' },
        { label: 'With Ernest', value: 'review' },
        { label: 'Closed', value: 'done' },
      ],
    },
    { name: 'selfAssessment', label: 'Their self-assessment', type: 'textarea' },
    { name: 'selfSentAt', label: 'Sent on', type: 'date', admin: { readOnly: true } },
    { name: 'adminAssessment', label: "Ernest's assessment", type: 'textarea', access: { create: adminField, update: adminField } },
    {
      type: 'row',
      fields: [
        { name: 'outcome', type: 'select', options: OUTCOMES, access: { create: adminField, update: adminField }, admin: { width: '34%' } },
        { name: 'raisePercent', label: 'Rise, %', type: 'number', min: 0, access: { create: adminField, update: adminField }, admin: { width: '33%' } },
        { name: 'raiseFrom', label: 'Rise from', type: 'date', access: { create: adminField, update: adminField }, admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'closedAt', label: 'Closed on', type: 'date', admin: { width: '50%', readOnly: true } },
        { name: 'termsCreated', label: 'New terms', type: 'relationship', relationTo: 'member-terms', admin: { width: '50%', readOnly: true } },
      ],
    },
  ],
}
