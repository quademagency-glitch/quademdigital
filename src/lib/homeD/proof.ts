// The home page proof section (row D final): the "receipts" chat, a pinned
// phone story in eight steps.
//
// Words: the CMS group dProof merged over proof.defaults.json, field by field.
// Every number (Omek 50 to 95, 19.3s to 2.9s, 64 seconds, 40 leads, QuadERP
// 100/100) lives in the defaults next to its source and date, so a number is
// never written in the component.
// The client quote: a published testimonial from the testimonials collection
// (authorName, authorRole, quote) when there is one, preferring the one by the
// person the default quote is from; otherwise the approved words in the
// defaults, which Emmanuel Korsah agreed to word for word.
import defaults from './proof.defaults.json';
import { pick } from './emph';
import { resolveBookingHref } from '../booking';
import { localHref, mergeSteps, type DCard, type DLink } from './hero';

export type DProofStep = {
  label: string;
  title: string;
  text: string;
  word: string;
  links: DLink[];
  cards: DCard[];
};
type Defaults = typeof defaults;
export type DProofWords = Omit<Defaults, 'steps' | 'cta'> & { steps: DProofStep[]; cta: DLink };

const obj = (value: unknown): Record<string, any> => (value && typeof value === 'object' ? (value as Record<string, any>) : {});

/** Every key of an approved group, each from the CMS when it has words. */
const group = <T extends Record<string, string>>(value: unknown, fallback: T): T => {
  const v = obj(value);
  return Object.fromEntries(Object.entries(fallback).map(([k, fb]) => [k, pick(v[k], fb)])) as T;
};

/** Rows of one text field: CMS rows with words, else the approved rows. */
const textRows = <T extends Record<string, string>>(value: unknown, fallback: T[], keys: (keyof T)[]): T[] => {
  const rows = (Array.isArray(value) ? value : [])
    .map((row: any) => Object.fromEntries(keys.map((k) => [k, typeof row?.[k] === 'string' ? row[k].trim() : ''])) as T)
    .filter((row) => keys.every((k) => row[k]));
  return rows.length ? rows : fallback;
};

/** The published testimonial to quote, or null. */
export function pickTestimonial(testimonials: any[] | null | undefined, preferName: string): { text: string; name: string; role: string } | null {
  const live = (testimonials || []).filter((t: any) => t?.published === true && typeof t?.quote === 'string' && t.quote.trim() && typeof t?.authorName === 'string' && t.authorName.trim());
  if (!live.length) return null;
  const want = preferName.trim().toLowerCase();
  const chosen = live.find((t: any) => t.authorName.trim().toLowerCase() === want) || live[0];
  return { text: chosen.quote.trim(), name: chosen.authorName.trim(), role: typeof chosen.authorRole === 'string' ? chosen.authorRole.trim() : '' };
}

/** The CMS group dProof over the approved words, with the quote and the button resolved. */
export function loadProof(homepage: any, testimonials?: any[] | null): DProofWords {
  const g = obj(homepage?.dProof);
  const primary = obj(homepage?.primaryCta);
  const d = defaults;
  const ctaLabel = pick(g.cta?.label, d.cta.label);
  const ctaHref = localHref(pick(g.cta?.href, pick(primary.link, d.cta.href)), d.cta.href);
  const quote = pickTestimonial(testimonials, d.quote.name) || group(g.quote, d.quote);
  return {
    pageTitle: pick(g.pageTitle, d.pageTitle),
    steps: mergeSteps(g.steps, d.steps as DProofStep[]),
    cta: { label: ctaLabel, href: resolveBookingHref(ctaHref, ctaLabel) },
    trust: pick(g.trust, d.trust),
    quote,
    phone: {
      notes: textRows(g.phone?.notes, d.phone.notes, ['text']),
      first: pick(g.phone?.first, d.phone.first),
      last: pick(g.phone?.last, d.phone.last),
    },
    facts: group(g.facts, d.facts),
    receipt: {
      title: pick(g.receipt?.title, d.receipt.title),
      sub: pick(g.receipt?.sub, d.receipt.sub),
      rows: textRows(g.receipt?.rows, d.receipt.rows, ['label', 'value']),
      totalLabel: pick(g.receipt?.totalLabel, d.receipt.totalLabel),
      total: pick(g.receipt?.total, d.receipt.total),
    },
  };
}

/** A whole number from a fact ("95", "64s"), or the fallback when it has none. */
export function factNumber(value: string, fallback: number): number {
  const n = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}
