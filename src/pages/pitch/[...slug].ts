import type { APIRoute } from 'astro';
import { payloadFetch } from '../../lib/payload';

/**
 * Pitch sites: a sample site made for one prospect, served byte for byte from
 * the CMS and kept out of every index.
 *
 * The document lives in the `pitches` collection (cms/src/collections/Pitches.ts).
 * Ernest drops a self-contained .html file there, the CMS keeps its text, and
 * this route hands it over. No commit, no deploy, no route file per prospect,
 * which is what the hand-built Wardrobe Theatre pitch at /wardrobe/ cost.
 *
 * Served raw rather than through a layout, for the same reason /wardrobe/ is:
 * the document was signed off as it stands, and putting it through Astro would
 * scope its styles and change the markup that was approved.
 *
 * A rest parameter, so a pitch with a second page (slug `acme/services`) works
 * without another route. Most are one page.
 *
 * Four things keep these out of search, because any one of them can be missed:
 * `Disallow: /pitch/` in public/robots.txt, the exclusion in
 * src/pages/sitemap.xml.ts, the meta tag injected below, and the X-Robots-Tag
 * header. The header is the one that cannot be defeated by a document with no
 * <head> to inject into.
 */

const ROBOTS = 'noindex, nofollow, noarchive';

/**
 * Counts the open, and nothing else.
 *
 * Fired from the page rather than measured on the server, so it counts people
 * instead of crawlers: anything that ignores robots.txt still does not run
 * JavaScript. Once per browser session rather than once per load, so a
 * prospect who refreshes twice while reading is one open, not three. Silent on
 * ?preview=1, which is what the "Open it" button in the CMS uses, so checking
 * your own work never reads back as interest.
 *
 * keepalive, because the useful case is somebody who opens the page and closes
 * the tab, and a plain fetch is abandoned when they do.
 */
const beacon = (slug: string) => `
<script>
(function () {
  try {
    if (location.search.indexOf('preview=1') !== -1) return;
    var k = 'qd-pitch-seen';
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
    fetch('/api/pitch-view/?slug=' + encodeURIComponent(${JSON.stringify(slug)}), {
      method: 'POST',
      keepalive: true,
    }).catch(function () {});
  } catch (e) {}
})();
</script>`;

/**
 * Put the robots tag in the document's own head.
 *
 * A crawler that ignores robots.txt still reads this, and unlike the header it
 * survives the page being saved and rehosted elsewhere. Inserted directly after
 * <head> so it cannot land after a <base> or a redirect script. A document with
 * no <head> at all gets one; markup that broken renders anyway in every browser
 * and the tag has to go somewhere.
 */
const withNoindex = (html: string): string => {
  const tag = `<meta name="robots" content="${ROBOTS}">`;
  if (/<meta[^>]+name=["']robots["']/i.test(html)) return html;

  const head = html.match(/<head[^>]*>/i);
  if (head) return html.replace(head[0], `${head[0]}\n${tag}`);

  const htmlTag = html.match(/<html[^>]*>/i);
  if (htmlTag) return html.replace(htmlTag[0], `${htmlTag[0]}\n<head>${tag}</head>`);

  return `${tag}\n${html}`;
};

/** Expired at the end of the day named, the same way an offer expires. */
const isExpired = (value: unknown): boolean => {
  if (!value) return false;
  const end = new Date(String(value));
  if (Number.isNaN(end.getTime())) return false;
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
};

export const GET: APIRoute = async ({ params }) => {
  const slug = String(params.slug ?? '').replace(/\/+$/, '');
  if (!slug) return new Response(null, { status: 404 });

  /*
    skipCache: a pitch is edited and reloaded, edited and reloaded, usually
    minutes before it is sent. Serving the 60s-memoised copy would show the
    previous version and read as "my change did not save".
  */
  const pitches = await payloadFetch(
    'pitches',
    { 'where[slug][equals]': slug, limit: '1', depth: '0' },
    { skipCache: true },
  );
  const pitch = pitches[0];

  // 404 rather than 403 for every refusal, including a pitch switched off or
  // expired: a distinct response would confirm which prospects exist.
  if (!pitch?.html || pitch.live === false || isExpired(pitch.expiresAt)) {
    return new Response(null, { status: 404 });
  }

  /*
    The beacon goes after the document rather than inside <head>, so it cannot
    delay anything the prospect is waiting to see. Appending to the string is
    valid in every browser: markup after </html> is parsed into the body.
  */
  const body = withNoindex(String(pitch.html)) + beacon(slug);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': ROBOTS,
      // src/middleware.ts also marks /pitch as never-cache. Repeated here
      // because this response is the one that matters: an edge copy of a
      // withdrawn pitch would outlive the switch that withdrew it.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
