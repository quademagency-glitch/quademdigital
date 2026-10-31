import assert from 'node:assert/strict'
import { latestWork, workFrame } from '../src/lib/latestWork.ts'
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
