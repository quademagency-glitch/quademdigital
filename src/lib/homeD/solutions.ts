// The home page solutions section (row D final): a pinned phone story in eight
// steps. The phone's home screen holds the six services as apps in two folders,
// One-off projects and Monthly plans; each step opens one app, the last shows
// where to start.
//
// The words are the CMS group dSolutions merged over the approved defaults in
// solutions.defaults.json, field by field (same rules as the problem section).
// The design draws exactly six apps, so a CMS row only replaces the words of
// the service at the same position. Each "See ..." link goes to that service's
// page on this site.
import defaults from './solutions.defaults.json';
import { checkupHref, localHref, mergeFixed, mergeRow } from './problem';

export type DSolutionsWords = typeof defaults & { ctaHref: string };

/** The CMS group dSolutions over the approved words, with the button pointing at the check-up. */
export function loadSolutions(homepage: any): DSolutionsWords {
  const g = homepage?.dSolutions && typeof homepage.dSolutions === 'object' ? homepage.dSolutions : {};
  const merged = mergeRow(g, { ...defaults, services: [] as any[] }) as unknown as typeof defaults;
  merged.services = mergeFixed(g.services, defaults.services).map((row, i) => ({
    ...row,
    linkHref: localHref(row.linkHref, defaults.services[i].linkHref),
  }));
  merged.customHref = localHref(merged.customHref, defaults.customHref);
  return { ...merged, ctaHref: checkupHref(homepage, merged.ctaLabel) };
}
