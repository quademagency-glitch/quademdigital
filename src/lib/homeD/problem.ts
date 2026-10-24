// The home page problem section (row D final): a pinned phone story in eight
// steps, the opening, the six problems each with its fix, and the check-up.
//
// The words are the CMS group dProblem merged over the approved defaults in
// problem.defaults.json, field by field, so the page shows the approved words
// before anyone fills the CMS in and an empty CMS box never blanks a line. The
// design draws exactly six problems (each has its own phone screen), so a CMS
// row only replaces the words of the problem at the same position. The button
// goes where homepage.primaryCta points (the free check-up), as on the old hero.
import defaults from './problem.defaults.json';
import { pick, pickRows } from './emph';
import { resolveBookingHref } from '../booking';
import { safeHref } from '../payload';
import { normaliseLocalHref } from '../publicSettings.js';

export type DProblemWords = typeof defaults & { ctaHref: string };
type Row = Record<string, any>;

const obj = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {});

/** A path on this site or an anchor, tidied; anything else falls back. */
export function localHref(value: unknown, fallback: string): string {
  const href = safeHref(value);
  if (!href || !(href.startsWith('/') || href.startsWith('#')) || href.startsWith('//')) return fallback;
  return normaliseLocalHref(href) || fallback;
}

/** Every text field of the approved row, with the CMS row's words laid over it. */
export function mergeRow<T extends Row>(value: unknown, fallback: T): T {
  const row = obj(value);
  const out: Row = {};
  for (const [key, def] of Object.entries(fallback)) {
    if (Array.isArray(def)) out[key] = pickRows(Array.isArray(row[key]) ? row[key].filter((r: Row) => Object.values(obj(r)).some((v) => typeof v === 'string' && v.trim())) : [], def);
    else if (def && typeof def === 'object') out[key] = mergeRow(row[key], def as Row);
    else out[key] = pick(row[key], def as string);
  }
  return out as T;
}

/** The approved rows, each with the CMS row at the same position laid over it. */
export function mergeFixed<T extends Row>(value: unknown, fallback: T[]): T[] {
  const rows = Array.isArray(value) ? value : [];
  return fallback.map((row, i) => mergeRow(rows[i], row));
}

/**
 * A headline as the design sets it: the words before the [bracketed] phrase on
 * the first line, the bracketed phrase (blue) and anything after it on the
 * second. Without brackets the whole headline is the first line.
 */
export function splitTitle(title: string): { first: string; second: string } {
  const at = title.indexOf('[');
  if (at < 0) return { first: title, second: '' };
  return { first: title.slice(0, at).trim(), second: title.slice(at).trim() };
}

/** Where the main button goes: the CMS primary button link, else the free check-up. */
export function checkupHref(homepage: any, label: string): string {
  const fallback = '/offers/free-seo-audit/';
  return resolveBookingHref(localHref(obj(homepage?.primaryCta).link, fallback), label);
}

/** The CMS group dProblem over the approved words, with the button pointing at the check-up. */
export function loadProblem(homepage: any): DProblemWords {
  const g = obj(homepage?.dProblem);
  const merged = mergeRow(g, { ...defaults, problems: [] as Row[] }) as unknown as typeof defaults;
  merged.problems = mergeFixed(g.problems, defaults.problems).map((row, i) => ({
    ...row,
    linkHref: localHref(row.linkHref, defaults.problems[i].linkHref),
  }));
  return { ...merged, ctaHref: checkupHref(homepage, merged.ctaLabel) };
}
