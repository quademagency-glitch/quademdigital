// The home page hero (row D final): a pinned phone story in seven steps.
//
// The words are the CMS group dHero merged over the approved defaults in
// hero.defaults.json, field by field, so the page shows the approved words
// before anyone fills the CMS in and an empty CMS box never blanks a line.
// The story always has the seven steps the design draws (intro, five chapters,
// the end): a CMS row replaces the words of the step at the same position.
// The button goes where homepage.primaryCta points (the free check-up), the
// same way the old hero resolved it. "See our work" is the intro step's link.
import defaults from './hero.defaults.json';
import { pick } from './emph';
import { resolveBookingHref } from '../booking';
import { safeHref } from '../payload';
import { normaliseLocalHref } from '../publicSettings.js';

export type DLink = { label: string; href: string };
export type DCard = { label: string; value: string; note: string };
export type DHeroStep = {
  label: string;
  title: string;
  text: string;
  word: string;
  links: DLink[];
  cards: DCard[];
};
export type DHeroWords = {
  steps: DHeroStep[];
  cta: DLink;
  trust: string;
  after: { title: string; text: string };
};

const obj = (value: unknown): Record<string, any> => (value && typeof value === 'object' ? (value as Record<string, any>) : {});
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A link on this site or an anchor, tidied; anything else falls back. */
export function localHref(value: unknown, fallback: string): string {
  const href = safeHref(value);
  if (!href || !(href.startsWith('/') || href.startsWith('#')) || href.startsWith('//')) return fallback;
  return normaliseLocalHref(href) || fallback;
}

/** CMS link rows with a label and a usable address, else the approved ones. */
export function mergeLinks(value: unknown, fallback: DLink[]): DLink[] {
  const rows = Array.isArray(value) ? value : [];
  const usable = rows
    .map((row: any) => ({ label: str(row?.label).trim(), href: localHref(row?.href, '') }))
    .filter((row) => row.label && row.href);
  return usable.length ? usable : fallback;
}

/** CMS card rows (a row with any words), else the approved ones. Empty boxes stay empty on purpose. */
export function mergeCards(value: unknown, fallback: DCard[]): DCard[] {
  const rows = Array.isArray(value) ? value : [];
  const usable = rows
    .map((row: any) => ({ label: str(row?.label), value: str(row?.value), note: str(row?.note) }))
    .filter((row) => (row.label + row.value + row.note).trim());
  return usable.length ? usable : fallback;
}

/** Each approved step, with the CMS row at the same position laid over it. */
export function mergeSteps<T extends { label: string; title: string; text: string; word: string; links: DLink[]; cards: DCard[] }>(value: unknown, fallback: T[]): T[] {
  const rows = Array.isArray(value) ? value : [];
  return fallback.map((step, i) => {
    const row = obj(rows[i]);
    return {
      ...step,
      label: pick(row.label, step.label),
      title: pick(row.title, step.title),
      text: pick(row.text, step.text),
      word: pick(row.word, step.word),
      links: mergeLinks(row.links, step.links),
      cards: mergeCards(row.cards, step.cards),
    };
  });
}

/** The CMS group dHero over the approved words, with the button pointing at the check-up. */
export function loadHero(homepage: any): DHeroWords {
  const g = obj(homepage?.dHero);
  const primary = obj(homepage?.primaryCta);
  const d = defaults as DHeroWords;
  const ctaLabel = pick(g.cta?.label, d.cta.label);
  const ctaHref = localHref(pick(g.cta?.href, pick(primary.link, d.cta.href)), d.cta.href);
  return {
    steps: mergeSteps(g.steps, d.steps),
    cta: { label: ctaLabel, href: resolveBookingHref(ctaHref, ctaLabel) },
    trust: pick(g.trust, d.trust),
    after: { title: pick(g.after?.title, d.after.title), text: pick(g.after?.text, d.after.text) },
  };
}

/**
 * A headline as the design sets it: the words before the [bracketed] phrase on
 * the first line, the bracketed phrase (blue) on the second. Without brackets
 * the whole headline is the first line.
 */
export function splitTitle(title: string): { first: string; second: string } {
  const at = title.indexOf('[');
  if (at <= 0) return { first: at === 0 ? '' : title, second: at === 0 ? title : '' };
  return { first: title.slice(0, at).trim(), second: title.slice(at).trim() };
}

/** The proof line under the button: items split at " · ", each kept on one line. */
export function trustItems(trust: string): string[] {
  return trust.split(/\s+·\s+/).map((item) => item.trim().replace(/\s+/g, ' ')).filter(Boolean);
}
