// The home page Work section (row D final): a pinned phone story in eight
// steps (all our work, six projects, your turn).
//
// Words: the CMS group dWork merged over work.defaults.json, field by field,
// so the page shows the approved words before anyone fills the CMS in. The
// story always has the eight steps the design draws, and each project has its
// own drawing on the phone, so a CMS row replaces the words of the step at the
// same position (row 2 is Omek, row 3 Quajo Speaks, and so on).
// The pictures are not words: Omek's and Quajo Speaks's screenshots come from
// their caseStudies docs (see DWork.astro); the rest are public files in /images.
import defaults from './work.defaults.json';
import { pick } from './emph';
import { resolveBookingHref } from '../booking';
import { localHref, mergeCards, mergeLinks, type DCard, type DLink } from './hero';

export type DWorkChip = { text: string; kind: 'client' | 'progress' | 'live' | 'own' };
export type DWorkStep = {
  label: string;
  title: string;
  text: string;
  word: string;
  chips: DWorkChip[];
  links: DLink[];
  cards: DCard[];
};
export type DWorkRow = { name: string; sub: string; status: string; kind: 'progress' | 'done' };
export type DWorkWords = {
  pageTitle: string;
  titleLabel: string;
  aria: string;
  steps: DWorkStep[];
  cta: DLink;
  trust: string;
  reel: { pause: string; play: string };
  fixed: { text: string }[];
  results: { label: string; before: string; after: string }[];
  projects: DWorkRow[];
};

const CHIP_KINDS = new Set(['client', 'progress', 'live', 'own']);
const obj = (value: unknown): Record<string, any> => (value && typeof value === 'object' ? (value as Record<string, any>) : {});
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** CMS rows that have the named words, tidied by `map`, else the approved rows. */
function rows<T>(value: unknown, fallback: T[], keep: (row: Record<string, any>) => boolean, map: (row: Record<string, any>) => T): T[] {
  const usable = (Array.isArray(value) ? value : []).map(obj).filter(keep).map(map);
  return usable.length ? usable : fallback;
}

/** The CMS group dWork over the approved words, with the button pointing at the check-up. */
export function loadWork(homepage: any): DWorkWords {
  const g = obj(homepage?.dWork);
  const primary = obj(homepage?.primaryCta);
  const d = defaults as DWorkWords;
  const cmsSteps = Array.isArray(g.steps) ? g.steps : [];
  const steps = d.steps.map((step, i) => {
    const row = obj(cmsSteps[i]);
    return {
      ...step,
      label: pick(row.label, step.label),
      title: pick(row.title, step.title),
      text: pick(row.text, step.text),
      word: pick(row.word, step.word),
      links: mergeLinks(row.links, step.links),
      cards: mergeCards(row.cards, step.cards),
      chips: rows(row.chips, step.chips, (chip) => !!str(chip.text), (chip) => ({
        text: str(chip.text),
        kind: (CHIP_KINDS.has(chip.kind) ? chip.kind : 'own') as DWorkChip['kind'],
      })),
    };
  });
  const ctaLabel = pick(g.cta?.label, d.cta.label);
  const ctaHref = localHref(pick(g.cta?.href, pick(primary.link, d.cta.href)), d.cta.href);
  return {
    pageTitle: pick(g.pageTitle, d.pageTitle),
    titleLabel: pick(g.titleLabel, d.titleLabel),
    aria: pick(g.aria, d.aria),
    steps,
    cta: { label: ctaLabel, href: resolveBookingHref(ctaHref, ctaLabel) },
    trust: pick(g.trust, d.trust),
    reel: { pause: pick(g.reel?.pause, d.reel.pause), play: pick(g.reel?.play, d.reel.play) },
    fixed: rows(g.fixed, d.fixed, (row) => !!str(row.text), (row) => ({ text: str(row.text) })),
    results: rows(g.results, d.results, (row) => !!str(row.label), (row) => ({
      label: str(row.label),
      before: str(row.before),
      after: str(row.after),
    })),
    projects: rows(g.projects, d.projects, (row) => !!str(row.name), (row) => ({
      name: str(row.name),
      sub: str(row.sub),
      status: str(row.status),
      kind: row.kind === 'progress' ? 'progress' : 'done',
    })),
  };
}
