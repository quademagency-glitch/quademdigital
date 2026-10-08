import type { PayloadRequest } from 'payload'
import { dayBounds } from './reportCounts'
import { hasWords } from './reportProof'

/*
  Everything behind one person's day, for checking a report (GET
  /api/daily-reports/work). Read with the CMS's own access, so it is the
  same whoever asks; the endpoint decides who may.
*/

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

type Row = { id?: string; type?: string; kind?: string; direction?: string; at?: string; recordedAt?: string; note?: string; by?: unknown; proof?: unknown }

export async function reportWork(req: PayloadRequest, userId: number, date: string) {
  const { start, end } = dayBounds(`${date}T00:00:00.000Z`)
  const s = start.toISOString()
  const e = end.toISOString()
  // Loosely typed on purpose: five collections, read for a handful of fields each.
  type Doc = Record<string, any> & { id: number | string }
  const find = async (collection: 'leads' | 'comments' | 'work-items' | 'report-excusals' | 'daily-reports', where: Record<string, unknown>, depth = 0) =>
    (await req.payload.find({ collection, where: where as never, limit: 1000, depth, overrideAccess: true, req, pagination: false })) as unknown as { docs: Doc[] }

  const [added, touched, comments, items, excusals, reports] = await Promise.all([
    find('leads', { and: [{ owner: { equals: userId } }, { loggedAt: { greater_than_equal: s } }, { loggedAt: { less_than_equal: e } }] }),
    find('leads', { and: [{ 'activity.recordedAt': { greater_than_equal: s } }, { 'activity.recordedAt': { less_than_equal: e } }] }),
    find('comments', { and: [{ author: { equals: userId } }, { createdAt: { greater_than_equal: s } }, { createdAt: { less_than_equal: e } }] }, 1),
    find('work-items', { and: [{ user: { equals: userId } }, { date: { equals: s } }] }),
    find('report-excusals', { and: [{ user: { equals: userId } }, { date: { equals: s } }] }),
    find('daily-reports', { and: [{ user: { equals: userId } }, { date: { equals: s } }] }),
  ])

  const contacts = touched.docs
    .flatMap((lead) =>
      (((lead as { activity?: Row[] }).activity ?? []) as Row[])
        .filter((r) => String(idOf(r.by)) === String(userId) && r.recordedAt && r.recordedAt >= s && r.recordedAt <= e)
        .map((r) => ({
          lead: { id: lead.id, title: String((lead as { title?: string }).title ?? (lead as { businessName?: string }).businessName ?? `Lead ${lead.id}`) },
          row: r.id ?? null,
          type: r.type ?? 'other',
          kind: r.kind ?? null,
          at: r.at ?? null,
          recordedAt: r.recordedAt!,
          note: r.note ?? null,
          hasWords: hasWords(r.note),
          proof: idOf(r.proof) ?? null,
        })),
    )
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

  const titleOf = (v: unknown, fallback: string) => (v && typeof v === 'object' ? String((v as { title?: string; businessName?: string }).title ?? (v as { businessName?: string }).businessName ?? fallback) : fallback)

  return {
    date,
    report: reports.docs[0] ?? null,
    excusal: excusals.docs.find((x) => x.status !== 'declined') ?? null,
    leadsAdded: added.docs.map((l) => {
      const x = l
      return { id: l.id, title: String(x.title ?? x.businessName ?? `Lead ${l.id}`), city: x.city ?? null, niche: x.niche ?? null, whatsapp: Boolean(x.whatsapp), phone: Boolean(x.phone), email: Boolean(x.email), website: Boolean(x.website), loggedAt: x.loggedAt ?? null }
    }),
    contacts,
    comments: comments.docs.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      on: c.lead ? { kind: 'lead', id: idOf(c.lead), title: titleOf(c.lead, 'a lead') } : c.task ? { kind: 'task', id: idOf(c.task), title: titleOf(c.task, 'a task') } : c.project ? { kind: 'project', id: idOf(c.project), title: titleOf(c.project, 'a project') } : { kind: 'report', id: idOf((c as { report?: unknown }).report), title: 'a report' },
    })),
    items: items.docs.map((i) => ({ id: i.id, count: i.count, text: i.text ?? null, link: i.link ?? null, file: i.filename ? { filename: i.filename, mimeType: i.mimeType ?? null } : null, createdAt: i.createdAt })),
  }
}
