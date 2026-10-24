// The home page prices section (row D final, row A's six-card layout).
//
// Two things live here: the section's words (CMS group dPrices merged over the
// approved defaults in prices.defaults.json), and the price maths the cards
// need, kept out of the component so tests/home-prices.test.mjs can hold it to
// the market rule (src/lib/markets.js):
//   - both lists ship, international visible, africa hidden until the geo lookup
//   - every number carries the base of the list it is written in, so the
//     browser converts cedis from cedis and dollars from dollars
//   - copy never names a currency; the symbol comes from formatMoney
import defaults from './prices.defaults.json';
import { pick, pickRows } from './emph';
import { BASE_CURRENCY, CMS_AFRICA_MARKET, formatMoney } from '../markets.js';
import { billingKind } from '../billing.js';

export type DPricesWords = typeof defaults;
type Market = 'international' | 'africa';
type Row = 'oneOff' | 'monthly';

const group = <T extends Record<string, string>>(value: unknown, fallback: T): T => {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(fallback).map(([k, fb]) => [k, pick(v[k], fb)])) as T;
};

/** A path on this site, or the approved default. */
const localPath = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^\/(?!\/)[\w\-/#?=&.]*$/.test(value.trim()) ? value.trim() : fallback;

/** The CMS group dPrices over the approved words, field by field. */
export function loadPrices(homepage: any): DPricesWords {
  const g = homepage?.dPrices || {};
  const free = group(g.free, defaults.free);
  const items = Array.isArray(g.band?.items) ? g.band.items.filter((r: any) => typeof r?.text === 'string' && r.text.trim()) : [];
  return {
    eyebrow: pick(g.eyebrow, defaults.eyebrow),
    headline: pick(g.headline, defaults.headline),
    sub: pick(g.sub, defaults.sub),
    free: { ...free, link: localPath(g.free?.link, defaults.free.link) },
    oneOff: group(g.oneOff, defaults.oneOff),
    monthly: group(g.monthly, defaults.monthly),
    band: { label: pick(g.band?.label, defaults.band.label), items: pickRows(items, defaults.band.items) },
    foot: group(g.foot, defaults.foot),
    card: group(g.card, defaults.card),
  };
}

/*
  What a plan costs, as a number, in the currency its own list is written in.
  The market decides the field and there is no fallback across the two: an
  africa plan read as dollars would quote a Nigerian about six times the price.
  Same rule as src/components/home/PricingSection.astro.
*/
export function planAmount(plan: any, market: Market): number | null {
  const n = market === 'africa' ? Number(plan?.priceGHS ?? plan?.price) : Number(plan?.priceUSD);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ShownPrice = { base: string; amount: number | null; text: string; monthly: boolean };

/** The card's main price: base currency, number for the browser, server text. */
export function planPrice(plan: any, market: Market): ShownPrice {
  const base = BASE_CURRENCY[market];
  const amount = planAmount(plan, market);
  const text = amount === null ? String(plan?.priceLabel || plan?.price || 'Custom') : formatMoney(amount, base);
  return { base, amount, text, monthly: billingKind(plan?.billingCycle) === 'monthly' };
}

export type AddOnPrice = ShownPrice & { label: string; amount: number };

/**
 * The extra prices a card carries (PricingPlans addOns), for example the
 * automation system and monthly care on AI automation. Each is written in the
 * plan's own list, so it converts exactly like the main price. A row with no
 * label or no positive number is left off rather than shown as nothing.
 */
export function planAddOns(plan: any, market: Market): AddOnPrice[] {
  const base = BASE_CURRENCY[market];
  const rows = Array.isArray(plan?.addOns) ? plan.addOns : [];
  return rows
    .map((row: any) => ({ label: String(row?.label ?? '').trim(), amount: Number(row?.amount), cadence: row?.cadence }))
    .filter((row: any) => row.label && Number.isFinite(row.amount) && row.amount > 0)
    .map((row: any) => ({
      label: row.label,
      base,
      amount: row.amount,
      text: formatMoney(row.amount, base),
      monthly: billingKind(row.cadence) === 'monthly',
    }));
}

export const rowOf = (plan: any): Row => (billingKind(plan?.billingCycle) === 'monthly' ? 'monthly' : 'oneOff');

/*
  Shown if the CMS returns no plans at all: the cheapest way in to each row,
  from the international list (the visible default), as PricingSection.astro
  does. Mirrors the bundles in cms/scripts/restructure-services-2026-10.mjs.
*/
const FALLBACK_PLANS = [
  { id: 'fallback-1', name: 'One-page website', market: 'international', priceUSD: 3000, billingCycle: '', pageUrl: '/services/web-design/', features: [{ feature: 'One custom-designed page, written to bring in enquiries' }, { feature: 'Works properly on a phone' }, { feature: 'Set up so Google can find it' }, { feature: 'About a week from start to live' }] },
  { id: 'fallback-2', name: 'Get seen', market: 'international', priceUSD: 1750, billingCycle: '/mo', pageUrl: '/services/video-production/', features: [{ feature: '4 AI videos and 12 posts a month, on one platform' }, { feature: 'A monthly content calendar' }, { feature: 'Comments and messages answered' }, { feature: 'A short monthly report' }] },
];

export type PriceGroup = { market: Market; hidden: boolean; rows: { key: Row; plans: any[] }[] };

/**
 * Both price lists, each split into one-off projects and monthly plans.
 * Bundles only: the same collection holds each service's packages, which the
 * team's price list reads, and plans switched off stay off. International is
 * the visible default because the page is edge-cached; the price engine
 * (src/scripts/pricing.js) reveals the visitor's list after /api/geo/.
 */
export function priceGroups(pricingPlans: any[] | null | undefined): PriceGroup[] {
  const live = (pricingPlans || []).filter((p: any) => p?.kind !== 'package' && p?.active !== false);
  const all = live.length ? live : FALLBACK_PLANS;
  const africa = all.filter((p: any) => p.market === CMS_AFRICA_MARKET);
  const intl = all.filter((p: any) => p.market === 'international');
  const lists: { market: Market; plans: any[]; hidden: boolean }[] = africa.length && intl.length
    ? [{ market: 'international', plans: intl, hidden: false }, { market: 'africa', plans: africa, hidden: true }]
    : [{ market: 'international', plans: all, hidden: false }];
  const byOrder = (a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0);
  return lists.map(({ market, plans, hidden }) => ({
    market,
    hidden,
    rows: (['oneOff', 'monthly'] as Row[])
      .map((key) => ({ key, plans: plans.filter((p) => rowOf(p) === key).sort(byOrder) }))
      .filter((row) => row.plans.length > 0),
  }));
}

/** A plan's feature lines as plain strings. */
export const featureLines = (plan: any): string[] =>
  (Array.isArray(plan?.features) ? plan.features : [])
    .map((f: any) => String(typeof f === 'string' ? f : f?.feature ?? '').trim())
    .filter(Boolean);
