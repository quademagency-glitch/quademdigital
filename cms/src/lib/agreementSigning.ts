import fs from 'node:fs/promises'
import path from 'node:path'
import type { PayloadRequest, TaskConfig } from 'payload'
import { audit } from './audit'
import { adminIds, notify } from './notify'
import { readUpload } from './signing/files'
import { sendRequest } from './signing/flow'
import { SIGNER_PREFIX } from './signing/places'
import { reportProblem } from './problems'

/**
 * The service agreement a new client gets, signed online.
 *
 * Onboarding writes the agreement (the website's client-won route) and, a
 * couple of hours after the welcome email, sends it. It used to go as a PDF
 * attachment to print, sign and email back, with nothing to say whether it
 * ever came back. Now it goes out through electronic signing (lib/signing):
 * the client signs first, then Ernest countersigns, and both get the signed
 * copy with its certificate. The request is linked to the client, so the
 * client's page in the team portal shows where it stands.
 *
 * The agreement's signature section is laid out so the signing detector finds
 * a column for each party and matches it to the right person
 * (src/lib/agreementPdf.ts on the site). If that ever fails, nothing is sent
 * and Ernest is told to check it in Documents to sign.
 *
 * AGREEMENT_SIGN_ONLINE=off on the CMS puts the old emailed PDF back.
 */

export const signOnline = () => process.env.AGREEMENT_SIGN_ONLINE !== 'off'
/** How long after the welcome email the agreement goes, as before. */
export const agreementDelayMs = () => Math.max(0, Number(process.env.AGREEMENT_DELAY_HOURS ?? 2)) * 60 * 60 * 1000
export const agreementTitle = (business: string) => `Service Agreement, ${business}`.slice(0, 140)

const SERVICE: Record<string, string> = {
  'web-design': 'web design',
  'digital-marketing': 'digital marketing',
  branding: 'branding',
  'video-production': 'AI video and reels',
  'seo-paid-ads': 'SEO and paid ads',
  'social-media': 'social media management',
  multiple: 'project',
  custom: 'custom project',
}

type Doc = Record<string, any>

/** The agreement PDF onboarding stored. On a laptop, from the upload folder. */
async function agreementBytes(doc: Doc): Promise<Uint8Array> {
  if (process.env.S3_DOCUMENTS_BUCKET) return readUpload(doc, 'onboarding-documents')
  return new Uint8Array(await fs.readFile(path.resolve(process.cwd(), 'media/onboarding', String(doc.filename))))
}

/** The founder, who countersigns and is the sender. */
async function founder(req: PayloadRequest): Promise<Doc | null> {
  const email = (process.env.CMS_FROM_ADDRESS || 'ernest@quademdigital.com').toLowerCase()
  const exact = await req.payload.find({ collection: 'users', where: { and: [{ role: { equals: 'admin' } }, { email: { equals: email } }] }, limit: 1, depth: 0, overrideAccess: true, req })
  if (exact.docs[0]) return exact.docs[0] as Doc
  const any = await req.payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, sort: 'createdAt', limit: 1, depth: 0, overrideAccess: true, req })
  return (any.docs[0] as Doc) ?? null
}

/** Each signer has a signature place of their own, and every column has its person. */
export function placesReady(request: Doc): string | null {
  const signers = (request.signers || []) as Doc[]
  const parties = (request.parties || []) as Doc[]
  const places = (request.places || []) as Doc[]
  if (!parties.length) return 'No signature section was found in the agreement.'
  if (parties.some((p) => !p.witness && !p.signerId)) return 'A signature column could not be matched to the client or to you.'
  const ownerOf = (party: string) => (party.startsWith(SIGNER_PREFIX) ? party.slice(SIGNER_PREFIX.length) : parties.find((p) => p.partyId === party)?.signerId ?? null)
  for (const s of signers) {
    if (!places.some((p) => p.kind === 'signature' && String(ownerOf(String(p.party))) === String(s.id))) return `There is no place for ${s.name} to sign.`
  }
  return null
}

export type AgreementResult = { ok: boolean; requestId?: number | string; already?: boolean; reason?: string }

/**
 * Make the signing request from the stored agreement and send it. Safe to run
 * twice: an agreement already out, or signed, for this client is left alone.
 */
export async function sendAgreementForSigning(req: PayloadRequest, clientId: number | string, documentId: number | string, readBytes = agreementBytes): Promise<AgreementResult> {
  const payload = req.payload
  const client = (await payload.findByID({ collection: 'clients', id: clientId, depth: 0, overrideAccess: true, req, disableErrors: true })) as Doc | null
  if (!client) return { ok: false, reason: 'The client is not there any more.' }
  if (['lost', 'on-hold'].includes(String(client.pipelineStatus))) return { ok: false, reason: `The client is ${client.pipelineStatus}, so the agreement was not sent.` }
  const title = agreementTitle(String(client.clientName || 'Client'))

  const earlier = await payload.find({
    collection: 'signature-requests',
    where: { and: [{ client: { equals: client.id } }, { title: { equals: title } }, { status: { in: ['draft', 'out', 'completing', 'completed'] } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const existing = earlier.docs[0] as Doc | undefined
  if (existing && existing.status !== 'draft') return { ok: true, already: true, requestId: existing.id }

  const sender = await founder(req)
  if (!sender) return { ok: false, reason: 'No founder account to send it from.' }
  const name = String(client.contactName || client.clientName || '').trim()
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(client.clientEmail || ''))) return { ok: false, reason: 'The client has no name or email address to send it to.' }

  let request = existing
  if (!request) {
    const doc = (await payload.findByID({ collection: 'onboarding-documents', id: documentId, depth: 0, overrideAccess: true, req, disableErrors: true })) as Doc | null
    if (!doc?.filename) return { ok: false, reason: 'The written agreement is not there.' }
    const bytes = await readBytes(doc)
    const note = String(client.emailNotes?.contract || '').trim()
    request = (await payload.create({
      collection: 'signature-requests',
      data: {
        title,
        message: [
          `Here is your Service Agreement for your ${SERVICE[String(client.service)] ?? 'project'} with Quadem Digital. Please read it and sign it online; it takes a minute on your phone. We begin work once it is signed, and you will both get the signed copy.`,
          note,
        ]
          .filter(Boolean)
          .join('\n\n'),
        signers: [
          { name, email: String(client.clientEmail).trim(), role: 'Client', organisation: client.clientName || null },
          { name: sender.name || 'Ernest Avorwlanu', email: sender.email, role: 'Service Provider', organisation: 'Quadem Digital Enterprise', title: 'Founder' },
        ],
        signInOrder: true,
        requireCode: false,
        expiresInDays: 30,
        remindEveryDays: 3,
        client: client.id,
      } as never,
      file: { data: Buffer.from(bytes), mimetype: 'application/pdf', name: String(doc.filename).replace(/\.pdf$/i, '') + '.pdf', size: bytes.byteLength },
      overrideAccess: true,
    })) as unknown as Doc
  }

  const notReady = placesReady(request)
  if (notReady) {
    await notify(req, {
      to: await adminIds(req),
      kind: 'signing',
      title: `${client.clientName}’s agreement needs you before it goes`,
      body: `${notReady} Check it in Documents to sign, then send it.`,
      link: `/clients/${client.id}`,
      key: `agreement-review:${request.id}`,
      important: true,
      action: 'Open the client',
    })
    await audit(req, { action: 'agreement.held', summary: `Agreement for ${client.clientName} held for a check: ${notReady}`, subjectType: 'signature-requests', subjectId: request.id })
    return { ok: false, requestId: request.id, reason: notReady }
  }

  const sent = await sendRequest(payload, request.id, sender)
  await notify(req, {
    to: await adminIds(req),
    kind: 'signing',
    title: `${client.clientName}’s agreement is out for signing`,
    body: `${name} signs first, then you countersign; you will get an email when it is your turn.${sent.failed.length ? ` The email to ${sent.failed.join(', ')} failed: send them the link from the client’s page.` : ''}`,
    link: `/clients/${client.id}`,
    key: `agreement-sent:${request.id}`,
    email: false,
    action: 'Open the client',
  })
  await audit(req, { action: 'agreement.sent', summary: `Agreement sent to ${name} at ${client.clientName} for signing`, subjectType: 'signature-requests', subjectId: request.id })
  return { ok: true, requestId: request.id }
}

export const agreementSigningTask: TaskConfig<any> = {
  slug: 'sendAgreementForSigning',
  retries: 2,
  inputSchema: [
    { name: 'clientId', type: 'text', required: true },
    { name: 'documentId', type: 'text', required: true },
  ],
  outputSchema: [{ name: 'ok', type: 'checkbox', required: true }],
  handler: async ({ input, req }: any) => {
    const r = await sendAgreementForSigning(req, input.clientId, input.documentId)
    if (!r.ok && !r.requestId) await reportProblem(req, `agreement-send:${input.clientId}`, 'A new client\'s agreement could not be sent for signing', r.reason)
    return { output: { ok: r.ok } }
  },
}
