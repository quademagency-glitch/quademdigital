import type { CollectionConfig, FieldAccess, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { audit } from '../lib/audit'
import { refId, userById } from '../lib/moneyContext'
import { notify } from '../lib/notify'
import { SERVICE_OPTIONS } from './JourneyTemplates'

/**
 * A quote request (spec 5.5). Most clients need custom work: the team member
 * collects the scope, in the client's words, and only Ernest sets the price.
 * The team member sees the price only once Ernest approves it. "Create the
 * deal" makes a draft proposal carrying the lead, the credit, the plans, the
 * pricing and the quoted total.
 *
 * Any service, not only websites: the team member ticks what the lead wants
 * (one becomes the deal's service, several become Several services) and says
 * what they have now. The website questions are for website or bespoke work.
 *
 * The quoted amount is stored with its currency and rate, so a later change to
 * the price list or a rate never alters a quote already given (test 12).
 */

const LIVE_STAGES = ['new', 'contacted', 'replied', 'in-conversation', 'qualified', 'no-response']

/** What a lead can ask for: each service, ticked as many as apply, or something else. */
const WANTED = SERVICE_OPTIONS.filter((o) => o.value !== 'multiple').map((o) => (o.value === 'custom' ? { label: 'Something else', value: 'custom' } : o))

/** The deal's service from what was asked for: one is that one, several is Several services. */
export function dealService(services: unknown): string | undefined {
  const list = Array.isArray(services) ? [...new Set(services.filter((v): v is string => typeof v === 'string' && v !== ''))] : []
  return list.length === 1 ? list[0] : list.length > 1 ? 'multiple' : undefined
}

/** Pricing fields: Ernest always; the person who asked, once Ernest has approved it. */
const pricedForThem: FieldAccess = ({ req: { user }, doc }) => hasRole(user, 'admin') || Boolean(doc?.approvedAt)

export const QuoteRequests: CollectionConfig = {
  slug: 'quote-requests',
  labels: { singular: 'Quote request', plural: 'Quote requests' },
  admin: { group: 'CRM & Sales', useAsTitle: 'title', defaultColumns: ['title', 'status', 'requestedBy', 'createdAt'] },
  defaultSort: '-createdAt',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ requestedBy: { equals: user.id } } as Where) : false),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ and: [{ requestedBy: { equals: user.id } }, { status: { equals: 'new' } }] } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number } | null
        const team = hasRole(req.user, 'team')
        if (team) {
          // The scope is theirs; the price is Ernest's.
          for (const k of ['plans', 'pricing', 'quotedAmountMinor', 'quotedCurrency', 'fxRate', 'priceNote', 'approvedBy', 'approvedAt', 'deal', 'status']) data[k] = originalDoc?.[k] ?? null
          if (operation === 'create') {
            data.requestedBy = user!.id
            data.status = 'new'
          }
        } else if (operation === 'create') {
          data.requestedBy = data.requestedBy ?? null
          data.status = data.status || 'new'
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const leadId = refId(merged.lead)
        if (!leadId) throw new APIError('Choose the lead.', 400)
        const lead = (await req.payload.findByID({ collection: 'leads', id: leadId, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
        if (!lead) throw new APIError('That lead is not there.', 400)
        if (team && String(refId(lead.assignedTo)) !== String(user!.id)) throw new APIError('Ask for a price on your own leads.', 403)
        if (!String(merged.featuresRequested ?? '').trim()) throw new APIError('Write what they want, in their words.', 400)
        if (team && operation === 'create' && !(Array.isArray(merged.services) && merged.services.length)) throw new APIError('Say which service they want, or Something else.', 400)

        if (!team) {
          // A custom plan in the mix makes the whole quote custom (spec 4.7).
          const planIds = ((merged.plans ?? []) as unknown[]).map(refId).filter(Boolean) as number[]
          if (planIds.length) {
            const plans = await req.payload.find({ collection: 'pricingPlans', where: { id: { in: planIds } }, limit: planIds.length, depth: 0, overrideAccess: true, req })
            if (plans.docs.some((p) => (p as { custom?: boolean }).custom)) data.pricing = 'custom'
          }
          if (data.status && data.status !== originalDoc?.status && data.status === 'priced') {
            if (!(Number(merged.quotedAmountMinor) > 0)) throw new APIError('Enter the price before approving it.', 400)
            if (!merged.quotedCurrency) throw new APIError('Say which currency the price is in.', 400)
            data.approvedBy = user?.id ?? null
            data.approvedAt = new Date().toISOString()
          }
        }
        data.title = `Quote: ${lead.businessName || lead.title || 'a lead'}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const leadId = refId(doc.lead)
        if (operation === 'create' && leadId) {
          // The lead moves to the Quote stage, which tells Ernest a price is wanted.
          const lead = (await req.payload.findByID({ collection: 'leads', id: leadId, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
          if (lead && LIVE_STAGES.includes(lead.status)) {
            await req.payload.update({ collection: 'leads', id: leadId, data: { status: 'proposal-requested' } as never, overrideAccess: true, req }).catch((err) => req.payload.logger.error({ err }, 'Could not move the lead to Quote'))
          }
        }
        if (doc.status === 'priced' && previousDoc?.status !== 'priced' && refId(doc.requestedBy)) {
          const amount = `${doc.quotedCurrency} ${(Number(doc.quotedAmountMinor) / 100).toLocaleString('en-GB')}`
          await notify(req, { to: [refId(doc.requestedBy)], kind: 'quote', title: `Ernest priced ${String(doc.title).replace(/^Quote: /, '')}: ${amount}`, body: doc.priceNote || undefined, link: `/quotes/${doc.id}`, action: 'Open the quote' })
          await audit(req, { action: 'quote.priced', summary: `${doc.title} priced at ${amount}`, person: refId(doc.requestedBy), subjectType: 'quote-requests', subjectId: doc.id })
        }
        return doc
      },
    ],
  },
  endpoints: [
    {
      // "Create the deal": a draft proposal from the priced quote (spec 5.5).
      path: '/:id/deal',
      method: 'post',
      handler: async (req) => {
        if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest creates the deal.' }, { status: 403 })
        const id = Number(req.routeParams?.id)
        const q = (await req.payload.findByID({ collection: 'quote-requests', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
        if (!q) return Response.json({ error: 'That quote is not there.' }, { status: 404 })
        if (refId(q.deal)) return Response.json({ error: 'This quote already has its deal.', deal: refId(q.deal) }, { status: 409 })
        if (!q.approvedAt) return Response.json({ error: 'Price and approve the quote first.' }, { status: 400 })
        const lead = (await req.payload.findByID({ collection: 'leads', id: Number(refId(q.lead)), depth: 0, overrideAccess: true, req })) as Record<string, any>
        const deal = await req.payload.create({
          collection: 'proposals',
          data: {
            status: 'needs-review',
            dealStatus: 'sent',
            lead: lead.id,
            clientName: lead.businessName || lead.title,
            contactName: lead.name || undefined,
            clientEmail: lead.email || undefined,
            phone: lead.whatsapp || lead.phone || undefined,
            country: lead.country || undefined,
            currency: q.quotedCurrency,
            total: Number(q.quotedAmountMinor) / 100,
            pricing: q.pricing || 'custom',
            service: dealService(q.services),
            plans: q.plans ?? [],
            specialTerms: q.priceNote || undefined,
          } as never,
          overrideAccess: true,
          req,
        })
        await req.payload.update({ collection: 'quote-requests', id, data: { deal: deal.id, status: 'sent' } as never, overrideAccess: true, req })
        const who = await userById(req, refId(q.requestedBy))
        if (who) await notify(req, { to: [who.id], kind: 'quote', title: `${String(q.title).replace(/^Quote: /, '')}: the deal is drafted`, link: `/quotes/${id}`, email: false })
        return Response.json({ ok: true, deal: deal.id })
      },
    },
  ],
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'lead', type: 'relationship', relationTo: 'leads', required: true, index: true, admin: { width: '40%' } },
        { name: 'requestedBy', label: 'Asked by', type: 'relationship', relationTo: 'users', index: true, admin: { width: '30%', readOnly: true } },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'new',
          index: true,
          options: [
            { label: 'New', value: 'new' },
            { label: 'Priced', value: 'priced' },
            { label: 'Sent', value: 'sent' },
            { label: 'Accepted', value: 'accepted' },
            { label: 'Declined', value: 'declined' },
          ],
          admin: { width: '30%' },
        },
      ],
    },
    { name: 'services', label: 'What they want', type: 'select', hasMany: true, options: WANTED },
    { name: 'whatTheyHave', label: 'What they have now', type: 'textarea', admin: { description: 'Their website, social pages, logo, ads: whatever they already have.' } },
    {
      // Asked only when the work is a website or something bespoke.
      type: 'row',
      fields: [
        {
          name: 'hasWebsite',
          label: 'Their website now',
          type: 'select',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Broken or old', value: 'broken' },
            { label: 'Working', value: 'working' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'mustDo',
          label: 'It must',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Take enquiries', value: 'enquiries' },
            { label: 'Sell online', value: 'sell-online' },
            { label: 'Take bookings', value: 'bookings' },
            { label: 'Something else', value: 'other' },
          ],
          admin: { width: '34%' },
        },
        {
          name: 'users',
          label: 'Used by',
          type: 'select',
          options: [
            { label: 'Their customers', value: 'customers' },
            { label: 'Their staff', value: 'staff' },
            { label: 'Both', value: 'both' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    { name: 'featuresRequested', label: 'What they want, in their words', type: 'textarea', required: true },
    { name: 'examplesTheyLike', label: 'Examples they like', type: 'array', fields: [{ name: 'url', type: 'text', required: true }] },
    {
      type: 'row',
      fields: [
        { name: 'deadline', label: 'Needed by', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'budgetMentioned', label: 'Budget they mentioned', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      type: 'collapsible',
      label: 'The price (Ernest)',
      fields: [
        { name: 'plans', label: 'From the price list', type: 'relationship', relationTo: 'pricingPlans', hasMany: true, access: { read: pricedForThem } },
        {
          type: 'row',
          fields: [
            {
              name: 'pricing',
              type: 'select',
              options: [
                { label: 'Package price', value: 'package' },
                { label: 'Custom price', value: 'custom' },
              ],
              access: { read: pricedForThem },
              admin: { width: '25%' },
            },
            { name: 'quotedCurrency', label: 'Currency', type: 'text', access: { read: pricedForThem }, admin: { width: '20%' } },
            { name: 'quotedAmountMinor', label: 'Price (minor units)', type: 'number', min: 0, access: { read: pricedForThem }, admin: { width: '30%' } },
            { name: 'fxRate', label: 'Rate used (units for GH₵1)', type: 'number', access: { read: pricedForThem }, admin: { width: '25%' } },
          ],
        },
        { name: 'priceNote', label: 'What the price includes', type: 'textarea', access: { read: pricedForThem } },
        {
          type: 'row',
          fields: [
            { name: 'approvedBy', label: 'Approved by', type: 'relationship', relationTo: 'users', admin: { width: '33%', readOnly: true } },
            { name: 'approvedAt', label: 'Approved on', type: 'date', admin: { width: '33%', readOnly: true } },
            { name: 'deal', type: 'relationship', relationTo: 'proposals', admin: { width: '34%', readOnly: true } },
          ],
        },
      ],
    },
  ],
}
