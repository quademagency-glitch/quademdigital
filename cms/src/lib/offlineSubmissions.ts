import { securityTransaction } from './securityDatabase'
import type { DailyReport } from '../payload-types'
import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, initTransaction, commitTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'

const LEAD_FIELDS = ['businessName', 'name', 'city', 'country', 'niche', 'whatsapp', 'phone', 'email', 'website', 'foundAt', 'qualification', 'message']
type Draft = { id?: string; owner?: string; kind?: string; day?: string; fields?: Record<string, string[]>; updatedAt?: string }
const text = (data: Draft, key: string) => String(data.fields?.[key]?.[0] ?? '').trim().slice(0, 10000)

export async function saveOfflineDraft(req: PayloadRequest, data: Draft) {
  if (!req.user || !['team', 'admin'].includes(req.user.role || '') || req.user.status === 'ended') throw new APIError('Sign in again before sending your draft.', 401)
  if (String(req.user.id) !== data.owner) throw new APIError('This draft belongs to a different account. Sign in to that account to send it.', 403)
  if (!/^[a-f0-9-]{36}$/i.test(data.id ?? '') || !['lead', 'report'].includes(data.kind ?? '')) throw new APIError('This draft is not valid.', 400)
  if (!data.fields || typeof data.fields !== 'object' || Object.values(data.fields).some((v) => !Array.isArray(v) || v.some((x) => typeof x !== 'string')) || JSON.stringify(data.fields).length > 60000) throw new APIError('This draft is not valid or is too large.', 400)
  const key = `${req.user.id}:${data.id}`
  const hash = createHash('sha256').update(JSON.stringify([data.kind, data.day, Object.entries(data.fields).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  const findSaved = async () => (await req.payload.find({ collection: 'offline-submissions', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  const previous = await findSaved()
  if (previous) {
    if (previous.inputHash !== hash) throw new APIError('This draft was already sent with different details. Open the saved record to change it.', 409)
    return { path: previous.path, id: previous.recordId }
  }
  await initTransaction(req)
  try {
    const receipt = await req.payload.create({ collection: 'offline-submissions', data: { key, userId: Number(req.user.id), kind: data.kind!, inputHash: hash }, overrideAccess: true, req })
    let id: number | string
    let path: string
    if (data.kind === 'lead') {
      const body: Record<string, unknown> = Object.fromEntries(LEAD_FIELDS.map((k) => [k, text(data, k) || null]))
      body.source = req.user.role === 'admin' ? text(data, 'source') || 'outreach' : 'outreach'
      body.status = 'new'
      if (!body.businessName || !(body.whatsapp || body.phone || body.email)) throw new APIError('Add a business name and at least one contact method.', 400)
      if (body.source === 'outreach' && (!body.city || !body.country)) throw new APIError('Add the city and country.', 400)
      const lead = await req.payload.create({ collection: 'leads', data: body, overrideAccess: false, req })
      id = lead.id; path = `/leads/${id}`
    } else {
      const today = new Date().toISOString().slice(0, 10) // Accra is UTC throughout the year.
      if (data.day !== today) throw new APIError('This report belongs to an earlier day. Keep the draft and ask Ernest to correct that day; it cannot be sent as today’s report.', 409)
      if (req.user.role !== 'team') throw new APIError('Daily reports are for team members.', 403)
      const labels = data.fields['typed.label'] ?? []
      const values = data.fields['typed.value'] ?? []
      const typed = labels.map((label, i) => ({ label, value: values[i]?.trim() ? Number(values[i]) : null }))
      if (typed.some((t) => t.value !== null && (!Number.isSafeInteger(t.value) || t.value < 0))) throw new APIError('Counts must be whole numbers, zero or above.', 400)
      const niche = text(data, 'niche')
      if (niche && !['events', 'other', 'food', 'beauty', 'health', 'fashion', 'real-estate', 'fitness'].includes(niche)) throw new APIError('Choose a valid type of business.', 400)
      const body = { city: text(data, 'city') || null, niche: (niche || null) as DailyReport['niche'], repliesSummary: text(data, 'repliesSummary') || null, blockers: text(data, 'blockers') || null, typed }
      const reportId = text(data, 'id')
      if (reportId) {
        const transaction = await securityTransaction(req)
        await transaction.execute(sql`SELECT id FROM daily_reports WHERE id = ${Number(reportId)} FOR UPDATE`)
        const existing = await req.payload.findByID({ collection: 'daily-reports', id: reportId, depth: 0, overrideAccess: false, req })
        if (String(typeof existing.user === 'object' ? existing.user?.id : existing.user) !== String(req.user.id)) throw new APIError('This is not your report.', 403)
        if (data.updatedAt && existing.updatedAt !== data.updatedAt) throw new APIError('This report changed on another device. Open it online before applying your draft.', 409)
        const report = await req.payload.update({ collection: 'daily-reports', id: reportId, data: body, overrideAccess: false, req })
        id = report.id
      } else {
        const report = await req.payload.create({ collection: 'daily-reports', data: { ...body, user: req.user.id, date: `${today}T00:00:00.000Z` }, overrideAccess: false, req })
        id = report.id
      }
      path = '/report'
    }
    await req.payload.update({ collection: 'offline-submissions', id: receipt.id, data: { recordId: Number(id), path }, overrideAccess: true, req })
    await commitTransaction(req)
    return { id, path }
  } catch (error) {
    await killTransaction(req)
    const saved = await findSaved()
    if (saved?.inputHash === hash && saved.path) return { id: saved.recordId, path: saved.path }
    throw error
  }
}

export const offlineEndpoints: Endpoint[] = [{ path: '/sync-draft', method: 'post', handler: async (req) => {
  const data = (req.data ?? await req.json?.()) as Draft
  return Response.json(await saveOfflineDraft(req, data), { headers: { 'Cache-Control': 'no-store' } })
} }]
