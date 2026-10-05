import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, Endpoint, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../access/roles'
import { audit } from './audit'
import { adminIds, notify } from './notify'
import { handoverEmail } from './teamEmails'
import { addWorkingDays, todayStart } from './workingDays'
import { nextGap, workRules, type WorkRules } from './workRules'

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
}
type LeadData = Record<string, any>

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
    if (!merged.email && !merged.phone && !merged.whatsapp) {
      throw new APIError('Add a phone number, a WhatsApp number or an email, so the lead can be reached.', 400)
    }
    if (!merged.businessName && !merged.name) throw new APIError('Add the business name or a contact name.', 400)
    if (merged.source === 'outreach' && (!merged.businessName || !merged.city || !merged.country)) {
      throw new APIError('A lead you found needs the business name, the city and the country.', 400)
    }
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
      if (old) return team ? old : { ...r, by: old.by ?? null, recordedAt: old.recordedAt ?? null }
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
]

/** Pitch site opened for the first time: bring the lead's follow-up to today (rule 6). */
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
      activity: [...rows, { at: new Date().toISOString(), kind: 'note', type: 'other', note: 'Pitch site opened' }],
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
      title: `${lead.title || 'A prospect'} opened their pitch site`,
      body: 'It is the best moment to follow up. The lead is marked for today.',
      link: `/leads/${lead.id}`,
      key: `pitch-opened:${lead.id}`,
      action: 'Follow up',
    })
  }
}
