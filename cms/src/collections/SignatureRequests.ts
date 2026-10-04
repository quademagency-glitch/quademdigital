import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import crypto from 'node:crypto'
import { hasRole, isAdmin, isAdminOrSite } from '../access/roles'
import { assignParties, signerForContext } from '../lib/signing/assign'
import { detectSignatureFields, type DetectedField } from '../lib/signing/detect'
import { readUpload } from '../lib/signing/files'
import { cleanPlaces, KINDS, SENDER, SIGNER_PREFIX } from '../lib/signing/places'
import {
  cancelRequest, changeSignerEmail, declineToSign, documentFor, openForSigner, remindRequest, requestStatus, sendCode, sendRequest,
  SigningError, submitSignature, verifyCode,
} from '../lib/signing/flow'
import { sha256 } from '../lib/signing/tokens'

/**
 * A document sent out for electronic signature.
 *
 * Ernest uploads the PDF and lists who signs it. The document's own signature
 * section is read straight away (lib/signing/detect.ts) and each place is
 * matched to a signer (lib/signing/assign.ts); the panel at the top shows the
 * result and lets him change any match before sending. Each signer then gets a
 * private link to quademdigital.com/sign/..., signs in place, and once the
 * last one has signed everyone receives the finished PDF with a signing
 * certificate on the last page.
 *
 * Once sent, the document, the signers and the places are fixed. A mistake is
 * put right by withdrawing the request and sending a new one, so what each
 * person was asked to sign can never change underneath them.
 */

const MAX_BYTES = 20 * 1024 * 1024

/** Written only by the signing flow. A normal save keeps whatever is stored. */
const SYSTEM_FIELDS = ['status', 'reference', 'sentAt', 'completedAt', 'expiresAt', 'sentBy', 'originalHash', 'signedHash', 'signedFile', 'events', 'places', 'parties', 'pages'] as const
/** Fixed once sent. */
const LOCKED_WHEN_SENT = ['title', 'message', 'requireCode', 'signInOrder'] as const

type Doc = Record<string, any>
const rowId = () => crypto.randomBytes(12).toString('hex')
const signerKey = (s: Doc) => [s?.name, s?.email, s?.role, s?.organisation, s?.title].map((v) => String(v ?? '').trim()).join('|')

const fail = (err: unknown) => {
  if (err instanceof SigningError) return Response.json({ error: err.message, code: err.code }, { status: err.status })
  throw err
}
const body = async (req: PayloadRequest) => {
  try { return ((await req.json?.()) || {}) as Doc } catch { return {} as Doc }
}
const idOf = (req: PayloadRequest) => {
  const id = (req.routeParams as { id?: string })?.id
  if (!id || !/^\d+$/.test(id)) throw new SigningError('Missing request id.', 400)
  return id
}
const adminOnly = (req: PayloadRequest) => {
  if (!hasRole(req.user, 'admin')) throw new SigningError('Only an admin can do that.', req.user ? 403 : 401)
}
const siteOnly = (req: PayloadRequest) => {
  if (!isAdminOrSite(req.user)) throw new SigningError('Not allowed.', req.user ? 403 : 401)
}
const visitorOf = (b: Doc) => ({ ip: typeof b.ip === 'string' ? b.ip.slice(0, 64) : undefined, ua: typeof b.ua === 'string' ? b.ua.slice(0, 400) : undefined })
const pdfResponse = ({ bytes, filename }: { bytes: Uint8Array; filename: string }) =>
  new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename.replace(/[^\w\-. ()]+/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  })

/**
 * Detected places as stored rows. A blank outside the signature section goes
 * to a signer when the words just before it name them ("Charles Ohanu, of
 * ____") or its box does ("THE TRAINEE · Charles Ohanu" over an address).
 * Blanks that point at the sender, or at nobody clearly, stay the sender's to
 * fill before sending, which is where his own company's details belong. The
 * sender is compared by email, not by being "from Quadem": Charles has a
 * quademdigital.com address and his blanks are still his.
 */
function placesFrom(fields: DetectedField[], signers: Doc[], senderEmail: string) {
  const people = signers.map((s) => ({ name: s.name || '', email: s.email || '', role: s.role, organisation: s.organisation }))
  const me = senderEmail.trim().toLowerCase()
  const pick = (context?: string) => {
    const i = context ? signerForContext(context, people) : null
    return i != null && people[i].email.trim().toLowerCase() !== me ? i : null
  }
  return fields.map((f) => {
    const who = f.kind === 'text' && f.party === SENDER ? pick(f.label) ?? pick(f.hint) : null
    const party = who != null ? `${SIGNER_PREFIX}${signers[who].id}` : f.party
    return {
      page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, kind: f.kind, party, context: f.context,
      label: f.label ?? null, required: f.kind === 'text' && party !== SENDER ? true : null,
    }
  })
}

/** Whoever is uploading or editing: the sender, whose own blanks stay theirs to fill. */
const senderEmailOf = (req: PayloadRequest) =>
  String((req.user as Doc | null)?.email || process.env.CMS_FROM_ADDRESS || 'ernest@quademdigital.com')

/** How much of the smaller of two boxes the other covers. */
const overlapOf = (a: Doc, b: Doc) => {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return (ix * iy) / Math.max(1, Math.min(a.width * a.height, b.width * b.height))
}

/** Matches places to signers, keeping any match Ernest made by hand. */
function reassign(data: Doc) {
  const signers = (data.signers || []) as Doc[]
  const parties = (data.parties || []) as Doc[]
  if (!parties.length) return
  const ids = new Set(signers.map((s) => String(s.id)))
  const auto = assignParties(
    { pages: data.pages || [], fields: [], parties: parties.map((p) => ({ id: p.partyId, page: p.page, witness: Boolean(p.witness), context: p.context || '' })) },
    signers.map((s) => ({ name: s.name || '', email: s.email || '', role: s.role, organisation: s.organisation })),
  )
  data.parties = parties.map((p) => {
    if (p.manual && (p.signerId == null || ids.has(String(p.signerId)))) return p
    const i = auto[p.partyId]
    return { ...p, manual: false, signerId: i == null ? null : String(signers[i].id) }
  })
}

export const SignatureRequests: CollectionConfig = {
  slug: 'signature-requests',
  labels: { singular: 'Document to sign', plural: 'Documents to sign' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'reference', 'sentAt', 'completedAt'],
    description: 'Upload a PDF, list who signs it, and send. The signature places in the document are found for you.',
  },
  upload: { mimeTypes: ['application/pdf'] },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        if (data && !data.title && req.file?.name) {
          data.title = req.file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, operation, req, context }) => {
        if (context?.signingSystem) return data
        const before = (originalDoc || {}) as Doc
        const status = before.status || 'draft'

        if (operation === 'update' && status !== 'draft') {
          if (req.file) throw new APIError('This has been sent, so the document cannot be replaced. Withdraw it and send a new one.', 400)
          // A tick box stored empty and one stored unticked mean the same.
          const same = (a: unknown, b: unknown) =>
            typeof a === 'boolean' || typeof b === 'boolean' ? Boolean(a) === Boolean(b) : String(a ?? '') === String(b ?? '')
          for (const k of LOCKED_WHEN_SENT) {
            if (k in data && !same(data[k], before[k])) throw new APIError('This has been sent, so it cannot be changed. Withdraw it and send a new one.', 400)
          }
          if ('signers' in data && ((data.signers || []) as Doc[]).map(signerKey).join('\n') !== ((before.signers || []) as Doc[]).map(signerKey).join('\n')) {
            throw new APIError('This has been sent, so the signers cannot be changed. Withdraw it and send a new one.', 400)
          }
        }
        for (const k of SYSTEM_FIELDS) {
          if (operation === 'update') data[k] = before[k]
          else delete data[k]
        }
        if (operation === 'create') data.status = 'draft'

        // Array rows made through the API arrive without ids; matching needs them.
        data.signers = ((data.signers || []) as Doc[]).map((s) => (s.id ? s : { ...s, id: rowId() }))

        if (req.file?.data) {
          if (req.file.size > MAX_BYTES) throw new APIError(`That PDF is ${(req.file.size / 1_048_576).toFixed(1)}MB. The limit is 20MB.`, 400)
          const bytes = new Uint8Array(req.file.data)
          if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') !== '%PDF-') throw new APIError('That file is not a PDF. Save the document as a PDF and upload that.', 400)
          // Fingerprint first: the file must be hashed exactly as it arrived.
          data.originalHash = sha256(bytes)
          let det
          try {
            det = await detectSignatureFields(bytes)
          } catch (err) {
            req.payload.logger.error({ err }, 'Could not read a PDF for signing')
            throw new APIError('That PDF could not be read. If it has a password, remove it and upload it again.', 400)
          }
          data.pages = det.pages
          data.places = placesFrom(det.fields, (data.signers || []) as Doc[], senderEmailOf(req))
          data.parties = det.parties.map((p) => ({ partyId: p.id, page: p.page, witness: p.witness, context: p.context.slice(0, 300), signerId: null, manual: false }))
        }
        if ((data.status || status) === 'draft') reassign(data)
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const doc = (await req.payload.findByID({ collection: 'signature-requests', id, depth: 0, overrideAccess: true })) as Doc
        if (['out', 'completing', 'completed'].includes(doc.status)) {
          throw new APIError(doc.status === 'completed'
            ? 'A signed document is a legal record and is kept.'
            : 'This is out for signing. Withdraw it first.', 400)
        }
      },
    ],
  },
  endpoints: [
    // Ernest's side.
    { path: '/:id/send', method: 'post', handler: async (req) => { try { adminOnly(req); return Response.json(await sendRequest(req.payload, idOf(req), req.user as Doc)) } catch (e) { return fail(e) } } },
    { path: '/:id/status', method: 'get', handler: async (req) => { try { adminOnly(req); return Response.json(await requestStatus(req.payload, idOf(req))) } catch (e) { return fail(e) } } },
    { path: '/:id/remind', method: 'post', handler: async (req) => { try { adminOnly(req); return Response.json(await remindRequest(req.payload, idOf(req))) } catch (e) { return fail(e) } } },
    {
      // A mistyped address, put right for one person after sending.
      path: '/:id/change-email',
      method: 'post',
      handler: async (req) => {
        try { adminOnly(req); const b = await body(req); return Response.json(await changeSignerEmail(req.payload, idOf(req), b.session, b.email, req.user as Doc)) } catch (e) { return fail(e) }
      },
    },
    { path: '/:id/cancel', method: 'post', handler: async (req) => { try { adminOnly(req); return Response.json(await cancelRequest(req.payload, idOf(req), req.user as Doc)) } catch (e) { return fail(e) } } },
    {
      path: '/:id/assign',
      method: 'post',
      handler: async (req) => {
        try {
          adminOnly(req)
          const id = idOf(req)
          const b = await body(req)
          const doc = (await req.payload.findByID({ collection: 'signature-requests', id, depth: 0, overrideAccess: true })) as Doc
          if (doc.status !== 'draft') throw new SigningError('This has been sent, so the places are fixed.', 409)
          const signerIds = new Set(((doc.signers || []) as Doc[]).map((s) => String(s.id)))
          if (b.signerId != null && !signerIds.has(String(b.signerId))) throw new SigningError('Save the signers first, then choose.', 400)
          const parties = ((doc.parties || []) as Doc[]).map((p) => (p.partyId === b.party ? { ...p, signerId: b.signerId == null ? null : String(b.signerId), manual: true } : p))
          await req.payload.update({ collection: 'signature-requests', id, overrideAccess: true, context: { signingSystem: true }, data: { parties } })
          return Response.json({ ok: true })
        } catch (e) { return fail(e) }
      },
    },
    {
      // The PDF itself, for the editor on the request's screen. The bucket is
      // private, so it is read here rather than linked.
      path: '/:id/original',
      method: 'get',
      handler: async (req) => {
        try {
          adminOnly(req)
          const doc = (await req.payload.findByID({ collection: 'signature-requests', id: idOf(req), depth: 0, overrideAccess: true })) as Doc
          return pdfResponse({ bytes: await readUpload(doc, 'signature-requests'), filename: `${doc.title || 'document'}.pdf` })
        } catch (e) { return fail(e) }
      },
    },
    {
      // "Find blanks again": reads the stored PDF with the current detector and
      // adds whatever it finds that no existing place already covers. Nothing
      // Ernest has placed, moved or typed is touched.
      path: '/:id/rescan',
      method: 'post',
      handler: async (req) => {
        try {
          adminOnly(req)
          const id = idOf(req)
          const doc = (await req.payload.findByID({ collection: 'signature-requests', id, depth: 0, overrideAccess: true })) as Doc
          if (doc.status !== 'draft') throw new SigningError('This has been sent, so the places are fixed.', 409)
          const det = await detectSignatureFields(await readUpload(doc, 'signature-requests'))
          const existing = (doc.places || []) as Doc[]
          const fresh = det.fields.filter((f) => !existing.some((p) => p.page === f.page && overlapOf(p, f) > 0.4))
          const known = new Set(((doc.parties || []) as Doc[]).map((p) => String(p.partyId)))
          const data: Doc = {
            signers: doc.signers,
            pages: doc.pages?.length ? doc.pages : det.pages,
            parties: [
              ...((doc.parties || []) as Doc[]),
              ...det.parties.filter((p) => !known.has(p.id)).map((p) => ({ partyId: p.id, page: p.page, witness: p.witness, context: p.context.slice(0, 300), signerId: null, manual: false })),
            ],
            places: [...existing, ...placesFrom(fresh, (doc.signers || []) as Doc[], senderEmailOf(req)).map((p) => ({ ...p, id: rowId() }))],
          }
          reassign(data)
          await req.payload.update({ collection: 'signature-requests', id, overrideAccess: true, context: { signingSystem: true }, data: { pages: data.pages, parties: data.parties, places: data.places } })
          return Response.json({ ok: true, added: fresh.length })
        } catch (e) { return fail(e) }
      },
    },
    {
      // Everything the editor changes: places moved, resized, added, removed,
      // given to someone else, and the blanks Ernest types into.
      path: '/:id/places',
      method: 'post',
      handler: async (req) => {
        try {
          adminOnly(req)
          const id = idOf(req)
          const b = await body(req)
          const doc = (await req.payload.findByID({ collection: 'signature-requests', id, depth: 0, overrideAccess: true })) as Doc
          if (doc.status !== 'draft') throw new SigningError('This has been sent, so the places are fixed.', 409)
          const cleaned = cleanPlaces(b.places, {
            pages: (doc.pages || []) as { width: number; height: number }[],
            partyIds: new Set(((doc.parties || []) as Doc[]).map((p) => String(p.partyId))),
            signerIds: new Set(((doc.signers || []) as Doc[]).map((s) => String(s.id))),
          })
          if (typeof cleaned === 'string') throw new SigningError(cleaned, 400)
          const places = cleaned.map((p) => ({ ...p, id: p.id || rowId() }))
          await req.payload.update({ collection: 'signature-requests', id, overrideAccess: true, context: { signingSystem: true }, data: { places } })
          return Response.json({ ok: true, ids: places.map((p) => p.id) })
        } catch (e) { return fail(e) }
      },
    },
    // The signer's side, reached through the website's own account.
    { path: '/signing/open', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return Response.json(await openForSigner(req.payload, b.token, b.session, visitorOf(b), b.record === true)) } catch (e) { return fail(e) } } },
    { path: '/signing/code', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return Response.json(await sendCode(req.payload, b.token)) } catch (e) { return fail(e) } } },
    { path: '/signing/verify', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return Response.json(await verifyCode(req.payload, b.token, b.code)) } catch (e) { return fail(e) } } },
    { path: '/signing/document', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return pdfResponse(await documentFor(req.payload, b.token, b.session)) } catch (e) { return fail(e) } } },
    { path: '/signing/signed', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return pdfResponse(await documentFor(req.payload, b.token, b.session, true)) } catch (e) { return fail(e) } } },
    { path: '/signing/submit', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return Response.json(await submitSignature(req.payload, b.token, b.session, b, visitorOf(b))) } catch (e) { return fail(e) } } },
    { path: '/signing/decline', method: 'post', handler: async (req) => { try { siteOnly(req); const b = await body(req); return Response.json(await declineToSign(req.payload, b.token, b.session, b.reason, visitorOf(b))) } catch (e) { return fail(e) } } },
  ],
  fields: [
    { name: 'panel', type: 'ui', admin: { components: { Field: './components/SigningPanel#SigningPanel' } } },
    { name: 'title', label: 'Document name', type: 'text', required: true, admin: { description: 'What signers see. Filled in from the file name if left empty.' } },
    { name: 'message', label: 'Note to the signers', type: 'textarea', admin: { description: 'Optional. Goes in the email above the button.' } },
    {
      name: 'signers',
      label: 'Who signs',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Signer', plural: 'Signers' },
      admin: { description: 'Add yourself too if you sign it. Order matters only if "Sign one after another" is ticked.' },
      fields: [
        { type: 'row', fields: [
          { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
          { name: 'email', type: 'email', required: true, admin: { width: '50%' } },
        ] },
        { type: 'row', fields: [
          { name: 'role', type: 'text', admin: { width: '34%', description: 'e.g. Client, Trainee, Witness for the client' } },
          { name: 'organisation', label: 'Company', type: 'text', admin: { width: '33%', description: 'Helps find their column' } },
          { name: 'title', label: 'Job title', type: 'text', admin: { width: '33%', description: 'Printed where the document asks' } },
        ] },
      ],
    },
    { name: 'emailFix', type: 'ui', admin: { components: { Field: './components/SigningEmailFix#SigningEmailFix' } } },
    { name: 'placesEditor', type: 'ui', admin: { components: { Field: './components/SigningPlacesEditor#SigningPlacesEditor' } } },
    { name: 'requireCode', label: 'Ask for a code', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Signers type a six-digit code emailed when they open the link, so a forwarded link is no use to anyone else.' } },
    { name: 'signInOrder', label: 'Sign one after another', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Each signer is emailed only once the one before them has signed.' } },
    { name: 'expiresInDays', label: 'Link works for (days)', type: 'number', defaultValue: 30, min: 1, max: 180, admin: { position: 'sidebar' } },
    { name: 'remindEveryDays', label: 'Remind every (days)', type: 'number', defaultValue: 3, min: 0, max: 30, admin: { position: 'sidebar', description: '0 for never. At most three reminders.' } },
    { name: 'client', type: 'relationship', relationTo: 'clients', admin: { position: 'sidebar', description: 'Optional, for your records.' } },
    { name: 'member', label: 'Team member', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', description: 'Optional, for your records.' } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Not sent', value: 'draft' },
        { label: 'Out for signing', value: 'out' },
        { label: 'Finishing', value: 'completing' },
        { label: 'Signed by everyone', value: 'completed' },
        { label: 'Declined', value: 'declined' },
        { label: 'Withdrawn', value: 'cancelled' },
        { label: 'Expired', value: 'expired' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'reference', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    { name: 'sentAt', type: 'date', admin: { hidden: true } },
    { name: 'expiresAt', type: 'date', admin: { hidden: true } },
    { name: 'completedAt', type: 'date', admin: { hidden: true } },
    { name: 'sentBy', type: 'relationship', relationTo: 'users', admin: { hidden: true } },
    { name: 'originalHash', type: 'text', admin: { hidden: true } },
    { name: 'signedHash', type: 'text', admin: { hidden: true } },
    { name: 'signedFile', type: 'upload', relationTo: 'signed-documents', admin: { hidden: true } },
    { name: 'pages', type: 'json', admin: { hidden: true } },
    {
      name: 'parties',
      type: 'array',
      admin: { hidden: true },
      fields: [
        { name: 'partyId', type: 'text', required: true },
        { name: 'page', type: 'number' },
        { name: 'witness', type: 'checkbox' },
        { name: 'context', type: 'text' },
        { name: 'signerId', type: 'text' },
        { name: 'manual', type: 'checkbox' },
      ],
    },
    {
      name: 'places',
      type: 'array',
      admin: { hidden: true },
      fields: [
        { name: 'page', type: 'number', required: true },
        { name: 'x', type: 'number', required: true },
        { name: 'y', type: 'number', required: true },
        { name: 'width', type: 'number', required: true },
        { name: 'height', type: 'number', required: true },
        { name: 'kind', type: 'select', required: true, options: [...KINDS] },
        { name: 'party', type: 'text', required: true },
        { name: 'context', type: 'text' },
        // Text blanks only: what goes in it, what Ernest typed, and whether a
        // signer must fill it. See lib/signing/places.ts.
        { name: 'label', type: 'text' },
        { name: 'value', type: 'text' },
        { name: 'required', type: 'checkbox' },
      ],
    },
    {
      name: 'events',
      type: 'array',
      admin: { hidden: true },
      fields: [
        { name: 'at', type: 'date', required: true },
        { name: 'text', type: 'text', required: true },
      ],
    },
  ],
}
