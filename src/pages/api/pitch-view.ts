import type { APIRoute } from 'astro';
import { payloadFetch } from '../../lib/payload';

/**
 * "Have they opened it yet?"
 *
 * The beacon in a served pitch (src/pages/pitch/[...slug].ts) posts here once
 * per browser session. Counting here rather than in the page route itself is
 * deliberate:
 *
 *  - It counts people. A crawler that ignores robots.txt still does not run
 *    JavaScript, so it never arrives here.
 *  - It costs the prospect nothing. The page has already been delivered by the
 *    time this runs, so a slow CMS write cannot delay the thing they came for.
 *  - It does not count you. The "Open it" button in the CMS adds ?preview=1 and
 *    the beacon then does not fire, so checking your own work six times does
 *    not read as six people.
 *
 * What it stores is a count and two timestamps. No address, no browser, no
 * identity, nothing that could be pointed at a person. It is a signal, not a
 * certainty: a forwarded link is somebody else opening it, and a phone with
 * JavaScript off is a read that is never counted.
 */

const json = (status: number) => new Response(null, { status });

export const POST: APIRoute = async ({ url, request }) => {
  const slug = (url.searchParams.get('slug') || '').trim();
  // Bounded and shaped, so this cannot be used to probe the CMS with arbitrary
  // query values.
  if (!slug || slug.length > 200 || !/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(slug)) return json(204);

  // Same-origin only. A beacon is fired by our own page and nothing else has a
  // reason to call this.
  const origin = request.headers.get('origin');
  if (origin && !/^https?:\/\/(quademdigital\.com|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/.test(origin)) {
    return json(204);
  }

  try {
    const pitches = await payloadFetch(
      'pitches',
      { 'where[slug][equals]': slug, limit: '1', depth: '0' },
      { skipCache: true },
    );
    const pitch = pitches[0];
    if (!pitch?.id) return json(204);

    const now = new Date().toISOString();
    const count = Number(pitch.viewCount) || 0;

    const baseUrl =
      import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (import.meta.env.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${import.meta.env.PAYLOAD_API_KEY}`;
    }

    /*
      Read then write, so two people opening the pitch in the same second can
      lose a count. A pitch is sent to one person at a time and the number is
      read as "have they looked", not as an audience measurement, so an atomic
      increment is not worth a custom endpoint on the CMS.
    */
    await fetch(`${baseUrl}/api/pitches/${pitch.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        viewCount: count + 1,
        lastViewedAt: now,
        ...(pitch.firstViewedAt ? {} : { firstViewedAt: now }),
      }),
    });
  } catch {
    // A count is never worth an error in front of a prospect, and nothing on
    // the page is waiting for this answer.
  }

  return json(204);
};
