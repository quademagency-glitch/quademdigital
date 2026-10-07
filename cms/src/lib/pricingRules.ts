import { APIError, type CollectionBeforeChangeHook, type Endpoint, type PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { audit } from './audit'

/*
  Editing the price list from the founder portal (POST /api/pricingPlans/:id/edit
  and /api/pricingPlans/add), and the one rule that holds wherever a plan is
  saved.

  THE RULE. scripts/pricing-audit.mjs (npm run check:prices) finds the six
  homepage bundles by exact name and market, and compares each against the
  service tiers it is made of. Renaming one, moving it to the other market or
  turning it into a package makes that check report it missing, so those three
  changes are refused on those six, in the CMS admin as much as here. Change
  BUNDLE_PARTS in that script in the same commit if one must change.

  THE PRICE TEXT. Each plan carries its number (priceGHS for Africa, priceUSD
  for everyone else) and two texts written from it: `price`, required, and
  `priceLabel`, which the website shows INSTEAD of the number when set ("from
  $3,750"). A new number that left them alone would leave the old figure on
  the homepage, so both are rewritten in the style they already have.
*/

export const PROTECTED_BUNDLES: Record<string, 'ghana' | 'international'> = {
  Starter: 'ghana',
  Growth: 'ghana',
  Premium: 'ghana',
  'Website build': 'international',
  'Video retainer': 'international',
  'Growth retainer': 'international',
}

type Plan = Record<string, unknown> & {
  name?: string | null
  market?: string | null
  kind?: string | null
  custom?: boolean | null
  priceGHS?: number | null
  priceUSD?: number | null
  price?: string | null
  priceLabel?: string | null
  billingCycle?: string | null
}

const isProtected = (p: Plan) => p.kind !== 'package' && PROTECTED_BUNDLES[String(p.name ?? '')] === p.market

/** Why a save would break the price check, or null. */
export function protectedChange(before: Plan, after: Plan): string | null {
  if (!isProtected(before)) return null
  const name = String(before.name)
  if (after.name !== undefined && after.name !== before.name) return `“${name}” is one of the six homepage bundles the price check finds by name, so it keeps its name. Change scripts/pricing-audit.mjs first if it must.`
  if (after.market !== undefined && after.market !== before.market) return `“${name}” is one of the six homepage bundles, so it stays in its market.`
  if (after.kind !== undefined && after.kind !== 'bundle' && after.kind !== null) return `“${name}” is one of the six homepage bundles, so it stays a bundle.`
  return null
}

export const pricingBeforeChange: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation !== 'update' || !originalDoc) return data
  const why = protectedChange(originalDoc as Plan, data as Plan)
  if (why) throw new APIError(why, 400, null, true)
  return data
}

const SYMBOL = { ghana: 'GH₵', international: '$' } as const
const fmt = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n)
const monthly = (cycle: unknown) => /mo|month/i.test(String(cycle ?? ''))

/** The plan's `price` text for a number, in the style the old text had. */
export function priceText(old: string | null | undefined, n: number | null, market: string, custom: boolean, cycle: unknown) {
  if (custom || n === null) return 'Custom'
  // The three Africa homepage bundles hold a bare number ("5500"): keep it bare.
  if (old && /^\d+(\.\d+)?$/.test(old.trim())) return String(n)
  const from = old && /^from\b/i.test(old.trim()) ? 'from ' : ''
  return `${from}${SYMBOL[market === 'international' ? 'international' : 'ghana']}${fmt(n)}${monthly(cycle) ? ' a month' : ''}`
}

/** A label that quotes the old figure ("from $3,750") quotes the new one; any other label is left alone. */
export function relabel(label: string | null | undefined, oldN: number | null, newN: number | null, market: string) {
  if (!label || oldN === null || newN === null || oldN === newN) return label ?? null
  const sym = SYMBOL[market === 'international' ? 'international' : 'ghana']
  const before = `${sym}${fmt(oldN)}`
  return label.includes(before) ? label.split(before).join(`${sym}${fmt(newN)}`) : label
}

const EDITABLE = ['name', 'market', 'kind', 'service', 'custom', 'active', 'priceGHS', 'priceUSD', 'billingCycle', 'description', 'isPopular', 'features', 'pageUrl', 'order'] as const
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * The changes to save for a plan, checked, with its texts rewritten, or why
 * not. `plan` is empty for a new one.
 */
export function planEdit(plan: Plan, data: unknown): { error: string } | { changes: Plan; oldPrice: number | null; newPrice: number | null } {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const has = (k: string) => Object.prototype.hasOwnProperty.call(d, k) && (EDITABLE as readonly string[]).includes(k)
  const out: Plan = {}
  if (has('name')) {
    if (!text(d.name)) return { error: 'The plan needs a name.' }
    out.name = text(d.name)
  }
  if (has('market')) {
    if (!['ghana', 'international'].includes(String(d.market))) return { error: 'Choose who it is shown to: Africa or everyone else.' }
    out.market = String(d.market)
  }
  if (has('kind')) {
    if (!['bundle', 'package'].includes(String(d.kind))) return { error: 'A plan is a bundle or a package.' }
    out.kind = String(d.kind)
  }
  if (has('service')) out.service = d.service === '' || d.service === null ? null : Number(d.service)
  for (const k of ['custom', 'active', 'isPopular'] as const) if (has(k)) out[k] = d[k] === true
  for (const k of ['billingCycle', 'description', 'pageUrl'] as const) if (has(k)) out[k] = text(d[k]) || null
  if (has('pageUrl') && out.pageUrl && !/^\/[\w\-/]*\/$/.test(String(out.pageUrl))) return { error: 'Where the card leads is a path on the site with a slash at each end, such as /services/web-design/.' }
  if (has('order')) out.order = d.order === '' || d.order === null ? null : Number(d.order)
  if (has('features')) {
    if (!Array.isArray(d.features)) return { error: 'What is included is a list.' }
    out.features = d.features.map((f) => text(typeof f === 'object' && f ? (f as { feature?: unknown }).feature : f)).filter(Boolean).map((feature) => ({ feature }))
  }

  const merged = { ...plan, ...out }
  const market = String(merged.market ?? 'ghana')
  const custom = merged.custom === true
  const field = market === 'international' ? 'priceUSD' : 'priceGHS'
  if (has(field)) {
    const v = d[field] === '' || d[field] === null || d[field] === undefined ? null : Number(d[field])
    if (v !== null && (!Number.isFinite(v) || v <= 0)) return { error: 'A price is an amount above nothing, such as 2500.' }
    out[field] = v
  }
  const newPrice = (out[field] !== undefined ? out[field] : merged[field]) as number | null
  if (!custom && !(Number(newPrice) > 0)) return { error: market === 'international' ? 'Give it a price in US dollars, or tick Custom quote.' : 'Give it a price in cedis, or tick Custom quote.' }
  const why = plan.name !== undefined ? protectedChange(plan, out) : null
  if (why) return { error: why }

  const oldPrice = (plan[field] as number | null | undefined) ?? null
  out.price = priceText(plan.price, custom ? null : Number(newPrice), market, custom, merged.billingCycle)
  out.priceLabel = custom ? (plan.priceLabel ?? null) : relabel(plan.priceLabel, oldPrice, Number(newPrice), market)
  return { changes: out, oldPrice, newPrice: custom ? null : Number(newPrice) }
}

const say = (error: string, status: number) => Response.json({ error }, { status })
async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}
const money = (n: number | null, market: string) => (n === null ? 'Custom' : `${SYMBOL[market === 'international' ? 'international' : 'ghana']}${fmt(n)}`)
const NOT_SENT = ['id', 'createdAt', 'updatedAt']

export const pricingEndpoints: Endpoint[] = [
  {
    // Change a plan. The whole record goes back so nothing it was not given is reset.
    path: '/:id/edit',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return say('Only the founder can do this.', req.user ? 403 : 401)
      const id = (req.routeParams as { id?: string } | undefined)?.id
      if (!id || !/^\d+$/.test(id)) return say('That plan is not there.', 404)
      const plan = (await req.payload.findByID({ collection: 'pricingPlans', id: Number(id), depth: 0, overrideAccess: true, req, disableErrors: true })) as unknown as Plan | null
      if (!plan) return say('That plan is not there.', 404)
      const b = await body(req)
      const r = planEdit(plan, b.data)
      if ('error' in r) return say(r.error, 400)
      const whole = Object.fromEntries(Object.entries(plan).filter(([k]) => !NOT_SENT.includes(k)))
      const doc = (await req.payload.update({ collection: 'pricingPlans', id: Number(id), data: { ...whole, ...r.changes } as never, depth: 0, overrideAccess: true, req })) as unknown as Plan
      const market = String(doc.market)
      const moved = r.oldPrice !== r.newPrice
      await audit(req, {
        action: 'price.changed',
        summary: `${doc.name} (${market === 'international' ? 'everyone else' : 'Africa'}): ${moved ? `${money(r.oldPrice, market)} to ${money(r.newPrice, market)}` : 'details changed, price unchanged'}${text(b.reason) ? `. Why: ${text(b.reason).slice(0, 300)}` : ''}`,
        subjectType: 'pricingPlans',
        subjectId: Number(id),
      })
      return Response.json({ ok: true, doc })
    },
  },
  {
    // A new plan, as a package unless said otherwise.
    path: '/add',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return say('Only the founder can do this.', req.user ? 403 : 401)
      const b = await body(req)
      const d: Record<string, unknown> = { kind: 'package', active: true, market: 'ghana', ...((b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>) }
      if (!text(d.name)) return say('The plan needs a name.', 400)
      if (d.kind !== 'package' && PROTECTED_BUNDLES[text(d.name)] === d.market) return say(`There is already a homepage bundle called “${text(d.name)}”. Change that one, or give this a different name.`, 400)
      const r = planEdit({}, d)
      if ('error' in r) return say(r.error, 400)
      const doc = (await req.payload.create({ collection: 'pricingPlans', data: { market: 'ghana', kind: 'package', active: true, ...r.changes } as never, depth: 0, overrideAccess: true, req })) as unknown as Plan & { id: number }
      await audit(req, {
        action: 'price.added',
        summary: `${doc.name} (${doc.market === 'international' ? 'everyone else' : 'Africa'}) added at ${money(r.newPrice, String(doc.market))}`,
        subjectType: 'pricingPlans',
        subjectId: doc.id,
      })
      return Response.json({ ok: true, doc }, { status: 201 })
    },
  },
]
