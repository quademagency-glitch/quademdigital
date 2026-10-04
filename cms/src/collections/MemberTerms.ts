import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminField, adminOrMine, isAdmin } from '../access/roles'
import { termsFields } from '../fields/terms'
import { audit, dayText, termsChanges } from '../lib/audit'

/**
 * One person's terms from a given date.
 *
 * A change of terms is a new record with the date it takes effect, never an
 * edit, so every earlier set stays exactly as it was: what changed, from when,
 * who did it and why. Anything that works out money asks for the terms in
 * force on the day of the event (the newest `effectiveFrom` on or before it),
 * so a pay rise in March cannot rewrite February's commission.
 *
 * Terms already in force cannot be edited or deleted. Terms dated in the future
 * can be, until their day comes.
 *
 * A team member can read their own terms, which is how the portal shows them
 * their targets. They cannot read anyone else's.
 */

const TERMS_KEYS = [
  'currency',
  'commission',
  'salaryTrigger',
  'salary',
  'foundingPartner',
  'dataAllowance',
  'leave',
  'targets',
  'missedMonths',
] as const

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''

/** Fill whatever the form left empty from the template, leaf by leaf. */
const fillFrom = (target: Record<string, any>, source: Record<string, any>) => {
  for (const key of Object.keys(source ?? {})) {
    const s = source[key]
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      fillFrom(target[key], s)
    } else if (isEmpty(target[key]) && !isEmpty(s)) {
      target[key] = s
    }
  }
}

const today = () => new Date().toISOString().slice(0, 10)
const inForce = (effectiveFrom: unknown) =>
  typeof effectiveFrom === 'string' && effectiveFrom.slice(0, 10) <= today()

export const MemberTerms: CollectionConfig = {
  slug: 'member-terms',
  labels: { singular: 'Terms', plural: 'Terms' },
  admin: {
    group: 'Team',
    useAsTitle: 'reason',
    defaultColumns: ['user', 'effectiveFrom', 'reason', 'changedBy'],
    description:
      'Each person\'s terms, newest first. To change someone\'s terms, add new terms from the day the change takes effect; earlier terms stay as they were.',
  },
  defaultSort: '-effectiveFrom',
  access: {
    read: adminOrMine('user'),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (operation === 'update' && inForce(originalDoc?.effectiveFrom)) {
          throw new APIError(
            'These terms are already in force, and money has been worked out with them. Add new terms from the day the change takes effect instead.',
            400,
          )
        }
        if (operation === 'create') {
          data.changedBy = req.user?.id ?? null
          if (data.template) {
            const template = await req.payload
              .findByID({ collection: 'terms-templates', id: data.template, depth: 0, req })
              .catch(() => null)
            if (template) {
              for (const key of TERMS_KEYS) {
                const from = (template as Record<string, any>)[key]
                if (from && typeof from === 'object') {
                  data[key] = data[key] && typeof data[key] === 'object' ? data[key] : {}
                  fillFrom(data[key], from)
                } else if (isEmpty(data[key]) && !isEmpty(from)) {
                  data[key] = from
                }
              }
            }
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const userId = Number(doc.user && typeof doc.user === 'object' ? doc.user.id : doc.user)
        const person = await req.payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, req }).catch(() => null)
        const who = person?.name || person?.email || 'someone'
        const from = dayText(doc.effectiveFrom)
        let before = previousDoc
        if (operation === 'create') {
          const earlier = await req.payload.find({
            collection: 'member-terms',
            where: { and: [{ user: { equals: userId } }, { effectiveFrom: { less_than: doc.effectiveFrom } }] },
            sort: '-effectiveFrom',
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          before = earlier.docs[0] ?? null
        }
        await audit(req, {
          action: operation === 'create' ? 'terms.added' : 'terms.changed',
          summary: operation === 'create' ? `New terms for ${who} from ${from}` : `Terms for ${who} from ${from} changed before they started`,
          person: userId,
          subjectType: 'member-terms',
          subjectId: doc.id,
          reason: doc.reason,
          changes: termsChanges(before, doc),
        })
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await audit(req, {
          action: 'terms.removed',
          summary: `Terms due from ${dayText(doc.effectiveFrom)} were removed before they started`,
          person: Number(doc.user && typeof doc.user === 'object' ? doc.user.id : doc.user),
          subjectType: 'member-terms',
          subjectId: doc.id,
          reason: doc.reason,
        })
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const doc = await req.payload.findByID({ collection: 'member-terms', id, depth: 0, req }).catch(() => null)
        if (doc && inForce(doc.effectiveFrom)) {
          throw new APIError('Terms already in force are kept for the record and cannot be deleted.', 400)
        }
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'user',
          label: 'Person',
          type: 'relationship',
          relationTo: 'users',
          required: true,
          index: true,
          filterOptions: { role: { equals: 'team' } },
          admin: { width: '50%' },
        },
        {
          name: 'effectiveFrom',
          label: 'In force from',
          type: 'date',
          required: true,
          index: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } },
        },
      ],
    },
    {
      name: 'reason',
      label: 'Why',
      type: 'text',
      required: true,
      admin: { description: 'For example "Joined", "Yearly appraisal 2027" or "Moved to Ghana".' },
    },
    {
      name: 'template',
      label: 'Started from',
      type: 'relationship',
      relationTo: 'terms-templates',
      access: { read: adminField },
      admin: { description: 'Anything left empty below is copied from this template when you save.' },
    },
    {
      name: 'changedBy',
      label: 'Recorded by',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, position: 'sidebar' },
    },
    ...termsFields(),
  ],
}
