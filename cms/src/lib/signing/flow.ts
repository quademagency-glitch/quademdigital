import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import crypto from 'node:crypto'
import { cancelledEmail, codeEmail, completedEmail, declinedEmail, requestEmail, signedNoticeEmail } from './emails'
import { readUpload } from './files'
import { cleanPlaces, covers, LIMITS, ownerOf, SENDER } from './places'
import { stampDocument, type StampField, type StampSigner } from './stamp'
import { checkSession, codeMatches, hashToken, makeSession, newCode, newToken, openToken, sealToken, sha256 } from './tokens'

/**
 * Everything that happens to a signing request after it is uploaded.
 *
 * Endpoints on the collection call these. The signer's side is reached only
 * through the website's own account, which passes on the visitor's IP address
 * and browser so they can go on the certificate; the token in the link is what
 * identifies the signer, and the CMS never trusts a browser to say who it is.
 */

type Doc = Record<string, any>
export class SigningError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message) }
}

const REQ = 'signature-requests' as const
const SES = 'signing-sessions' as const
const SIGNED = 'signed-documents' as const

/*
  Not ASTRO_SITE_URL: on Railway that is http://localhost:4321 (see the note in
  components/PitchLinkPanel.tsx), and a signing link that points at localhost
  is an email a client cannot use. SIGNING_SITE_URL exists only for testing.
*/
export const SITE_URL = () => (process.env.SIGNING_SITE_URL || 'https://quademdigital.com').replace(/\/$/, '')
const ADMIN_URL = () => (process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.quademdigital.com').replace(/\/$/, '')
export const signingLink = (token: string) => `${SITE_URL()}/sign/${token}/`
const requestAdminUrl = (id: number | string) => `${ADMIN_URL()}/admin/collections/${REQ}/${id}`
export const referenceFor = (id: number | string, at = new Date()) => `QDS-${at.getUTCFullYear()}-${String(id).padStart(4, '0')}`

const now = () => new Date()
const iso = (d = now()) => d.toISOString()
const DAY = 86_400_000

/** "Chrome on Android", from a user-agent string, for the certificate. */
export const describeDevice = (ua: string | null | undefined) => {
  if (!ua) return ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone or iPad' : /Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'an unknown device'
  return `${browser} on ${os}`
}

const sessionsOf = async (payload: Payload, requestId: number | string) =>
  (await payload.find({ collection: SES, where: { request: { equals: requestId } }, sort: 'order', limit: 50, depth: 0, overrideAccess: true })).docs as Doc[]

const getRequest = async (payload: Payload, id: number | string) =>
  (await payload.findByID({ collection: REQ, id, depth: 1, overrideAccess: true })) as Doc

/** Appends a line to the request's history without touching anything else. */
async function logRequest(payload: Payload, id: number | string, text: string, extra: Doc = {}) {
  const fresh = (await payload.findByID({ collection: REQ, id, depth: 0, overrideAccess: true })) as Doc
  await payload.update({
    collection: REQ, id, overrideAccess: true, context: { signingSystem: true },
    data: { ...extra, events: [...(fresh.events || []), { at: iso(), text }] },
  })
}

/*
  Counts a guess at the emailed code before it is checked, in one statement, and
  says how many there have been, or null once five are used (CMS review,
  8 October 2026). Reading the count and writing it back separately let guesses
  sent at the same moment all pass the five-try limit.
*/
async function claimTry(payload: Payload, id: number | string): Promise<number | null> {
  const db = (payload.db as unknown as { drizzle: { execute?: (q: unknown) => Promise<{ rows: Doc[] }>; all?: (q: unknown) => Promise<Doc[]> } }).drizzle
  const q = sql`UPDATE signing_sessions SET code_tries = COALESCE(code_tries, 0) + 1 WHERE id = ${Number(id)} AND COALESCE(code_tries, 0) < 5 RETURNING code_tries`
  const rows = db.execute ? (await db.execute(q)).rows : await db.all!(q)
  return rows?.[0] ? Number(rows[0].code_tries ?? rows[0].codeTries) : null
}

async function updateSession(payload: Payload, s: Doc, data: Doc, event?: string) {
  const fresh = (await payload.findByID({ collection: SES, id: s.id, depth: 0, overrideAccess: true, showHiddenFields: true })) as Doc
  return (await payload.update({
    collection: SES, id: s.id, overrideAccess: true,
    data: { ...data, ...(event ? { events: [...(fresh.events || []), { at: iso(), text: event }] } : {}) },
  })) as Doc
}

const senderOf = (req: Doc) => {
  const u = req.sentBy && typeof req.sentBy === 'object' ? req.sentBy : null
  return { name: u?.name || 'Quadem Digital', email: u?.email || process.env.CMS_FROM_ADDRESS || 'ernest@quademdigital.com' }
}

/*
  Ernest, signing his own document, can still change it on the signing page:
  type into any blank that is his or nobody's, correct what he typed before
  sending, and add text anywhere. Only while nobody else has signed, because
  after that a change would alter what they signed. Everyone else fills only
  their own places. Changes are logged with this prefix, and the time of the
  last one is the document's version, which a signer's page sends back so a
  page opened before a change cannot sign the old version.
*/
const EDIT_EVENT = 'Changed while signing'
const isSender = (req: Doc, s: Doc) => senderOf(req).email.trim().toLowerCase() === String(s.email || '').trim().toLowerCase()
const versionOf = (req: Doc) =>
  [...((req.events || []) as Doc[])].reverse().find((e) => String(e.text).startsWith(EDIT_EVENT))?.at || req.sentAt || ''
const someoneElseSigned = (sessions: Doc[], s: Doc) => sessions.some((x) => x.id !== s.id && x.status === 'signed')

async function emailSigner(payload: Payload, req: Doc, s: Doc, token: string, reminder = false) {
  const from = senderOf(req)
  const mail = requestEmail({
    name: s.name, from: from.name, title: req.title, message: req.message, url: signingLink(token),
    expiresAt: new Date(req.expiresAt), needsCode: Boolean(req.requireCode), reminder,
  })
  await payload.sendEmail({ to: s.email, replyTo: from.email, subject: mail.subject, html: mail.html, text: mail.text })
}

// ─── Ernest's side ─────────────────────────────────────────────────────────

export async function sendRequest(payload: Payload, id: number | string, user: Doc) {
  const req = await getRequest(payload, id)
  if (req.status !== 'draft') throw new SigningError('This has already been sent.', 409)
  const signers = (req.signers || []) as Doc[]
  if (!signers.length) throw new SigningError('Add at least one person to sign.')
  const emails = new Set<string>()
  for (const s of signers) {
    if (!s.name?.trim() || !s.email?.trim()) throw new SigningError('Every signer needs a name and an email address.')
    const e = s.email.trim().toLowerCase()
    if (emails.has(e)) throw new SigningError(`${s.email} is on the list twice. Each person signs once.`)
    emails.add(e)
  }
  if (!req.filename) throw new SigningError('Upload the PDF first.')

  const sentAt = now()
  const expiresAt = new Date(sentAt.getTime() + Math.max(1, Number(req.expiresInDays) || 30) * DAY)
  const tokens: { session: Doc; token: string }[] = []
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i]
    const token = newToken()
    const waiting = Boolean(req.signInOrder) && i > 0
    const session = (await payload.create({
      collection: SES, overrideAccess: true,
      data: {
        request: Number(id), signerId: String(s.id), order: i, name: s.name.trim(), email: s.email.trim(),
        role: s.role || null, organisation: s.organisation || null, title: s.title || null,
        status: waiting ? 'waiting' : 'sent', sentAt: waiting ? null : iso(sentAt),
        tokenHash: hashToken(token), tokenSealed: sealToken(token),
        events: [{ at: iso(sentAt), text: waiting ? 'Waiting for the signer before them' : 'Link sent by email' }],
      },
    })) as Doc
    tokens.push({ session, token })
  }

  await payload.update({
    collection: REQ, id, overrideAccess: true, context: { signingSystem: true },
    data: {
      status: 'out', sentAt: iso(sentAt), expiresAt: iso(expiresAt), reference: req.reference || referenceFor(id, sentAt),
      sentBy: user?.id ?? null,
      events: [...(req.events || []), { at: iso(sentAt), text: `Sent to ${signers.map((s) => s.name).join(', ')}${user?.name ? ` by ${user.name}` : ''}` }],
    },
  })
  const fresh = await getRequest(payload, id)
  const failed: string[] = []
  for (const { session, token } of tokens) {
    if (session.status !== 'sent') continue
    await emailSigner(payload, fresh, session, token).catch((err) => {
      payload.logger.error({ err, to: session.email }, 'Signing request email failed')
      failed.push(session.email)
    })
  }
  return { links: tokens.map(({ session, token }) => ({ name: session.name, email: session.email, status: session.status, url: signingLink(token) })), failed }
}

export async function requestStatus(payload: Payload, id: number | string) {
  const req = await getRequest(payload, id)
  const sessions = await payload.find({ collection: SES, where: { request: { equals: id } }, sort: 'order', limit: 50, depth: 0, overrideAccess: true, showHiddenFields: true })
  return {
    status: req.status, reference: req.reference, sentAt: req.sentAt, expiresAt: req.expiresAt, completedAt: req.completedAt,
    signedFile: req.signedFile && typeof req.signedFile === 'object' ? { filename: req.signedFile.filename, url: req.signedFile.url } : null,
    signers: (sessions.docs as Doc[]).map((s) => {
      const token = openToken(s.tokenSealed)
      return {
        id: s.id, name: s.name, email: s.email, status: s.status, openedAt: s.openedAt, signedAt: s.signedAt, declineReason: s.declineReason,
        codeVerified: s.codeVerified, url: token && ['sent', 'opened', 'waiting'].includes(s.status) ? signingLink(token) : null,
      }
    }),
  }
}

export async function remindRequest(payload: Payload, id: number | string, automatic = false) {
  const req = await getRequest(payload, id)
  if (req.status !== 'out') throw new SigningError('Only a request that is out for signing can be chased.', 409)
  const sessions = await payload.find({ collection: SES, where: { request: { equals: id } }, sort: 'order', limit: 50, depth: 0, overrideAccess: true, showHiddenFields: true })
  const reminded: string[] = []
  for (const s of sessions.docs as Doc[]) {
    if (!['sent', 'opened'].includes(s.status)) continue
    const token = openToken(s.tokenSealed)
    if (!token) continue
    await emailSigner(payload, req, s, token, true)
    await updateSession(payload, s, { remindedAt: iso(), reminders: (s.reminders || 0) + 1 }, automatic ? 'Reminder sent automatically' : 'Reminder sent')
    reminded.push(s.name)
  }
  if (reminded.length) await logRequest(payload, id, `${automatic ? 'Automatic reminder' : 'Reminder'} sent to ${reminded.join(', ')}`)
  return { reminded }
}

export async function cancelRequest(payload: Payload, id: number | string, user: Doc) {
  const req = await getRequest(payload, id)
  if (req.status !== 'out') throw new SigningError('Only a request that is out for signing can be withdrawn.', 409)
  const from = senderOf(req)
  for (const s of await sessionsOf(payload, id)) {
    if (['signed', 'declined', 'cancelled'].includes(s.status)) continue
    const told = ['sent', 'opened'].includes(s.status)
    await updateSession(payload, s, { status: 'cancelled' }, 'Withdrawn')
    if (told) {
      const mail = cancelledEmail({ name: s.name, from: from.name, title: req.title })
      await payload.sendEmail({ to: s.email, subject: mail.subject, html: mail.html, text: mail.text }).catch((err) => payload.logger.error({ err }, 'Withdrawal email failed'))
    }
  }
  await logRequest(payload, id, `Withdrawn${user?.name ? ` by ${user.name}` : ''}`, { status: 'cancelled' })
  return { ok: true }
}

/**
 * Puts right a mistyped email address after sending, for one person who has
 * not signed yet, without starting again: everyone who has signed stays
 * signed. Their old link stops working, because it went to an address that
 * may belong to someone else; a new one goes to the corrected address, unless
 * they are still waiting their turn, when it goes once it is. Anything the old
 * address did (opening, a code) is cleared, and the change is in the history
 * and therefore on the certificate.
 */
export async function changeSignerEmail(payload: Payload, id: number | string, sessionId: unknown, email: unknown, user: Doc) {
  const req = await getRequest(payload, id)
  if (req.status !== 'out') throw new SigningError('Only a request that is out for signing can have an address corrected.', 409)
  const next = typeof email === 'string' ? email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next) || next.length > 254) throw new SigningError('That is not an email address. Check it and try again.')
  const sessions = await sessionsOf(payload, id)
  const session = sessions.find((s) => String(s.id) === String(sessionId))
  if (!session) throw new SigningError('That signer is not on this request.', 404)
  if (session.status === 'signed') throw new SigningError(`${session.name} has already signed, so their address is part of the record and cannot change.`, 409)
  if (!['waiting', 'sent', 'opened'].includes(session.status)) throw new SigningError(`${session.name} can no longer sign this request.`, 409)
  const before = String(session.email || '')
  if (before.toLowerCase() === next.toLowerCase()) throw new SigningError('That is the address it already has.')
  if (sessions.some((s) => s.id !== session.id && String(s.email).toLowerCase() === next.toLowerCase())) {
    throw new SigningError(`${next} is already signing this request. Each person signs once.`)
  }

  const token = newToken()
  const waiting = session.status === 'waiting'
  const who = user?.name ? ` by ${user.name}` : ''
  const updated = await updateSession(payload, session, {
    email: next, tokenHash: hashToken(token), tokenSealed: sealToken(token),
    status: waiting ? 'waiting' : 'sent', sentAt: waiting ? null : iso(), openedAt: null, ip: null, device: null,
    codeHash: null, codeSentAt: null, codesSent: 0, codeTries: 0, codeVerified: false, remindedAt: null, reminders: 0,
  }, `Email corrected from ${before} to ${next}${who}; the old link no longer works${waiting ? '' : ', and a new one was sent'}`)
  const signers = ((req.signers || []) as Doc[]).map((s) => (String(s.id) === String(session.signerId) ? { ...s, email: next } : s))
  await logRequest(payload, id, `Email for ${session.name} corrected from ${before} to ${next}${who}. The old link no longer works.`, { signers })
  if (!waiting) await emailSigner(payload, await getRequest(payload, id), updated, token)
  return { ok: true, sent: !waiting, name: session.name, email: next }
}

/**
 * "Send it again" for a request that was withdrawn, declined or expired: a new
 * draft with the same PDF, signers, message, settings and every place,
 * including whatever Ernest moved, added or typed. The old one stays as it is,
 * a record of what happened. The draft is for checking and sending, so
 * nothing is emailed here.
 *
 * Array rows carry ids that must be unique across every request, so signers,
 * parties and places all get new ones, and each "signer:<id>" place and each
 * matched party is pointed at the new signer ids. Creating the draft runs the
 * upload hook, which reads the PDF afresh; the copied places then replace
 * what it found, so nothing Ernest changed is lost.
 */
export async function copyRequest(payload: Payload, id: number | string, user: Doc) {
  const old = (await payload.findByID({ collection: REQ, id, depth: 0, overrideAccess: true })) as Doc
  if (!['cancelled', 'declined', 'expired'].includes(old.status)) {
    throw new SigningError('Only a request that was withdrawn, declined or expired can be sent again.', 409)
  }
  const bytes = await readUpload(old, REQ)
  const fresh = () => crypto.randomBytes(12).toString('hex')
  const newIds = new Map(((old.signers || []) as Doc[]).map((s) => [String(s.id), fresh()]))
  const signers = ((old.signers || []) as Doc[]).map((s) => ({
    id: newIds.get(String(s.id)), name: s.name, email: s.email, role: s.role ?? null, organisation: s.organisation ?? null, title: s.title ?? null,
  }))
  const created = (await payload.create({
    collection: REQ, overrideAccess: true, user: user as never,
    data: {
      title: old.title, message: old.message ?? null, signers, requireCode: Boolean(old.requireCode), signInOrder: Boolean(old.signInOrder),
      expiresInDays: old.expiresInDays ?? 30, remindEveryDays: old.remindEveryDays ?? 3,
      client: typeof old.client === 'object' ? old.client?.id ?? null : old.client ?? null,
      member: typeof old.member === 'object' ? old.member?.id ?? null : old.member ?? null,
    } as never,
    file: { data: Buffer.from(bytes), mimetype: 'application/pdf', name: String(old.filename || 'document.pdf'), size: bytes.length },
  })) as Doc
  const signerOf = (v: unknown) => (v == null ? null : newIds.get(String(v)) ?? null)
  const parties = ((old.parties || []) as Doc[]).map((p) => ({
    id: fresh(), partyId: p.partyId, page: p.page ?? null, witness: Boolean(p.witness), context: p.context ?? null, signerId: signerOf(p.signerId), manual: Boolean(p.manual),
  }))
  const places = ((old.places || []) as Doc[]).map((f) => {
    const party = String(f.party || '')
    return {
      id: fresh(), page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, kind: f.kind,
      party: party.startsWith('signer:') ? `signer:${signerOf(party.slice('signer:'.length)) ?? ''}` : party,
      context: f.context ?? null, label: f.label ?? null, value: f.value ?? null, required: f.required ?? null,
    }
  })
  const how = old.status === 'cancelled' ? 'withdrawn' : old.status
  await payload.update({
    collection: REQ, id: created.id, overrideAccess: true, context: { signingSystem: true },
    data: { pages: old.pages || created.pages, parties, places, events: [{ at: iso(), text: `Copied from ${old.reference || `request ${old.id}`} (${how})${user?.name ? ` by ${user.name}` : ''}, to check and send again` }] },
  })
  await logRequest(payload, old.id, `Copied to a new draft to send again (request ${created.id})${user?.name ? ` by ${user.name}` : ''}`)
  return { ok: true, id: created.id }
}

// ─── The signer's side ─────────────────────────────────────────────────────

async function bySessionToken(payload: Payload, token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 64) throw new SigningError('This signing link is not valid.', 404, 'invalid')
  const found = await payload.find({ collection: SES, where: { tokenHash: { equals: hashToken(token) } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
  const session = found.docs[0] as Doc | undefined
  if (!session) throw new SigningError('This signing link is not valid.', 404, 'invalid')
  const request = await getRequest(payload, typeof session.request === 'object' ? session.request.id : session.request)
  return { session, request }
}

/** Refuses a request that can no longer be signed, with a reason a signer understands. */
async function assertOpen(payload: Payload, request: Doc, forViewing = false) {
  if (request.status === 'completed' && forViewing) return
  if (request.status === 'cancelled') throw new SigningError('This document was withdrawn by the sender, so it no longer needs signing.', 410, 'withdrawn')
  if (request.status === 'declined') throw new SigningError('Someone declined to sign this document, so it will not be completed.', 410, 'declined')
  if (request.status === 'expired' || (request.status === 'out' && request.expiresAt && new Date(request.expiresAt) < now())) {
    if (request.status === 'out') await logRequest(payload, request.id, 'Expired before everyone signed', { status: 'expired' })
    throw new SigningError('This signing link has expired. Ask the sender for a new one.', 410, 'expired')
  }
  if (request.status === 'completed') throw new SigningError('Everyone has already signed this document.', 409, 'completed')
  if (!['out', 'completing'].includes(request.status)) throw new SigningError('This document is not out for signing.', 409, 'closed')
}

const needsCodeFor = (request: Doc, session: Doc, sess: unknown) =>
  Boolean(request.requireCode) && session.status !== 'signed' && !checkSession(session.id, sess)

const maskEmail = (e: string) => e.replace(/^(.)(.*)(.@.*)$/, (_m, a, b, c) => a + '•'.repeat(Math.min(6, b.length)) + c)

/**
 * What the signing page needs. `record` is false when the website renders the
 * page and true when the page's own script reports that it ran: mail and chat
 * apps fetch every link to preview it, and counting those fetches as "opened"
 * would put Microsoft's link scanner on the certificate before the signer.
 */
export async function openForSigner(payload: Payload, token: unknown, sess: unknown, visitor: { ip?: string; ua?: string }, record = false) {
  const { session, request } = await bySessionToken(payload, token)
  await assertOpen(payload, request, true)
  const sessions = await sessionsOf(payload, request.id)
  const sender = senderOf(request)
  const base = {
    title: request.title, reference: request.reference, sender: sender.name, message: request.message || null,
    status: request.status, expiresAt: request.expiresAt,
    signer: { name: session.name, role: session.role, title: session.title, status: session.status, email: maskEmail(session.email) },
  }
  if (request.status === 'completed') return { ...base, completed: true }
  if (session.status === 'waiting') {
    const before = sessions.filter((s) => s.order < session.order && s.status !== 'signed').map((s) => s.name)
    return { ...base, waitingFor: before }
  }
  if (session.status === 'declined' || session.status === 'cancelled') throw new SigningError('This link no longer works.', 410, 'closed')

  const needsCode = needsCodeFor(request, session, sess)
  if (record && !session.openedAt) {
    await updateSession(payload, session, { status: session.status === 'sent' ? 'opened' : session.status, openedAt: iso(), ip: visitor.ip || null, device: describeDevice(visitor.ua) },
      `Opened${visitor.ip ? `, IP ${visitor.ip}` : ''}`)
    await logRequest(payload, request.id, `Opened by ${session.name}${visitor.ip ? `, IP ${visitor.ip}` : ''}`)
  }
  if (needsCode) return { ...base, needsCode: true }

  // Which signer owns each place (lib/signing/places.ts), then their session.
  // A blank Ernest filled in shows as text that is already there; one nobody
  // fills is left off.
  const bySigner = new Map(sessions.map((s) => [String(s.signerId), s]))
  const parties = (request.parties || []) as Doc[]
  const canEdit = isSender(request, session) && !someoneElseSigned(sessions, session)
  const fields = ((request.places || []) as Doc[])
    .map((f) => {
      const box = { id: String(f.id), page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, kind: f.kind, ...(covers(f) ? { cover: true } : {}) }
      const o = ownerOf(f, parties)
      const editable = canEdit && f.kind === 'text' && (o === SENDER || !o || !bySigner.get(o))
      if (editable) return { ...box, mine: true, editable: true, owner: session.name, value: String(f.value || ''), label: f.label || null, required: false }
      if (o === SENDER) return f.kind === 'text' && f.value ? { ...box, mine: false, owner: sender.name, value: String(f.value) } : null
      const who = o ? bySigner.get(o) : undefined
      if (!who) return null
      return { ...box, mine: who.id === session.id, owner: who.name, ...(f.kind === 'text' ? { label: f.label || null, required: f.required !== false } : {}) }
    })
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
  const mine = fields.filter((f) => f.mine)
  return {
    ...base,
    pages: request.pages || [],
    version: versionOf(request),
    canEdit,
    fields,
    signsOnCertificate: !mine.some((f) => f.kind === 'signature'),
    needsTitle: mine.some((f) => f.kind === 'title') && !session.title,
    others: sessions.filter((s) => s.id !== session.id).map((s) => ({ name: s.name, signed: s.status === 'signed' })),
  }
}

export async function sendCode(payload: Payload, token: unknown) {
  const { session, request } = await bySessionToken(payload, token)
  await assertOpen(payload, request)
  if (!request.requireCode) return { ok: true }
  const withinHour = session.codeSentAt && now().getTime() - new Date(session.codeSentAt).getTime() < 3_600_000
  const sent = withinHour ? session.codesSent || 0 : 0
  if (sent >= 5) throw new SigningError('Too many codes in the last hour. Try again later.', 429, 'rate')
  const { code, hash } = newCode()
  await updateSession(payload, session, { codeHash: hash, codeSentAt: iso(), codesSent: sent + 1, codeTries: 0 }, 'Code sent by email')
  const mail = codeEmail({ name: session.name, title: request.title, code })
  await payload.sendEmail({ to: session.email, subject: mail.subject, html: mail.html, text: mail.text })
  return { ok: true, to: maskEmail(session.email) }
}

export async function verifyCode(payload: Payload, token: unknown, code: unknown) {
  const { session, request } = await bySessionToken(payload, token)
  await assertOpen(payload, request)
  if ((session.codeTries || 0) >= 5) throw new SigningError('Too many wrong codes. Send a new one.', 429, 'tries')
  const fresh = session.codeSentAt && now().getTime() - new Date(session.codeSentAt).getTime() < 10 * 60_000
  if (!fresh) throw new SigningError('That code has expired. Send a new one.', 400, 'expired-code')
  const tries = await claimTry(payload, session.id)
  if (tries === null) throw new SigningError('Too many wrong codes. Send a new one.', 429, 'tries')
  if (!codeMatches(String(code || '').trim(), session.codeHash)) {
    throw new SigningError(`That code is not right. ${Math.max(0, 5 - tries)} tries left.`, 400, 'wrong-code')
  }
  await updateSession(payload, session, { codeVerified: true, codeHash: null, codeTries: 0 }, 'Code entered correctly')
  return { session: makeSession(session.id) }
}

export async function documentFor(payload: Payload, token: unknown, sess: unknown, signed = false) {
  const { session, request } = await bySessionToken(payload, token)
  await assertOpen(payload, request, true)
  if (signed) {
    if (request.status !== 'completed' || !request.signedFile) throw new SigningError('The signed copy is not ready yet.', 404)
    const file = typeof request.signedFile === 'object' ? request.signedFile : await payload.findByID({ collection: SIGNED, id: request.signedFile, overrideAccess: true })
    return { bytes: await readUpload(file as Doc, SIGNED), filename: `${request.title} (signed).pdf` }
  }
  if (needsCodeFor(request, session, sess)) throw new SigningError('Enter the code first.', 401, 'code')
  return { bytes: await readUpload(request, REQ), filename: `${request.title}.pdf` }
}

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/
const pngFrom = (value: unknown, max: number) => {
  if (typeof value !== 'string') return null
  const m = value.match(PNG_DATA_URL)
  if (!m) return null
  const bytes = Buffer.from(m[1], 'base64')
  if (bytes.length > max || bytes.length < 100 || bytes.readUInt32BE(0) !== 0x89504e47) return null
  return value
}

export async function submitSignature(
  payload: Payload, token: unknown, sess: unknown,
  body: { signature?: unknown; initials?: unknown; title?: unknown; consent?: unknown; texts?: unknown; edits?: unknown; added?: unknown; version?: unknown },
  visitor: { ip?: string; ua?: string },
) {
  const { session, request } = await bySessionToken(payload, token)
  await assertOpen(payload, request)
  if (request.status !== 'out') throw new SigningError('This document is being finished. Refresh in a moment.', 409)
  if (session.status === 'signed') throw new SigningError('You have already signed this document.', 409, 'signed')
  if (session.status === 'waiting') throw new SigningError('It is not your turn to sign yet.', 409, 'waiting')
  if (!['sent', 'opened'].includes(session.status)) throw new SigningError('This link no longer works.', 410, 'closed')
  if (needsCodeFor(request, session, sess)) throw new SigningError('Enter the code first.', 401, 'code')
  if (body.consent !== true) throw new SigningError('Tick the box to agree to sign electronically.')
  const signature = pngFrom(body.signature, 450_000)
  if (!signature) throw new SigningError('Add your signature first.')
  const initials = body.initials == null ? null : pngFrom(body.initials, 220_000)
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''

  // A page opened before Ernest changed the document would sign the old one.
  if (body.version !== undefined && String(body.version) !== String(versionOf(request))) {
    throw new SigningError('This document was updated after you opened it. Refresh the page to see the latest version, then sign.', 409, 'changed')
  }

  // Ernest's own changes, made on his signing page (see EDIT_EVENT).
  const edits = body.edits && typeof body.edits === 'object' ? (body.edits as Record<string, unknown>) : {}
  const added = Array.isArray(body.added) ? body.added : []
  if (Object.keys(edits).length || added.length) {
    if (!isSender(request, session)) throw new SigningError('Only the sender can change the document.', 403)
    if (someoneElseSigned(await sessionsOf(payload, request.id), session)) {
      throw new SigningError('Someone has already signed, so the document can no longer be changed. Sign it as it is, or withdraw it and send a new one.', 409, 'locked')
    }
    const parties = (request.parties || []) as Doc[]
    const signerIds = new Set((await sessionsOf(payload, request.id)).map((x) => String(x.signerId)))
    let changed = 0
    const next = ((request.places || []) as Doc[]).map((f) => {
      const id = String(f.id)
      if (f.kind !== 'text' || !(id in edits)) return f
      const o = ownerOf(f, parties)
      if (o !== SENDER && o && signerIds.has(o)) return f
      const v = typeof edits[id] === 'string' ? (edits[id] as string).replace(/\s+/g, ' ').trim().slice(0, LIMITS.value) : ''
      if (String(f.value || '') === v) return f
      changed++
      return { ...f, party: SENDER, value: v || null, required: null }
    })
    const fresh = added.slice(0, 30)
      .map((a) => (a || {}) as Doc)
      .filter((a) => typeof a.value === 'string' && a.value.trim())
      .map((a) => ({ page: a.page, x: a.x, y: a.y, width: a.width, height: a.height, kind: 'text', party: SENDER, label: 'Added while signing', context: 'Added while signing', value: String(a.value).replace(/\s+/g, ' ').trim().slice(0, LIMITS.value) }))
    const cleaned = cleanPlaces([...next, ...fresh], {
      pages: (request.pages || []) as { width: number; height: number }[],
      partyIds: new Set(parties.map((p) => String(p.partyId))),
      signerIds: new Set(((request.signers || []) as Doc[]).map((x) => String(x.id))),
    })
    if (typeof cleaned === 'string') throw new SigningError(cleaned)
    if (changed || fresh.length) {
      const what = [changed ? `${changed} blank${changed === 1 ? '' : 's'} changed` : '', fresh.length ? `${fresh.length} text${fresh.length === 1 ? '' : 's'} added` : ''].filter(Boolean).join(', ')
      await payload.update({
        collection: REQ, id: request.id, overrideAccess: true, context: { signingSystem: true },
        data: {
          places: cleaned.map((p) => ({ ...p, id: p.id || crypto.randomBytes(12).toString('hex') })),
          events: [...((request.events || []) as Doc[]), { at: iso(), text: `${EDIT_EVENT} by ${session.name}: ${what}` }],
        },
      })
    }
  }

  // The blanks that are this signer's to fill. Anything sent for a place that
  // is not theirs is ignored, so a signer cannot write into anyone else's.
  const given = body.texts && typeof body.texts === 'object' ? (body.texts as Record<string, unknown>) : {}
  const texts: Record<string, string> = {}
  for (const f of (request.places || []) as Doc[]) {
    if (f.kind !== 'text' || ownerOf(f, (request.parties || []) as Doc[]) !== String(session.signerId)) continue
    const v = typeof given[String(f.id)] === 'string' ? (given[String(f.id)] as string).replace(/\s+/g, ' ').trim().slice(0, LIMITS.signerText) : ''
    if (!v && f.required !== false) throw new SigningError(`Fill in ${f.label ? `"${f.label}"` : 'every blank that is yours'} first.`)
    if (v) texts[String(f.id)] = v
  }

  await updateSession(payload, session, {
    status: 'signed', signedAt: iso(), signature, initials, texts, ...(title && !session.title ? { title } : {}),
    ip: visitor.ip || session.ip || null, device: describeDevice(visitor.ua) || session.device || null,
  }, `Signed${visitor.ip ? `, IP ${visitor.ip}` : ''}`)
  await logRequest(payload, request.id, `Signed by ${session.name}`)

  const sessions = await sessionsOf(payload, request.id)
  const left = sessions.filter((s) => s.status !== 'signed')
  if (!left.length) {
    // Stamping and emailing everyone can outlast the website's request
    // timeout, so it runs on here after answering. Railway is one long-lived
    // process, and the five-minute job finishes anything a restart cut short.
    void finishRequest(payload, request.id).catch((err) => payload.logger.error({ err }, 'Finishing a signed request failed'))
    return { ok: true, completed: true }
  }
  if (request.signInOrder) {
    const next = left.sort((a, b) => a.order - b.order)[0]
    if (next.status === 'waiting') {
      const fresh = (await payload.findByID({ collection: SES, id: next.id, depth: 0, overrideAccess: true, showHiddenFields: true })) as Doc
      const nextToken = openToken(fresh.tokenSealed)
      await updateSession(payload, next, { status: 'sent', sentAt: iso() }, 'Link sent by email')
      if (nextToken) await emailSigner(payload, request, next, nextToken).catch((err) => payload.logger.error({ err }, 'Next signer email failed'))
    }
  }
  const sender = senderOf(request)
  const notice = signedNoticeEmail({ to: sender.name, who: session.name, title: request.title, waitingFor: left.map((s) => s.name), url: requestAdminUrl(request.id) })
  await payload.sendEmail({ to: sender.email, subject: notice.subject, html: notice.html, text: notice.text }).catch((err) => payload.logger.error({ err }, 'Signed notice failed'))
  return { ok: true, completed: false }
}

export async function declineToSign(payload: Payload, token: unknown, sess: unknown, reason: unknown, visitor: { ip?: string; ua?: string }) {
  const { session, request } = await bySessionToken(payload, token)
  await assertOpen(payload, request)
  if (!['sent', 'opened'].includes(session.status)) throw new SigningError('This link no longer works.', 410, 'closed')
  if (needsCodeFor(request, session, sess)) throw new SigningError('Enter the code first.', 401, 'code')
  const why = typeof reason === 'string' ? reason.trim().slice(0, 1000) : ''
  await updateSession(payload, session, { status: 'declined', declinedAt: iso(), declineReason: why || null, ip: visitor.ip || null, device: describeDevice(visitor.ua) },
    `Declined${why ? `: ${why}` : ''}`)
  await logRequest(payload, request.id, `Declined by ${session.name}${why ? `: ${why}` : ''}`, { status: 'declined' })
  const sender = senderOf(request)
  const people = [{ name: sender.name, email: sender.email }, ...(await sessionsOf(payload, request.id)).filter((s) => s.id !== session.id && ['signed', 'opened', 'sent'].includes(s.status))]
  for (const p of people) {
    const mail = declinedEmail({ name: p.name, who: session.name, title: request.title, reason: why })
    await payload.sendEmail({ to: p.email, subject: mail.subject, html: mail.html, text: mail.text }).catch((err) => payload.logger.error({ err }, 'Declined email failed'))
  }
  return { ok: true }
}

// ─── Finishing ─────────────────────────────────────────────────────────────

/**
 * Stamps the document and sends everyone the signed copy. Runs exactly once:
 * the move from "out" to "completing" is a single conditional UPDATE, so two
 * last signatures landing together cannot both finish it. If stamping fails
 * the request goes back to "out" and the five-minute job tries again.
 */
export async function finishRequest(payload: Payload, id: number | string) {
  const pool = (payload.db as unknown as { pool?: { query: (q: string, v: unknown[]) => Promise<{ rowCount: number }> } }).pool
  if (pool?.query) {
    const won = await pool.query(`UPDATE "signature_requests" SET "status" = 'completing' WHERE "id" = $1 AND "status" = 'out'`, [Number(id)])
    if (!won.rowCount) return
  }
  try {
    const request = await getRequest(payload, id)
    const sessions = await sessionsOf(payload, id)
    const original = await readUpload(request, REQ)
    if (request.originalHash && sha256(original) !== request.originalHash) {
      throw new Error('The stored PDF no longer matches the one that was sent.')
    }
    const png = (dataUrl: string | null | undefined) => (dataUrl ? new Uint8Array(Buffer.from(dataUrl.split(',')[1], 'base64')) : null)
    const signers: StampSigner[] = sessions.map((s) => ({
      name: s.name, email: s.email, role: s.role, title: s.title, signedAt: new Date(s.signedAt), ip: s.ip, device: s.device,
      codeVerified: Boolean(s.codeVerified), signature: png(s.signature)!, initials: png(s.initials),
    }))
    const index = new Map(sessions.map((s, i) => [String(s.signerId), i]))
    const parties = (request.parties || []) as Doc[]
    const fields: StampField[] = ((request.places || []) as Doc[]).map((f) => {
      const o = ownerOf(f, parties)
      const signer = o && o !== SENDER ? index.get(o) ?? null : null
      const text = f.kind !== 'text' ? undefined
        : o === SENDER ? String(f.value || '')
        : signer != null ? String(((sessions[signer].texts || {}) as Record<string, string>)[String(f.id)] || '') : ''
      return { page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, kind: f.kind, signer, ...(text !== undefined ? { text, cover: covers(f) } : {}) }
    })
    const events = [
      ...((request.events || []) as Doc[]).filter((e) => !/^Opened by |^Signed by /.test(e.text)),
      ...sessions.flatMap((s) => ((s.events || []) as Doc[]).map((e) => ({ at: e.at, text: `${e.text.replace(/\.$/, '')} (${s.name})` }))),
    ].map((e) => ({ at: new Date(e.at), text: e.text })).sort((a, b) => a.at.getTime() - b.at.getTime())
    const completedAt = now()
    const stamped = await stampDocument({
      original, fields, signers, title: request.title, reference: request.reference || referenceFor(id),
      originalHash: request.originalHash || sha256(original), sentAt: new Date(request.sentAt), completedAt,
      events: [...events, { at: completedAt, text: 'Completed. Signed copy sent to everyone.' }],
    })
    const hash = sha256(stamped)
    const safeName = String(request.title || 'document').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'document'
    const signed = (await payload.create({
      collection: SIGNED, overrideAccess: true,
      data: { title: request.title, reference: request.reference, request: Number(id), hash },
      file: { data: Buffer.from(stamped), mimetype: 'application/pdf', name: `${safeName}-signed-${request.reference || id}.pdf`, size: stamped.length },
    })) as Doc
    await payload.update({
      collection: REQ, id, overrideAccess: true, context: { signingSystem: true },
      data: { status: 'completed', completedAt: iso(completedAt), signedHash: hash, signedFile: signed.id, events: [...(request.events || []), { at: iso(completedAt), text: 'Completed. Signed copy sent to everyone.' }] },
    })
    const sender = senderOf(request)
    const names = sessions.map((s) => s.name)
    const recipients = [...sessions.map((s) => ({ name: s.name, email: s.email })), ...(sessions.some((s) => s.email.toLowerCase() === sender.email.toLowerCase()) ? [] : [sender])]
    for (const r of recipients) {
      const mail = completedEmail({ name: r.name, title: request.title, reference: request.reference, names, hash })
      await payload.sendEmail({
        to: r.email, subject: mail.subject, html: mail.html, text: mail.text,
        attachments: [{ filename: `${request.title} (signed).pdf`, content: Buffer.from(stamped), contentType: 'application/pdf' }],
      }).catch((err) => payload.logger.error({ err, to: r.email }, 'Completed email failed'))
    }
  } catch (err) {
    payload.logger.error({ err, id }, 'Could not finish a signing request')
    if (pool?.query) await pool.query(`UPDATE "signature_requests" SET "status" = 'out' WHERE "id" = $1 AND "status" = 'completing'`, [Number(id)])
    await logRequest(payload, id, `Could not finish the signed copy yet: ${(err as Error).message}. It will be tried again.`).catch(() => {})
  }
}

/** Every five minutes: expire, chase, and finish anything that stalled. */
export async function runSigningJobs(payload: Payload) {
  const out = await payload.find({ collection: REQ, where: { status: { in: ['out', 'completing'] } }, limit: 100, depth: 0, overrideAccess: true })
  for (const r of out.docs as Doc[]) {
    try {
      const sessions = await sessionsOf(payload, r.id)
      if (r.status === 'out' && sessions.length && sessions.every((s) => s.status === 'signed')) { await finishRequest(payload, r.id); continue }
      if (r.status === 'completing' && r.updatedAt && now().getTime() - new Date(r.updatedAt).getTime() > 15 * 60_000) {
        // A finish that died mid-way (a restart, say) is released for another try.
        const pool = (payload.db as unknown as { pool?: { query: (q: string, v: unknown[]) => Promise<unknown> } }).pool
        await pool?.query(`UPDATE "signature_requests" SET "status" = 'out' WHERE "id" = $1 AND "status" = 'completing'`, [Number(r.id)])
        continue
      }
      if (r.status !== 'out') continue
      if (r.expiresAt && new Date(r.expiresAt) < now()) {
        await logRequest(payload, r.id, 'Expired before everyone signed', { status: 'expired' })
        continue
      }
      const every = Number(r.remindEveryDays ?? 3)
      if (every > 0) {
        const due = sessions.filter((s) => ['sent', 'opened'].includes(s.status) && (s.reminders || 0) < 3 &&
          now().getTime() - new Date(s.remindedAt || s.sentAt || r.sentAt).getTime() > every * DAY)
        if (due.length) await remindRequest(payload, r.id, true)
      }
    } catch (err) {
      payload.logger.error({ err, id: r.id }, 'Signing job failed for a request')
    }
  }
}
