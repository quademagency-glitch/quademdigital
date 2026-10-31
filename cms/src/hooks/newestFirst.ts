import type { FieldHook } from 'payload'

/*
  New work goes first (Ernest, 31 Oct 2026: "new portfolio projects should always
  get prominence, because they are the latest work"). The site lists case studies
  by Order, lowest first, and an empty Order sorts last, so a new one used to land
  at the bottom. Typing an Order still wins, and later edits leave it alone.
*/
export const newestFirst: FieldHook = async ({ value, operation, req }) => {
  if (operation !== 'create' || typeof value === 'number') return value
  const { docs } = await req.payload.find({
    collection: 'caseStudies',
    sort: 'order',
    where: { order: { exists: true } },
    limit: 1,
    depth: 0,
    req,
  })
  const lowest = docs[0]?.order
  return typeof lowest === 'number' ? lowest - 1 : 0
}
