/**
 * Split a page title into the small lead-in and the one giant word.
 *
 * The inner page heroes print the LAST word of the page title at display size
 * and the rest of it small, directly above. "Featured Work" becomes a small
 * "Featured" sitting over a giant "Work". A one word title prints whole with no
 * lead-in at all.
 *
 * The last word is the right one for every title the site holds today, because
 * they all end on their subject: Featured Work, Get in Touch, Services. The
 * about page is the exception, its CMS title ends on "Digital", so that page
 * passes its own split rather than calling this.
 *
 * The whole title still goes to PageHero as `headline`, so the H1 that a search
 * engine and a screen reader get is the complete sentence either way. This only
 * decides which part of it is printed large.
 */
export function splitHeroTitle(title: string): { lead: string; word: string } {
  const parts = String(title ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return { lead: '', word: '' };
  return { lead: parts.slice(0, -1).join(' '), word: parts[parts.length - 1] };
}
