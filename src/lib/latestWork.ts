// New work gets the prominence (Ernest, 31 Oct 2026: "new portfolio projects
// should always get prominence, because they are the latest work"). Publish a
// case study and it joins the front of the home reel by itself, ahead of the
// frames whose words were written by hand (dWork in the CMS).

/** Already on the reel, with their own hand-written frame. */
const HAS_OWN_FRAME = ['omek-storefront', 'quajo-speaks', 'quaderp-landing'];
const HOW_MANY = 2;

export const latestWork = (studies: any[] | null | undefined): any[] =>
  (studies || [])
    .filter((s) => s?.published === true && s.slug && !HAS_OWN_FRAME.includes(s.slug) && s.coverImage && typeof s.coverImage === 'object')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, HOW_MANY);

/**
 * Where a frame of the home reel's words now sits: the title card stays first,
 * and the latest work goes between it and the rest. The hero's results strip
 * links in by these numbers, so it needs them too.
 */
export const workFrame = (step: number, latestCount: number): number => (step === 0 ? 0 : step + latestCount);
