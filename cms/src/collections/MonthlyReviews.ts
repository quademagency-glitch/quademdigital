import type { CollectionConfig, Field, FieldAccess, Where } from 'payload'
import { APIError } from 'payload'
import { adminField, hasRole, isAdmin } from '../access/roles'
import { adminMineOrManaged, managedIds, manages, ownerOrAdminField, reviewersOf } from '../access/managers'
import { audit } from '../lib/audit'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'
import { answersChanged, reviewFigures } from '../lib/reviews'
import { areaProgress } from '../lib/training'

/** Money in a review: the person and Ernest only, never their manager. */
const memberOrAdmin = ownerOrAdminField('member')

/**
 * The monthly review (spec 5.4, the Monthly Review Form). One per person per
 * month, made on the last Friday of the month, or by Ernest at any time.
 *
 * The figures and the missed-month counter are worked out by the CMS on every
 * save while the review is open. The person and Ernest type their answers;
 * both press Agreed, and then it locks. Changing an answer after someone has
 * agreed asks them to agree again.
 */

const monthText = (m: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))

const num = (name: string, label: string, access?: { read: FieldAccess }): Field => ({ name, label, type: 'number', ...(access ? { access } : {}), admin: { readOnly: true, width: '25%' } })

export const MonthlyReviews: CollectionConfig = {
  slug: 'monthly-reviews',
  labels: { singular: 'Monthly review', plural: 'Monthly reviews' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'status', 'monthNumber', 'updatedAt'] },
  defaultSort: '-month',
  access: {
    read: adminMineOrManaged('member'),
    create: isAdmin,
    // Open reviews: the person's own, and for a manager their people's, as the reviewer.
    update: async ({ req }) => {
      const user = req.user
      if (hasRole(user, 'admin')) return true
      if (!hasRole(user, 'team') || !user) return false
      const people = await managedIds(req)
      return { and: [{ status: { equals: 'open' } }, { or: [{ member: { equals: user.id } }, ...(people.length ? [{ member: { in: people } }] : [])] }] } as Where
    },
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const memberId = refId(merged.member)
        // The person answers; Ernest, or their manager, reviews (spec 14.1).
        const self = hasRole(user, 'team') && String(memberId) === String(user?.id)
        const team = self
        if (hasRole(user, 'team') && !self && !(await manages(req, memberId))) throw new APIError('Only the person, their manager or Ernest can change this review.', 403)
        if (originalDoc?.status === 'agreed') throw new APIError('This review is agreed and locked.', 403)
        if (!memberId) throw new APIError('Choose whose review it is.', 400)
        if (!/^\d{4}-\d{2}$/.test(String(merged.month ?? ''))) throw new APIError('The month is written like 2026-10.', 400)

        if (operation === 'create') {
          const existing = await req.payload.find({ collection: 'monthly-reviews', where: { and: [{ member: { equals: memberId } }, { month: { equals: merged.month } }] }, limit: 1, depth: 0, overrideAccess: true, req })
          if (existing.docs.length) throw new APIError(`${monthText(merged.month)} already has a review.`, 409)
          data.status = 'open'
          data.memberAgreedAt = null
          data.adminAgreedAt = null
          // Each training area, with where they are in it from their training progress.
          if (!Array.isArray(data.training) || !data.training.length) data.training = await areaProgress(req, memberId)
        }

        // Who may agree: each side only for themselves, and only to "now".
        const now = new Date().toISOString()
        if (team) {
          data.adminAgreedAt = originalDoc?.adminAgreedAt ?? null
          data.readyForTrial = originalDoc?.readyForTrial ?? null
          if (data.memberAgreedAt) data.memberAgreedAt = now
        } else {
          data.memberAgreedAt = originalDoc?.memberAgreedAt ?? null
          if (data.adminAgreedAt) {
            data.adminAgreedAt = now
            data.reviewerAgreedBy = user?.id ?? null
          }
        }
        if (!data.adminAgreedAt && !originalDoc?.adminAgreedAt) data.reviewerAgreedBy = null

        // An answer changed after agreeing: the other side agrees again.
        if (operation === 'update') {
          const changed = answersChanged(data, originalDoc)
          if (changed && team) {
            data.adminAgreedAt = null
            data.reviewerAgreedBy = null
          } else if (changed) data.memberAgreedAt = null
        }

        const { monthNumber, figures, missed } = await reviewFigures(req, memberId, merged.month)
        data.monthNumber = monthNumber
        data.figures = figures
        data.missed = missed
        const person = await userById(req, memberId)
        data.title = `${person?.name || person?.email || 'Review'} · ${monthText(merged.month)}`

        const memberAgreed = 'memberAgreedAt' in data ? data.memberAgreedAt : originalDoc?.memberAgreedAt
        const adminAgreed = 'adminAgreedAt' in data ? data.adminAgreedAt : originalDoc?.adminAgreedAt
        if (memberAgreed && adminAgreed) data.status = 'agreed'
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const memberId = refId(doc.member)
        const person = await userById(req, memberId)
        const name = person?.name || person?.email || 'A team member'
        const month = monthText(doc.month)
        if (operation === 'create') {
          await notify(req, { to: [memberId], kind: 'review', title: `Your ${month} review is ready`, body: 'Your figures are filled in. Add what worked, what got in your way and what changes next month, then press Agreed.', link: `/reviews/${doc.id}`, action: 'Open it', key: `review-ready:${doc.id}` })
          await notify(req, { to: await reviewersOf(req, memberId, await adminIds(req)), kind: 'review', title: `${name}'s ${month} review is ready`, link: `/reviews/${doc.id}`, email: false, key: `review-ready-admin:${doc.id}` })
        }
        if (operation === 'update' && doc.status === 'agreed' && previousDoc?.status !== 'agreed') {
          await audit(req, { action: 'review.agreed', summary: `${name}'s ${month} review agreed and locked`, person: memberId, subjectType: 'monthly-reviews', subjectId: doc.id })
          await notify(req, { to: [memberId, ...(await reviewersOf(req, memberId, await adminIds(req)))], kind: 'review', title: `${name}'s ${month} review is agreed`, link: `/reviews/${doc.id}`, email: false })
        } else if (operation === 'update' && doc.memberAgreedAt && !previousDoc?.memberAgreedAt) {
          await notify(req, { to: await reviewersOf(req, memberId, await adminIds(req)), kind: 'review', title: `${name} agreed their ${month} review`, body: 'Read it and press Agreed to lock it.', link: `/reviews/${doc.id}`, action: 'Open it' })
        } else if (operation === 'update' && doc.adminAgreedAt && !previousDoc?.adminAgreedAt) {
          const reviewer = await userById(req, refId(doc.reviewerAgreedBy))
          await notify(req, { to: [memberId], kind: 'review', title: `${reviewer?.name || 'Ernest'} agreed your ${month} review`, body: 'Read it and press Agreed to lock it.', link: `/reviews/${doc.id}`, action: 'Open it' })
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
        { name: 'month', type: 'text', required: true, index: true, admin: { width: '22%', description: 'Such as 2026-10.' } },
        { name: 'monthNumber', label: 'Month number', type: 'number', admin: { width: '22%', readOnly: true, description: 'Month 1 is the month they started.' } },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'open',
          index: true,
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Agreed', value: 'agreed' },
          ],
          admin: { width: '22%', readOnly: true },
        },
      ],
    },
    {
      name: 'figures',
      type: 'group',
      admin: { description: 'Worked out by the CMS from the pipeline, the reports and the money. Nobody types these.' },
      fields: [
        { type: 'row', fields: [num('workingDays', 'Working days'), num('daysOff', 'Days off'), num('reportsSent', 'Reports sent'), num('reportsOnTime', 'On time')] },
        { type: 'row', fields: [num('researched', 'Researched'), num('firstMessages', 'First messages'), num('followUps', 'Follow-ups'), num('replies', 'Replies')] },
        {
          type: 'row',
          fields: [num('proposalsSent', 'Proposals sent'), num('countedSourced', 'Deals sourced'), num('countedHanded', 'Deals handed over'), num('commissionGHSMinor', 'Commission, pesewas', { read: memberOrAdmin })],
        },
        {
          type: 'row',
          // Money: the person and Ernest only, never their manager.
          fields: [
            { name: 'currency', type: 'text', access: { read: memberOrAdmin }, admin: { readOnly: true, width: '33%' } },
            { name: 'fxRate', label: 'Rate', type: 'number', access: { read: memberOrAdmin }, admin: { readOnly: true, width: '33%' } },
            { name: 'commissionLocalMinor', label: 'Commission in their currency (minor units)', type: 'number', access: { read: memberOrAdmin }, admin: { readOnly: true, width: '34%' } },
          ],
        },
      ],
    },
    {
      name: 'missed',
      label: 'Missed months',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'counter', type: 'number', admin: { readOnly: true, width: '20%' } },
            {
              name: 'level',
              type: 'select',
              options: [
                { label: 'Fine', value: 'none' },
                { label: 'Review meeting', value: 'meeting' },
                { label: 'Agreement ends', value: 'end' },
              ],
              admin: { readOnly: true, width: '25%' },
            },
            { name: 'note', type: 'text', admin: { readOnly: true, width: '55%' } },
          ],
        },
      ],
    },
    { name: 'whatWorked', label: 'What worked', type: 'textarea' },
    { name: 'gotInTheWay', label: 'What got in the way', type: 'textarea' },
    { name: 'changesNextMonth', label: 'What changes next month', type: 'textarea' },
    {
      name: 'training',
      label: 'Training progress',
      type: 'array',
      admin: { description: 'One line per training area (Handbook §9).' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'area', type: 'text', required: true, admin: { width: '40%' } },
            {
              name: 'progress',
              type: 'select',
              options: [
                { label: 'Not started', value: 'not-started' },
                { label: 'In progress', value: 'in-progress' },
                { label: 'Signed off', value: 'done' },
              ],
              admin: { width: '20%' },
            },
            { name: 'note', type: 'text', admin: { width: '40%' } },
          ],
        },
      ],
    },
    {
      name: 'readyForTrial',
      label: 'Ready for a trial project',
      type: 'select',
      access: { create: adminField, update: adminField },
      options: [
        { label: 'Not yet', value: 'not-yet' },
        { label: 'Yes', value: 'yes' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'memberAgreedAt', label: 'They agreed', type: 'date', admin: { width: '50%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'adminAgreedAt', label: 'Reviewer agreed', type: 'date', admin: { width: '50%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'reviewerAgreedBy',
      label: 'Agreed by',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, description: 'Ernest, or their manager.' },
    },
  ],
}
