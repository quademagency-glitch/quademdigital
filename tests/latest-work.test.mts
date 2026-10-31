import assert from 'node:assert/strict'
import { hostOf, latestResults, latestWork, newestSite, newestSiteVisual, shortResult, workFrame } from '../src/lib/latestWork.ts'
import { newestFirst } from '../cms/src/hooks/newestFirst.ts'

// New work gets the prominence, without anyone having to remember to arrange it.
const study = (slug: string, createdAt: string, extra = {}) => ({ slug, createdAt, published: true, coverImage: { url: '/x.webp' }, ...extra })
const names = (list: any[]) => list.map((s) => s.slug)

// Newest first, two of them, whatever order they arrive in.
assert.deepEqual(
  names(latestWork([study('san', '2026-07-31'), study('tannor', '2026-10-29'), study('ads', '2026-10-28'), study('quadbrand', '2026-07-30')])),
  ['tannor', 'ads'],
)
// A project with its own hand-written frame on the reel is not shown twice.
assert.deepEqual(names(latestWork([study('omek-storefront', '2026-12-01'), study('tannor', '2026-10-29')])), ['tannor'])
// Unpublished, or nothing to show, stays out.
assert.deepEqual(names(latestWork([study('draft', '2026-12-01', { published: false }), study('bare', '2026-12-01', { coverImage: 12 })])), [])
assert.deepEqual(latestWork(null), [])

// The hero strip's links follow their frames, and the title card stays first.
assert.equal(workFrame(0, 2), 0)
assert.equal(workFrame(1, 2), 3)
assert.equal(workFrame(6, 2), 8)
assert.equal(workFrame(4, 0), 4)

// A new case study with no Order goes above the lowest one there is.
const run = (args: Record<string, unknown>, lowest: number | null = -2) =>
  (newestFirst as any)({ req: { payload: { find: async () => ({ docs: lowest === null ? [] : [{ order: lowest }] }) } }, ...args })
assert.equal(await run({ operation: 'create', value: undefined }), -3)
assert.equal(await run({ operation: 'create', value: null }), -3)
// The first one ever starts the list.
assert.equal(await run({ operation: 'create', value: undefined }, null), 0)
// Typing an Order wins, including zero.
assert.equal(await run({ operation: 'create', value: 7 }), 7)
assert.equal(await run({ operation: 'create', value: 0 }), 0)
// Editing an old project never moves it.
assert.equal(await run({ operation: 'update', value: undefined }), undefined)
assert.equal(await run({ operation: 'update', value: null }), null)

console.log('latest-work: ok')

// The newest finished website is the one shown on a screen, whatever its Order.
const web = (slug: string, createdAt: string, extra = {}) => study(slug, createdAt, { coverImage: { url: `/${slug}.webp` }, showUnderServices: ['web-design'], ...extra })
assert.equal(newestSite([web('old', '2026-07-31'), web('tannor', '2026-10-29'), study('ads', '2026-11-01', { showUnderServices: ['digital-marketing'] })])?.slug, 'tannor')
// A build still in progress waits its turn; a draft stays out.
assert.equal(newestSite([web('tannor', '2026-10-29'), web('san', '2026-12-01', { resultText: 'Products live, build in progress' }), web('draft', '2026-12-02', { published: false })])?.slug, 'tannor')
assert.equal(newestSite(null), null)

// The hero strip: newest first, its short wording, opening its own reel frame.
const results = latestResults([
  study('ads', '2026-10-28', { title: 'Omek Google Ads', resultMetric: 'GH₵7,635', resultText: 'Confirmed online orders in one week, from GH₵381 of ad spend' }),
  study('tannor', '2026-10-29', { title: 'Tannor Freight', resultMetric: '97', resultText: "Google PageSpeed on a phone, with an admin Tannor's team runs themselves" }),
])
assert.deepEqual(results, [
  { value: '97', label: 'Tannor Freight · Google PageSpeed on a phone', frame: 1 },
  { value: 'GH₵7,635', label: 'Omek Google Ads · Confirmed online orders in one week', frame: 2 },
])
// A project with no figure is skipped, and the next keeps its true frame.
assert.deepEqual(latestResults([study('new', '2026-11-02', { title: 'New' }), study('tannor', '2026-10-29', { title: 'T', resultMetric: '97' })]), [{ value: '97', label: 'T', frame: 2 }])
assert.equal(shortResult('One, two'), 'One')

// A new project with no known address still labels its browser window.
assert.equal(hostOf({ slug: 'tannor-freight', title: 'Tannor Freight' }), 'tannorfreight.com')
assert.equal(hostOf({ slug: 'brand-new', title: 'Brand New' }), 'Brand New')

// The Services and Global picture falls back when there is no website to show.
const fallback = { url: '/mock.webp' }
assert.equal(newestSiteVisual([], fallback), fallback)
const visual = newestSiteVisual([web('tannor', '2026-10-29', { title: 'Tannor Freight', projectType: 'client' })], fallback)
assert.equal(visual.url, '/tannor.webp')
assert.equal(visual.caption, 'Tannor Freight · Client project')
