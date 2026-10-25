// The home page Process section (row D final): a pinned phone story in six
// steps (the four steps at a glance, steps 1 to 4, where to start), with the
// phone living through the client's side of each step.
//
// Words: the CMS group dProcess merged over process.defaults.json, field by
// field, so the page shows the approved words before anyone fills the CMS in.
// The story always has the six steps the design draws: a CMS row replaces the
// words of the step at the same position.
// The processSteps collection is not read here: the old home page section was
// its only user, so this group holds every word of the new one.
import defaults from './process.defaults.json';
import { pick } from './emph';
import { resolveBookingHref } from '../booking';
import { localHref, mergeCards, mergeLinks, type DCard, type DLink } from './hero';

export type DProcessStep = {
  label: string;
  title: string;
  text: string;
  note: string;
  word: string;
  links: DLink[];
  cards: DCard[];
};
export type DProcessWords = {
  pageTitle: string;
  titleLabel: string;
  aria: string;
  steps: DProcessStep[];
  cta: DLink;
  trust: string;
  fixed: { text: string }[];
};

const obj = (value: unknown): Record<string, any> => (value && typeof value === 'object' ? (value as Record<string, any>) : {});
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The CMS group dProcess over the approved words, with the button pointing at the check-up. */
export function loadProcess(homepage: any): DProcessWords {
  const g = obj(homepage?.dProcess);
  const primary = obj(homepage?.primaryCta);
  const d = defaults as DProcessWords;
  const cmsSteps = Array.isArray(g.steps) ? g.steps : [];
  const steps = d.steps.map((step, i) => {
    const row = obj(cmsSteps[i]);
    return {
      ...step,
      label: pick(row.label, step.label),
      title: pick(row.title, step.title),
      text: pick(row.text, step.text),
      note: pick(row.note, step.note),
      word: pick(row.word, step.word),
      links: mergeLinks(row.links, step.links),
      cards: mergeCards(row.cards, step.cards),
    };
  });
  const ctaLabel = pick(g.cta?.label, d.cta.label);
  const ctaHref = localHref(pick(g.cta?.href, pick(primary.link, d.cta.href)), d.cta.href);
  const fixed = (Array.isArray(g.fixed) ? g.fixed : []).map(obj).filter((row) => str(row.text)).map((row) => ({ text: str(row.text) }));
  return {
    pageTitle: pick(g.pageTitle, d.pageTitle),
    titleLabel: pick(g.titleLabel, d.titleLabel),
    aria: pick(g.aria, d.aria),
    steps,
    cta: { label: ctaLabel, href: resolveBookingHref(ctaHref, ctaLabel) },
    trust: pick(g.trust, d.trust),
    fixed: fixed.length ? fixed : d.fixed,
  };
}
