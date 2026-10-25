// The home page testimonials section, "What clients say" (25 October 2026).
//
// Words: the CMS group dTestimonials merged over testimonials.defaults.json,
// field by field. The quotes: the published testimonials in the testimonials
// collection (authorName, authorRole, quote), Emmanuel Korsah's first, then in
// the collection's order. With none published, the approved quote in the
// defaults, which he agreed to word for word.
import defaults from './testimonials.defaults.json';
import { pick } from './emph';
import { localHref } from './hero';

export type DQuote = { text: string; name: string; role: string };
export type DTestimonialsWords = typeof defaults;

const obj = (value: unknown): Record<string, any> => (value && typeof value === 'object' ? (value as Record<string, any>) : {});

/** The CMS group dTestimonials over the approved words. */
export function loadTestimonials(homepage: any): DTestimonialsWords {
  const g = obj(homepage?.dTestimonials);
  const q = obj(g.quote);
  return {
    pageTitle: pick(g.pageTitle, defaults.pageTitle),
    label: pick(g.label, defaults.label),
    chip: pick(g.chip, defaults.chip),
    linkLabel: pick(g.linkLabel, defaults.linkLabel),
    href: localHref(pick(g.href, defaults.href), defaults.href),
    quote: { text: pick(q.text, defaults.quote.text), name: pick(q.name, defaults.quote.name), role: pick(q.role, defaults.quote.role) },
  };
}

/** The quotes to show: published testimonials (the default author's first), else the approved quote. */
export function testimonialQuotes(testimonials: any[] | null | undefined, words: DTestimonialsWords): DQuote[] {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const live = (testimonials || [])
    .filter((t: any) => t?.published === true && str(t?.quote) && str(t?.authorName))
    .map((t: any) => ({ text: str(t.quote), name: str(t.authorName), role: str(t.authorRole) }));
  if (!live.length) return [words.quote];
  const want = words.quote.name.trim().toLowerCase();
  const first = live.findIndex((t) => t.name.toLowerCase() === want);
  return first > 0 ? [live[first], ...live.slice(0, first), ...live.slice(first + 1)] : live;
}
