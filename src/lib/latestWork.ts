// New work gets the prominence (Ernest, 31 Oct 2026: "new portfolio projects
// should always get prominence, because they are the latest work"). Publish a
// case study and it joins the front of the home reel by itself, ahead of the
// frames whose words were written by hand (dWork in the CMS). Everything else
// that shows "our work" asks here too (the same day: "every new portfolio
// project should take prominence on the website"), so it moves by itself. Left
// alone on purpose: what only an older project can prove, like Omek's measured
// before and after and its client quote.

/** Already on the reel, with their own hand-written frame. */
const HAS_OWN_FRAME = ['omek-storefront', 'quajo-speaks', 'quaderp-landing'];
const HOW_MANY = 2;

const byNewest = (a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

export const latestWork = (studies: any[] | null | undefined): any[] =>
  (studies || [])
    .filter((s) => s?.published === true && s.slug && !HAS_OWN_FRAME.includes(s.slug) && s.coverImage && typeof s.coverImage === 'object')
    .sort(byNewest)
    .slice(0, HOW_MANY);

/**
 * Where a frame of the home reel's words now sits: the title card stays first,
 * and the latest work goes between it and the rest. The hero's results strip
 * links in by these numbers, so it needs them too.
 */
export const workFrame = (step: number, latestCount: number): number => (step === 0 ? 0 : step + latestCount);

/**
 * The newest finished website, for the places that show a site on a screen: the
 * hero's laptop and wall, the home page's build step, the Services and Global
 * pictures, Web Design's first row. A build still in progress waits its turn.
 */
export const newestSite = (studies: any[] | null | undefined): any | null =>
  (studies || [])
    .filter((s) => s?.published === true && s.slug && s.coverImage && typeof s.coverImage === 'object' && s.coverImage.url
      && Array.isArray(s.showUnderServices) && s.showUnderServices.includes('web-design')
      && !/in.?progress/i.test(`${s.status || ''} ${s.resultText || ''}`))
    .sort(byNewest)[0] || null;

/** A result's wording up to its first comma, for places with room for one short line. */
export const shortResult = (text: unknown): string => String(text || '').split(',')[0].trim();

/** The latest work's results for the hero's strip, each opening its own frame on the home reel. */
export const latestResults = (studies: any[] | null | undefined) =>
  latestWork(studies)
    .map((s, i) => ({ value: s.resultMetric, label: [s.title, shortResult(s.resultText)].filter(Boolean).join(' · '), frame: i + 1 }))
    .filter((r) => r.value);

/** The address a browser window shows for a project, where we know it. */
const SITE_HOSTS: Record<string, string> = { 'omek-storefront': 'omekgh.com', 'quaderp-landing': 'quaderp.app', 'quajo-speaks': 'quajospeaks.com', 'tannor-freight': 'tannorfreight.com' };
export const hostOf = (study: any): string => SITE_HOSTS[study?.slug] || study?.title || '';

const KIND: Record<string, string> = { client: 'Client project', self: 'Internal project', concept: 'Concept project' };

/** The newest website as a captioned picture, or the given one if there is none. */
export const newestSiteVisual = <T,>(studies: any[] | null | undefined, fallback: T): any => {
  const site = newestSite(studies);
  if (!site) return fallback;
  return { ...site.coverImage, alt: `${site.title}'s website, built by Quadem`, caption: [site.title, KIND[site.projectType]].filter(Boolean).join(' · '), credit: '' };
};
