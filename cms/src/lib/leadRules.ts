import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, Endpoint, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../access/roles'
import { audit } from './audit'
import { enquiryNotice, isInbound } from './enquiries'
import { adminIds, notify } from './notify'
import { handoverEmail } from './teamEmails'
import { addWorkingDays, todayStart } from './workingDays'
import { nextGap, workRules, type WorkRules } from './workRules'
import { hasWords, logProblem, ruleForType, type ReportCountRule } from './reportProof'

/**
 * The rules of the pipeline (spec 4.2). They live here, in the CMS, so they hold
 * however a lead is touched: the team portal, the admin, the website or an
 * import.
 *
 * - Who found a lead (`owner`) and when (`loggedAt`) are set by the server and
 *   decide who sourced the deal. Nobody edits `loggedAt`, not even an admin.
 * - Who works it (`assignedTo`) changes only through the handover endpoint.
 * - Contact history rows are stamped with who wrote them and when they were
 *   written (`by`, `recordedAt`). Daily reports count `recordedAt`, so a
 *   back-dated row can never inflate a report. A team member can add rows but
 *   never change or remove one already there.
 * - Follow-up dates follow the handbook: 2, 5 and 10 working days (or the gaps in Settings), then No
 *   response. A reply stops the chase.
 * - Only an admin marks a lead Won or Lost.
 * - The same business cannot be logged twice.
 */

type Row = {
  id?: string | null
  at?: string | null
  kind?: string | null
  direction?: 'out' | 'in' | null
  type?: string | null
  note?: string | null
  by?: unknown
  recordedAt?: string | null
  proof?: unknown
}
type LeadData = Record<string, any>

/** A screenshot offered as proof: a file on this lead that this person added. Its id, or null. */
async function proofDocument(req: PayloadRequest, value: unknown, leadId: number): Promise<number | null> {
  const doc = await req.payload.findByID({ collection: 'documents', id: Number(value), depth: 0, overrideAccess: true, req }).catch(() => null)
  if (!doc || String(idOf(doc.lead)) !== String(leadId)) return null
  if (!hasRole(req.user, 'admin') && String(idOf(doc.uploadedBy)) !== String(req.user?.id)) return null
  return Number(doc.id)
}

const ACTIVE_CHASE = ['new', 'contacted', 'no-response']

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
/** The last nine digits, so +234 803 123 4567 and 0803 123 4567 match, as do Ghana's. */
export const phoneKey = (s: unknown) => {
  const d = digits(s)
  return d.length >= 7 ? d.slice(-9) : null
}
export const websiteKey = (s: unknown) => {
  const raw = String(s ?? '').trim().toLowerCase()
  if (!raw) return null
  const host = raw.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return host || null
}
const words = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export const nameCityKey = (name: unknown, city: unknown) => (words(name) && words(city) ? `${words(name)}|${words(city)}` : null)

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v) ?? null
const day = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Accra' }).format(new Date(iso)) : 'an earlier date'

/** Why a new lead is the same as an old one, in words that suit the person asking. */
export async function findDuplicate(req: PayloadRequest, lead: LeadData): Promise<string | null> {
  const or: Where[] = []
  for (const k of [lead.phoneKey, lead.whatsappKey].filter(Boolean)) or.push({ phoneKey: { equals: k } }, { whatsappKey: { equals: k } })
  if (lead.email) or.push({ email: { equals: lead.email } })
  if (lead.websiteKey) or.push({ websiteKey: { equals: lead.websiteKey } })
  if (lead.nameCityKey) or.push({ nameCityKey: { equals: lead.nameCityKey } })
  if (!or.length) return null
  const where: Where = lead.id ? { and: [{ or }, { id: { not_equals: lead.id } }] } : { or }
  const found = await req.payload.find({ collection: 'leads', where, limit: 1, depth: 1, overrideAccess: true, req })
  const other = found.docs[0] as LeadData | undefined
  if (!other) return null
  const when = day(other.loggedAt || other.createdAt)
  const owner = other.owner && typeof other.owner === 'object' ? (other.owner as { id: unknown; role?: string; name?: string; email?: string }) : null
  const user = req.user as { id: unknown; role?: string } | null
  if (hasRole(user, 'team')) {
    if (owner && owner.id === user?.id) return `You logged this one on ${when}. Open it from your leads.`
    if (owner && owner.role === 'team') return `Already logged on ${when}.`
    return `Already in Quadem's pipeline since ${when}. Ask Ernest if he can hand it to you.`
  }
  return `Already a lead: ${other.title || other.businessName || other.name || `lead ${other.id}`}, logged ${when}${owner ? ` by ${owner.name || owner.email}` : ' from the website or an import'}.`
}

/** What stops a lead a person or an import adds being saved, in words; null when nothing does. */
export function leadProblem(lead: LeadData): string | null {
  if (!lead.email && !lead.phone && !lead.whatsapp) return 'Add a phone number, a WhatsApp number or an email, so the lead can be reached.'
  if (!lead.businessName && !lead.name) return 'Add the business name or a contact name.'
  if (lead.source === 'outreach' && (!lead.businessName || !lead.city || !lead.country)) return 'A lead you found needs the business name, the city and the country.'
  return null
}

/** Fill the computed fields and the follow-up date from the contact history. */
function applyHistory(data: LeadData, original: LeadData | undefined, fresh: Row[], rules: WorkRules) {
  const rows: Row[] = Array.isArray(data.activity) ? data.activity : Array.isArray(original?.activity) ? original.activity : []
  const outbound = rows.filter((r) => r.type === 'first-message' || r.type === 'follow-up')
  const times = (list: Row[]) => list.map((r) => r.at).filter(Boolean).sort() as string[]
  data.firstContactedAt = times(outbound)[0] ?? null
  data.lastContactAt = times(rows.filter((r) => r.direction)).pop() ?? null
  data.followUpCount = rows.filter((r) => r.type === 'follow-up').length

  if (!fresh.length) return
  const userSetDate = 'nextFollowUp' in data && String(data.nextFollowUp ?? '') !== String(original?.nextFollowUp ?? '')
  const status = data.status ?? original?.status ?? 'new'

  if (fresh.some((r) => r.direction === 'in' || r.type === 'reply')) {
    if (ACTIVE_CHASE.includes(status)) data.status = 'replied'
    if (!userSetDate) data.nextFollowUp = null
    return
  }
  if (!ACTIVE_CHASE.includes(status)) return
  const latest = [...fresh].filter((r) => r.type === 'first-message' || r.type === 'follow-up').sort((a, b) => String(a.at).localeCompare(String(b.at))).pop()
  if (!latest) return
  if (latest.type === 'first-message') {
    if (status === 'new' || status === 'no-response') data.status = 'contacted'
    if (!userSetDate) data.nextFollowUp = addWorkingDays(latest.at ?? new Date(), nextGap(rules, 0) ?? 2)
    return
  }
  // The gaps Ernest sets (spec 14.9): 2, 5, then 10 working days unless he changes them; after the last, No response.
  const gap = nextGap(rules, data.followUpCount)
  if (gap === null) {
    data.status = 'no-response'
    if (!userSetDate) data.nextFollowUp = null
  } else {
    data.status = 'contacted'
    if (!userSetDate) data.nextFollowUp = addWorkingDays(latest.at ?? new Date(), gap)
  }
}

export const leadBeforeChange: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req, context }) => {
  const user = req.user as { id: number; role?: string } | null
  const team = hasRole(user, 'team')
  const admin = hasRole(user, 'admin')
  const handover = context?.handover === true
  const now = new Date().toISOString()
  const original = originalDoc as LeadData | undefined

  if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase() || null
  const merged: LeadData = { ...(original ?? {}), ...data }

  data.title = merged.businessName || merged.name || merged.email || merged.phone || merged.whatsapp || 'Lead'
  data.phoneKey = phoneKey(merged.phone)
  data.whatsappKey = phoneKey(merged.whatsapp)
  data.websiteKey = websiteKey(merged.website)
  data.nameCityKey = nameCityKey(merged.businessName, merged.city)

  // Checked for people and imports only. The website's forms create leads
  // without signing in, some with an email and nothing else, and a rule that
  // refused those would lose enquiries silently: the notification email still
  // goes out, so nobody would notice (that happened once with a bad source).
  if (hasRole(user, 'team', 'admin', 'integration')) {
    const problem = leadProblem(merged)
    if (problem) throw new APIError(problem, 400)
  }

  if (operation === 'create') {
    data.loggedAt = now
    if (team) {
      data.owner = user!.id
      data.assignedTo = user!.id
      if (!data.source) data.source = 'outreach'
      if (data.status === 'won' || data.status === 'lost') data.status = 'new'
    } else if (admin) {
      data.owner = idOf(data.owner) ?? user!.id
      data.assignedTo = idOf(data.assignedTo) ?? data.owner
    } else {
      // The website, an import or a visitor: the lead is Quadem's own until handed over.
      data.owner = null
      data.assignedTo = null
    }
    data.assignedAt = data.assignedTo ? now : null
    data.ownerChangeReason = null
    if (hasRole(user, 'team', 'admin', 'integration')) {
      const dup = await findDuplicate(req, data)
      if (dup) throw new APIError(dup, 409)
    }
  } else {
    data.loggedAt = original?.loggedAt ?? null
    const keep = (field: string) => {
      data[field] = original?.[field] ?? null
    }
    if (!admin) {
      for (const f of ['owner', 'ownerChangeReason', 'convertedClient']) keep(f)
    } else if (String(idOf(data.owner) ?? '') !== String(idOf(original?.owner) ?? '') && 'owner' in data) {
      // Who found it decides who sourced the deal, so a change must say why.
      if (!String(data.ownerChangeReason ?? '').trim() || data.ownerChangeReason === original?.ownerChangeReason) {
        throw new APIError('Changing who found a lead needs a reason. It is kept in the lead history.', 400)
      }
    }
    // `system` is set only by server code (an agreement ending overnight), never over REST.
    if (!((admin || context?.system === true) && handover)) {
      keep('assignedTo')
      keep('assignedAt')
    }
    if (!admin && ['won', 'lost'].includes(data.status) && data.status !== original?.status) {
      throw new APIError('Only Ernest can mark a lead Won or Lost.', 403)
    }
  }

  // Contact history: stamp new rows, protect the old ones.
  let fresh: Row[] = []
  if (Array.isArray(data.activity)) {
    const before: Row[] = Array.isArray(original?.activity) ? original.activity : []
    const byId = new Map(before.filter((r) => r.id).map((r) => [String(r.id), r]))
    const rows = (data.activity as Row[]).map((r) => {
      const old = r.id ? byId.get(String(r.id)) : undefined
      if (old) {
        const fill = context?.fillProof as { row: string; note?: string; proof?: number } | undefined
        if (fill && String(old.id) === fill.row) return { ...old, ...(fill.note ? { note: fill.note } : {}), ...(fill.proof ? { proof: fill.proof } : {}) }
        return team ? old : { ...r, by: old.by ?? null, recordedAt: old.recordedAt ?? null }
      }
      const row: Row = {
        ...r,
        at: r.at || now,
        recordedAt: now,
        by: context?.system ? null : (idOf(r.by) && admin ? idOf(r.by) : (user?.id ?? null)),
      }
      if (!row.direction) row.direction = row.type === 'reply' ? 'in' : row.kind === 'note' || row.type === 'other' ? null : 'out'
      fresh.push(row)
      return row
    })
    if (team) {
      const kept = new Set(rows.map((r) => String(r.id ?? '')))
      for (const old of before) if (!kept.has(String(old.id))) rows.push(old)
      const loggedAt = data.loggedAt ?? original?.loggedAt ?? now
      for (const r of fresh) {
        const at = new Date(r.at!).getTime()
        if (at > Date.now() + 5 * 60_000) throw new APIError('A contact cannot be in the future. Check the date and time.', 400)
        if (at < new Date(loggedAt).getTime() - 60_000) throw new APIError(`A contact cannot be before the lead was logged (${day(loggedAt)}).`, 400)
      }
    }
    data.activity = rows
  }
  fresh = fresh.filter(Boolean)
  applyHistory(data, original, fresh, await workRules(req))
  return data
}

/** A lead moving to "They want a price" is a quote for Ernest to price (section 7). */
export const leadAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  // A new enquiry (a website form, WhatsApp, a referral): Ernest hears at once in the portal and on
  // his phone. The website already emails him, so this notice sends no email of its own, and a
  // notice that fails never stops the enquiry being saved.
  if (operation === 'create' && isInbound(doc.source) && !idOf(doc.owner)) {
    try {
      const n = enquiryNotice(doc)
      await notify(req, { to: await adminIds(req), kind: 'enquiry', title: n.title, body: n.body, link: `/leads/${doc.id}`, key: `enquiry:${doc.id}`, email: false, action: 'Open the enquiry' })
    } catch (err) {
      req.payload.logger.error({ err, lead: doc.id }, 'The new-enquiry notice could not be sent')
    }
  }
  if (operation === 'update' && previousDoc) {
    const name = doc.title || doc.businessName || `Lead ${doc.id}`
    if (String(idOf(doc.owner) ?? '') !== String(idOf(previousDoc.owner) ?? '')) {
      const nameOf = async (v: unknown) => {
        const id = idOf(v)
        if (!id) return 'Quadem'
        const u = await req.payload.findByID({ collection: 'users', id: Number(id), depth: 0, overrideAccess: true, req }).catch(() => null)
        return u?.name || u?.email || `User ${id}`
      }
      await audit(req, {
        action: 'lead.owner-changed',
        summary: `Who found ${name} was changed`,
        person: (idOf(doc.owner) ?? idOf(previousDoc.owner)) as number,
        subjectType: 'leads',
        subjectId: doc.id,
        reason: doc.ownerChangeReason,
        changes: [{ field: 'Found by', from: await nameOf(previousDoc.owner), to: await nameOf(doc.owner) }],
      })
    }
    if ((doc.status === 'won' || doc.status === 'lost') && doc.status !== previousDoc.status) {
      await audit(req, {
        action: `lead.${doc.status}`,
        summary: `${name} marked ${doc.status === 'won' ? 'Won' : 'Lost'}`,
        person: idOf(doc.assignedTo) as number,
        subjectType: 'leads',
        subjectId: doc.id,
        changes: [{ field: 'Status', from: previousDoc.status, to: doc.status }],
      })
    }
  }
  if (operation === 'update' && doc.status === 'proposal-requested' && previousDoc?.status !== 'proposal-requested') {
    const by = req.user as { name?: string; email?: string } | null
    await notify(req, {
      to: await adminIds(req),
      kind: 'quote-request',
      title: `Price wanted: ${doc.title || doc.businessName || 'a lead'}`,
      body: `${by?.name || by?.email || 'The team'} says they want a price.`,
      link: `/leads/${doc.id}`,
      key: `quote-request:${doc.id}:${new Date().toISOString().slice(0, 10)}`,
      action: 'Open the lead',
    })
  }
  return doc
}

/** What an import may set on a lead: what a person types, never who owns it, who works it or its status. */
const IMPORT_FIELDS = ['businessName', 'name', 'city', 'country', 'niche', 'qualification', 'whatsapp', 'phone', 'email', 'website', 'foundAt', 'message'] as const
/** Where Ernest's imported leads can say they came from; a team member's are always their own prospecting. */
const IMPORT_SOURCES = ['outreach', 'daily-briefing', 'referral', 'whatsapp', 'other']
const IMPORT_CHECK_LIMIT = 100
const IMPORT_SAVE_LIMIT = 25
const TEAM_DAILY_LEADS = 300

const leadIds = (v: unknown) => (Array.isArray(v) ? v : [v]).map((x) => Number(x)).filter((n) => Number.isSafeInteger(n) && n > 0)

export const leadEndpoints: Endpoint[] = [
  {
    /*
      Add one row to a lead's contact history. The portal uses this rather than
      sending the whole history back, so two quick saves cannot overwrite each
      other, and the rules above decide the follow-up date.
    */
    path: '/:id/log',
    method: 'post',
    handler: async (req) => {
      if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
      const id = Number(req.routeParams?.id)
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
      const lead = await req.payload
        .findByID({ collection: 'leads', id, depth: 0, overrideAccess: false, user: req.user, req })
        .catch(() => null)
      if (!lead) return Response.json({ error: 'That lead is not there, or it is not yours.' }, { status: 404 })
      const types = ['first-message', 'follow-up', 'reply', 'call', 'proposal-sent', 'other']
      if (!types.includes(body.type)) return Response.json({ error: 'Say what happened: first message, follow-up, reply, call, proposal sent or other.' }, { status: 400 })
      const row: Row = {
        at: body.at || new Date().toISOString(),
        kind: body.kind || 'whatsapp',
        type: body.type,
        direction: body.type === 'reply' ? 'in' : body.direction || null,
        note: String(body.note || '').trim() || null,
      }
      // The proof the person's job role asks for (lib/reportProof.ts): the words, and a screenshot where needed.
      if (hasRole(req.user, 'team')) {
        const me = await req.payload.findByID({ collection: 'users', id: req.user.id, depth: 1, overrideAccess: true, req }).catch(() => null)
        const counts = (me?.jobRole && typeof me.jobRole === 'object' ? (me.jobRole as { reportCounts?: ReportCountRule[] }).reportCounts : null) ?? null
        const problem = logProblem(ruleForType(counts, body.type), body.type, row.note, body.proof)
        if (problem) return Response.json({ error: problem }, { status: 400 })
      }
      if (body.proof) {
        const shot = await proofDocument(req, body.proof, id)
        if (!shot) return Response.json({ error: 'That screenshot is not there. Add it again.' }, { status: 400 })
        row.proof = shot
      }
      if (!row.note) {
        const labels: Record<string, string> = {
          'first-message': 'First message sent',
          'follow-up': 'Follow-up sent',
          reply: 'They replied',
          call: 'Call',
          'proposal-sent': 'Proposal sent',
          other: 'Note',
        }
        row.note = labels[row.type!]
      }
      const data: Record<string, unknown> = { activity: [...((lead.activity as Row[]) ?? []), row] }
      if (body.nextFollowUp !== undefined) data.nextFollowUp = body.nextFollowUp || null
      if (body.status) data.status = body.status
      try {
        const doc = await req.payload.update({ collection: 'leads', id, data, overrideAccess: false, user: req.user, req })
        return Response.json({ doc })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'That could not be saved.'
        return Response.json({ error: message }, { status: (err as { status?: number })?.status ?? 400 })
      }
    },
  },
  {
    /*
      Fill in the proof a contact record is missing: the words, where it only
      says "First message sent", or a screenshot. Only the person who recorded
      it, only blanks, and nothing else about the record changes.
    */
    path: '/:id/proof',
    method: 'post',
    handler: async (req) => {
      if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
      const id = Number(req.routeParams?.id)
      const body = ((await req.json?.().catch(() => null)) ?? {}) as { row?: string; note?: string; proof?: number }
      const lead = await req.payload.findByID({ collection: 'leads', id, depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)
      if (!lead) return Response.json({ error: 'That lead is not there, or it is not yours.' }, { status: 404 })
      const row = ((lead.activity as Row[]) ?? []).find((r) => String(r.id) === String(body.row))
      if (!row) return Response.json({ error: 'That record is not on this lead.' }, { status: 404 })
      if (String(idOf(row.by)) !== String(req.user.id)) return Response.json({ error: 'Only the person who recorded it can add to it.' }, { status: 403 })
      const note = String(body.note ?? '').trim()
      const fill: { row: string; note?: string; proof?: number } = { row: String(row.id) }
      if (note) {
        if (hasWords(row.note)) return Response.json({ error: 'It already has the words. Ask Ernest if they need changing.' }, { status: 409 })
        if (!hasWords(note)) return Response.json({ error: 'Paste the words that were sent or received.' }, { status: 400 })
        fill.note = note
      }
      if (body.proof) {
        if (row.proof) return Response.json({ error: 'It already has a screenshot.' }, { status: 409 })
        const shot = await proofDocument(req, body.proof, id)
        if (!shot) return Response.json({ error: 'That screenshot is not there. Add it again.' }, { status: 400 })
        fill.proof = shot
      }
      if (!fill.note && !fill.proof) return Response.json({ error: 'Add the words or a screenshot.' }, { status: 400 })
      await req.payload.update({ collection: 'leads', id, data: { activity: lead.activity } as never, overrideAccess: true, req, context: { fillProof: fill } })
      return Response.json({ ok: true })
    },
  },
  {
    /*
      "Is this already a lead?" before saving, so the Add lead form can warn as
      the person types. Answers in the same words the create would.
    */
    path: '/check-duplicate',
    method: 'get',
    handler: async (req) => {
      if (!hasRole(req.user, 'team', 'admin')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
      const q = (k: string) => (req.searchParams?.get(k) ?? '').trim()
      const probe: LeadData = {
        email: q('email').toLowerCase() || null,
        phoneKey: phoneKey(q('phone')),
        whatsappKey: phoneKey(q('whatsapp')),
        websiteKey: websiteKey(q('website')),
        nameCityKey: nameCityKey(q('businessName'), q('city')),
      }
      return Response.json({ duplicate: await findDuplicate(req, probe) })
    },
  },
  {
    /*
      Hand leads to a team member (spec 4.2, rule 7). Only Quadem's own leads
      can be handed over, never one a team member found. Each lead gets a
      history row, which is the written record the agreement asks for, and the
      member gets one email listing what arrived.
    */
    path: '/handover',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only an admin can hand over leads.' }, { status: req.user ? 403 : 401 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
      const ids = leadIds(body.ids)
      const to = await req.payload.findByID({ collection: 'users', id: Number(body.to), depth: 0, overrideAccess: true, req }).catch(() => null)
      if (!to || to.role !== 'team' || to.status === 'ended') return Response.json({ error: 'Choose a team member who is still on the team.' }, { status: 400 })
      if (!ids.length) return Response.json({ error: 'Choose at least one lead.' }, { status: 400 })
      const admin = req.user as { id: number; name?: string; email?: string }
      const done: unknown[] = []
      const refused: { id: number; reason: string }[] = []
      for (const id of ids) {
        const lead = await req.payload.findByID({ collection: 'leads', id, depth: 1, overrideAccess: true, req }).catch(() => null)
        if (!lead) {
          refused.push({ id, reason: 'not found' })
          continue
        }
        const owner = lead.owner && typeof lead.owner === 'object' ? (lead.owner as { role?: string }) : null
        if (owner && owner.role === 'team') {
          refused.push({ id, reason: 'found by a team member' })
          continue
        }
        if (['won', 'lost'].includes(String(lead.status))) {
          refused.push({ id, reason: `already ${lead.status}` })
          continue
        }
        const rows = ((lead.activity as Row[]) ?? []).map((r) => ({ ...r, by: idOf(r.by) }))
        await req.payload.update({
          collection: 'leads',
          id,
          data: {
            assignedTo: to.id,
            assignedAt: new Date().toISOString(),
            activity: [...rows, { at: new Date().toISOString(), kind: 'note', type: 'other', note: `Handed to ${to.name || to.email} by ${admin.name || 'Ernest'}` }],
          } as never,
          context: { handover: true },
          overrideAccess: true,
          user: req.user,
          req,
        })
        done.push(lead.title || lead.businessName || lead.name || `Lead ${id}`)
        await audit(req, {
          action: 'lead.handover',
          summary: `${lead.title || `Lead ${id}`} handed to ${to.name || to.email}`,
          person: to.id,
          subjectType: 'leads',
          subjectId: id,
          changes: [
            {
              field: 'Worked by',
              from: lead.assignedTo && typeof lead.assignedTo === 'object' ? (lead.assignedTo as { name?: string; email?: string }).name || (lead.assignedTo as { email?: string }).email : 'Nobody',
              to: to.name || to.email,
            },
          ],
        })
      }
      if (done.length) {
        await notify(req, {
          to: [to.id],
          kind: 'handover',
          title: `${admin.name || 'Ernest'} handed you ${done.length === 1 ? 'a lead' : `${done.length} leads`}`,
          body: done.map(String).join('\n'),
          link: '/leads?show=given',
          email: false, // the handover email below lists them
        })
        const message = handoverEmail({ name: to.name, from: admin.name || 'Ernest', leads: done.map(String) })
        await req.payload.sendEmail({ to: to.email, subject: message.subject, html: message.html }).catch((err) => req.payload.logger.error({ err }, 'Handover email failed'))
      }
      return Response.json({ handedOver: done.length, refused })
    },
  },
  {
    /* Take handed-over leads back to Quadem, until a deal on them is accepted. */
    path: '/take-back',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only an admin can take leads back.' }, { status: req.user ? 403 : 401 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
      const admin = req.user as { id: number; name?: string }
      let taken = 0
      for (const id of leadIds(body.ids)) {
        const lead = await req.payload.findByID({ collection: 'leads', id, depth: 1, overrideAccess: true, req }).catch(() => null)
        if (!lead || ['won', 'lost'].includes(String(lead.status))) continue
        const owner = lead.owner && typeof lead.owner === 'object' ? (lead.owner as { id: number; role?: string }) : null
        if (owner?.role === 'team') continue
        const rows = ((lead.activity as Row[]) ?? []).map((r) => ({ ...r, by: idOf(r.by) }))
        await req.payload.update({
          collection: 'leads',
          id,
          data: {
            assignedTo: owner?.id ?? null,
            assignedAt: owner ? new Date().toISOString() : null,
            activity: [...rows, { at: new Date().toISOString(), kind: 'note', type: 'other', note: `Taken back by ${admin.name || 'Ernest'}` }],
          } as never,
          context: { handover: true },
          overrideAccess: true,
          user: req.user,
          req,
        })
        taken += 1
        await audit(req, {
          action: 'lead.taken-back',
          summary: `${lead.title || `Lead ${id}`} taken back`,
          person: idOf(lead.assignedTo) as number,
          subjectType: 'leads',
          subjectId: id,
        })
      }
      return Response.json({ takenBack: taken })
    },
  },
  {
    /*
      The founder works a lead himself, as a team member would, without handing
      it to anyone: he becomes who is working it, so its follow-ups, replies and
      a pitch being opened come to him. Quadem's own leads only, never one a
      team member found, and not one a team member is working (take it back
      first). The owner stays as it is, so an enquiry still says it came from
      the website.
    */
    path: '/claim',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only an admin can work a lead this way.' }, { status: req.user ? 403 : 401 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
      const ids = leadIds(body.ids)
      if (!ids.length) return Response.json({ error: 'Choose at least one lead.' }, { status: 400 })
      const admin = req.user as { id: number; name?: string }
      let claimed = 0
      const refused: { id: number; reason: string }[] = []
      for (const id of ids) {
        const lead = await req.payload.findByID({ collection: 'leads', id, depth: 1, overrideAccess: true, req }).catch(() => null)
        if (!lead) {
          refused.push({ id, reason: 'not found' })
          continue
        }
        const owner = lead.owner && typeof lead.owner === 'object' ? (lead.owner as { role?: string }) : null
        const worker = lead.assignedTo && typeof lead.assignedTo === 'object' ? (lead.assignedTo as { id: number; role?: string; name?: string; email?: string }) : null
        if (owner?.role === 'team') {
          refused.push({ id, reason: 'found by a team member' })
          continue
        }
        if (['won', 'lost'].includes(String(lead.status))) {
          refused.push({ id, reason: `already ${lead.status}` })
          continue
        }
        if (worker && String(worker.id) === String(admin.id)) continue
        if (worker?.role === 'team') {
          refused.push({ id, reason: `${worker.name || worker.email || 'a team member'} is working it: take it back first` })
          continue
        }
        const rows = ((lead.activity as Row[]) ?? []).map((r) => ({ ...r, by: idOf(r.by) }))
        await req.payload.update({
          collection: 'leads',
          id,
          data: {
            assignedTo: admin.id,
            assignedAt: new Date().toISOString(),
            activity: [...rows, { at: new Date().toISOString(), kind: 'note', type: 'other', note: `${admin.name || 'Ernest'} is working this himself` }],
          } as never,
          context: { handover: true },
          overrideAccess: true,
          user: req.user,
          req,
        })
        claimed += 1
        await audit(req, {
          action: 'lead.claimed',
          summary: `${lead.title || `Lead ${id}`}: ${admin.name || 'Ernest'} is working it himself`,
          person: admin.id,
          subjectType: 'leads',
          subjectId: id,
          changes: [{ field: 'Worked by', from: worker ? worker.name || worker.email : 'Nobody', to: admin.name || 'Ernest' }],
        })
      }
      return Response.json({ claimed, refused })
    },
  },
  {
    /*
      Leads from a spreadsheet, for anyone who can add a lead: each row goes
      through the same create as adding one by hand, so the uploader owns and
      works what they upload, and the same checks and duplicate test apply.
      Only the fields a person types are taken (never who owns it, who works
      it or its status). A dry run checks without saving; a real run takes a
      chunk at a time, each row saved on its own so one refusal never undoes
      the rows before it.
    */
    path: '/import',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'team', 'admin')) return Response.json({ error: 'Only the team can add leads.' }, { status: req.user ? 403 : 401 })
      const user = req.user as { id: number; role?: string }
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
      const rows: unknown[] = Array.isArray(body.rows) ? body.rows : []
      const dryRun = body.dryRun === true
      const limit = dryRun ? IMPORT_CHECK_LIMIT : IMPORT_SAVE_LIMIT
      if (!rows.length) return Response.json({ error: 'There are no leads in that.' }, { status: 400 })
      if (rows.length > limit) return Response.json({ error: dryRun ? `Up to ${limit} leads a file.` : `Up to ${limit} leads at a time.` }, { status: 400 })
      const team = hasRole(user, 'team')
      const source = !team && IMPORT_SOURCES.includes(body.source) ? String(body.source) : 'outreach'

      // A team member's day has a ceiling, so an import cannot be used to sweep the whole pipeline.
      if (team && !dryRun) {
        const today = await req.payload.count({ collection: 'leads', where: { and: [{ owner: { equals: user.id } }, { loggedAt: { greater_than_equal: todayStart() } }] }, overrideAccess: true, req })
        if (today.totalDocs + rows.length > TEAM_DAILY_LEADS) {
          return Response.json({ error: `That would be more than ${TEAM_DAILY_LEADS} leads in a day. Add the rest tomorrow.` }, { status: 429 })
        }
      }

      const options = (name: string) => {
        const flat = (fields: any[]): any[] => fields.flatMap((f) => [f, ...(Array.isArray(f.fields) ? flat(f.fields) : []), ...(Array.isArray(f.tabs) ? f.tabs.flatMap((t: any) => flat(t.fields ?? [])) : [])])
        const field = flat(req.payload.collections.leads.config.fields as any[]).find((f) => f.name === name)
        return new Set(((field?.options ?? []) as any[]).map((o) => (typeof o === 'string' ? o : o.value)))
      }
      const niches = options('niche')
      const reasons = options('qualification')
      const seen = new Map<string, number>()
      const results: { row: number; ok: boolean; id?: number; error?: string }[] = []

      for (const [i, raw] of rows.entries()) {
        const row = i + 1
        const data: LeadData = { source }
        for (const k of IMPORT_FIELDS) {
          const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[k] : undefined
          if (typeof v === 'string' && v.trim()) data[k] = v.trim()
        }
        if (data.email) data.email = String(data.email).toLowerCase()
        if (data.country) data.country = String(data.country).toUpperCase()
        const problem =
          leadProblem(data) ||
          (data.country && !/^[A-Z]{2}$/.test(data.country) ? 'The country needs two letters, such as NG or GH.' : null) ||
          (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? 'The email does not look right.' : null) ||
          (data.niche && !niches.has(data.niche) ? 'That type of business is not one of the choices.' : null) ||
          (data.qualification && !reasons.has(data.qualification) ? 'That reason it qualifies is not one of the choices.' : null)
        if (problem) {
          results.push({ row, ok: false, error: problem })
          continue
        }
        const keys = { phoneKey: phoneKey(data.phone), whatsappKey: phoneKey(data.whatsapp), websiteKey: websiteKey(data.website), nameCityKey: nameCityKey(data.businessName, data.city) }
        const marks = [keys.phoneKey, keys.whatsappKey, data.email, keys.websiteKey, keys.nameCityKey].filter(Boolean) as string[]
        const twin = marks.map((m) => seen.get(m)).find((n) => n !== undefined)
        if (twin !== undefined) {
          results.push({ row, ok: false, error: `The same business as row ${twin}.` })
          continue
        }
        for (const m of marks) seen.set(m, row)
        const dup = await findDuplicate(req, { ...data, ...keys })
        if (dup) {
          results.push({ row, ok: false, error: dup })
          continue
        }
        if (dryRun) {
          results.push({ row, ok: true })
          continue
        }
        try {
          // Without `req`, so each row is its own transaction: one refusal never undoes the rows before it.
          const doc = await req.payload.create({ collection: 'leads', data: { ...data, status: 'new' } as never, user: req.user, overrideAccess: false })
          results.push({ row, ok: true, id: Number(doc.id) })
        } catch (err) {
          results.push({ row, ok: false, error: err instanceof Error ? err.message : 'It could not be saved.' })
        }
      }
      const added = results.filter((r) => r.ok && r.id).length
      if (added) {
        await audit(req, {
          action: 'leads.imported',
          summary: `${added} lead${added === 1 ? '' : 's'} added from ${String(body.fileName || 'a spreadsheet').slice(0, 120)}`,
          person: user.id,
          subjectType: 'leads',
        })
      }
      return Response.json({ results, added, refused: results.filter((r) => !r.ok).length })
    },
  },
]

/** A pitch opened for the first time: bring the lead's follow-up to today (rule 6). */
export async function pitchOpened(req: PayloadRequest, leadId: unknown) {
  const id = Number(idOf(leadId))
  if (!id) return
  const lead = await req.payload.findByID({ collection: 'leads', id, depth: 0, overrideAccess: true, req }).catch(() => null)
  if (!lead) return
  const rows = ((lead.activity as Row[]) ?? []).map((r) => ({ ...r, by: idOf(r.by) }))
  await req.payload.update({
    collection: 'leads',
    id,
    data: {
      nextFollowUp: todayStart(),
      activity: [...rows, { at: new Date().toISOString(), kind: 'note', type: 'other', note: 'Pitch opened' }],
    } as never,
    context: { system: true },
    overrideAccess: true,
    req,
  })
  const worker = idOf(lead.assignedTo)
  if (worker) {
    await notify(req, {
      to: [worker as number],
      kind: 'pitch-opened',
      title: `${lead.title || 'A prospect'} opened their pitch`,
      body: 'It is the best moment to follow up. The lead is marked for today.',
      link: `/leads/${lead.id}`,
      key: `pitch-opened:${lead.id}`,
      action: 'Follow up',
    })
  }
}
