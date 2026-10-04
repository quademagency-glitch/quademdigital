/**
 * End-to-end test of electronic signing on production, using test inboxes.
 *
 * It makes its own one-page PDF with two signature blocks, so no client
 * document is involved, and sends it to two of Resend's test addresses, which
 * accept mail and deliver it nowhere. The signer side is driven separately, in
 * a browser on the live site, between `send` and `finish`.
 *
 *   tsx cms/scripts/signing-live-test.ts                      dry run: build the PDF, run detection and matching, write nothing
 *   ... send --links <file> --confirm                         create the request and email both links; links are written to <file>
 *   ... finish <id> [--out <dir>]                             read only: report where the request has got to
 *   ... finish <id> --out <dir> --confirm                     wait for the signed copy, check it, then delete everything the test made
 *   ... cleanup <id> --confirm                                delete a test request an interrupted run left behind
 *
 * Every step except the dry run needs production's settings, so run it from the
 * repository root through Railway:
 *
 *   railway run --service quademdigital cms/node_modules/.bin/tsx --tsconfig cms/tsconfig.json cms/scripts/signing-live-test.ts <step> ...
 *
 * Two emails reach a real inbox: the "has signed" notice and the finished copy
 * go to the sender, and a request sent from here has no named sender, so they
 * go to CMS_FROM_ADDRESS.
 *
 * Deleting refuses anything that is not this test's own request: the title has
 * to match and every signer has to be a resend.dev test address.
 */
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Payload } from 'payload'
import { assignParties } from '../src/lib/signing/assign'
import { detectSignatureFields } from '../src/lib/signing/detect'

const TITLE = 'Signing system test (automated, deleted afterwards)'
const SIGNERS = [
  { name: 'Test Signer One', email: 'delivered+signing-alpha@resend.dev', role: 'Client', organisation: 'Alpha Test Ltd' },
  { name: 'Test Signer Two', email: 'delivered+signing-beta@resend.dev', role: 'Client', organisation: 'Beta Test Ltd' },
]
const isTestSigner = (email: string) => /@resend\.dev$/i.test(email.trim())

const args = process.argv.slice(2)
const step = args[0] && !args[0].startsWith('--') ? args[0] : 'dry-run'
const confirm = args.includes('--confirm')
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const fail = (message: string): never => {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

async function buildPdf() {
  const pdf = await PDFDocument.create()
  pdf.setTitle(TITLE)
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.1, 0.1, 0.12)
  page.drawText('Signing system test', { x: 60, y: 770, size: 20, font: bold, color: ink })
  const body = [
    'This document was made by an automated test of the electronic signing system.',
    'It is not an agreement. It is deleted, with everything the test created, when the',
    'test finishes.',
  ]
  body.forEach((line, i) => page.drawText(line, { x: 60, y: 730 - i * 16, size: 11, font: regular, color: ink }))
  for (const [x, heading] of [[60, 'FOR ALPHA TEST LTD'], [320, 'FOR BETA TEST LTD']] as const) {
    page.drawText(heading, { x, y: 380, size: 11, font: bold, color: ink })
    page.drawLine({ start: { x, y: 320 }, end: { x: x + 210, y: 320 }, thickness: 0.8, color: ink })
    page.drawText('Signature', { x, y: 307, size: 9, font: regular, color: ink })
    page.drawText('Name: ______________________________', { x, y: 270, size: 10, font: regular, color: ink })
    page.drawText('Date: ______________________________', { x, y: 240, size: 10, font: regular, color: ink })
  }
  return Buffer.from(await pdf.save())
}

async function dryRun() {
  const bytes = await buildPdf()
  const out = opt('--out')
  if (out) fs.writeFileSync(path.join(out, 'signing-test.pdf'), bytes)
  const det = await detectSignatureFields(bytes)
  const who = assignParties(det, SIGNERS)
  console.log(`Detection: ${det.fields.length} places, ${det.parties.length} parties`)
  for (const p of det.parties) console.log(`  ${p.id}  ->  ${who[p.id] == null ? 'nobody' : SIGNERS[who[p.id]!].name}   (${p.context.slice(0, 60)})`)
  for (const f of det.fields) console.log(`  ${f.kind.padEnd(9)} ${f.party.padEnd(8)} x${Math.round(f.x)} y${Math.round(f.y)} w${Math.round(f.width)}`)
  const sig = det.fields.filter((f) => f.kind === 'signature')
  const placed = new Set(sig.map((f) => who[f.party]).filter((v) => v != null))
  if (sig.length !== 2 || placed.size !== 2) fail('Expected one signature place for each of the two test signers.')
  console.log('\nDry run only: nothing was written. Add `send --links <file> --confirm` to run it for real.')
}

async function boot(): Promise<Payload> {
  if (!process.env.PAYLOAD_SECRET || !process.env.S3_DOCUMENTS_BUCKET) fail('Run this through `railway run --service quademdigital` so it has production settings.')
  // The config picks Postgres only in production, and Railway's DATABASE_URL
  // is an internal host this machine cannot reach.
  ;(process.env as Record<string, string>).NODE_ENV = 'production'
  if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL
  const { default: payload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  // No `cron: true`: the job queue must not start on this machine.
  await payload.init({ config, disableOnInit: true })
  return payload
}

async function send(payload: Payload) {
  const linksFile = opt('--links')
  if (!linksFile) fail('Give a file for the links: --links <file>.')
  const { sendRequest } = await import('../src/lib/signing/flow')
  const bytes = await buildPdf()
  const doc = (await payload.create({
    collection: 'signature-requests',
    overrideAccess: true,
    data: {
      title: TITLE,
      message: 'Automated test. Nobody needs to do anything.',
      signers: SIGNERS,
      requireCode: false,
      signInOrder: false,
      expiresInDays: 1,
      remindEveryDays: 0,
    } as never,
    file: { data: bytes, mimetype: 'application/pdf', name: 'signing-system-test.pdf', size: bytes.length },
  })) as Record<string, any>
  console.log(`Created request ${doc.id}: ${doc.places?.length ?? 0} places, parties ${JSON.stringify((doc.parties || []).map((p: any) => [p.partyId, p.signerId]))}`)
  const unassigned = (doc.parties || []).filter((p: any) => !p.signerId)
  if (unassigned.length) fail(`Detection left ${unassigned.length} part(ies) without a signer. Request ${doc.id} is still a draft; remove it with: cleanup ${doc.id} --confirm`)
  const result = await sendRequest(payload, doc.id, null as never)
  fs.writeFileSync(linksFile!, JSON.stringify({ id: doc.id, links: result.links }, null, 2))
  console.log(`Sent request ${doc.id}. Emails failed: ${result.failed.length ? result.failed.join(', ') : 'none'}. Links written to ${linksFile}.`)
}

const s3 = () => new S3Client({
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || undefined,
})
const stillStored = async (doc: { prefix?: string | null; filename?: string | null }) => {
  if (!doc.filename) return false
  try {
    await s3().send(new HeadObjectCommand({ Bucket: process.env.S3_DOCUMENTS_BUCKET, Key: doc.prefix ? `${doc.prefix}/${doc.filename}` : doc.filename }))
    return true
  } catch {
    return false
  }
}

async function loadTestRequest(payload: Payload, id: string) {
  const req = (await payload.findByID({ collection: 'signature-requests', id, depth: 0, overrideAccess: true }).catch(() => null)) as Record<string, any> | null
  if (!req) fail(`There is no signature request ${id}.`)
  const signers = (req!.signers || []) as { email: string }[]
  if (req!.title !== TITLE || !signers.length || !signers.every((s) => isTestSigner(s.email))) {
    fail(`Request ${id} is not this test's request (title "${req!.title}"). Refusing to touch it.`)
  }
  return req!
}

async function finish(payload: Payload, id: string) {
  const { requestStatus } = await import('../src/lib/signing/flow')
  const { openToken, sha256 } = await import('../src/lib/signing/tokens')
  const { readUpload } = await import('../src/lib/signing/files')
  const { SITE_URL } = await import('../src/lib/signing/flow')
  await loadTestRequest(payload, id)

  let status = await requestStatus(payload, id)
  console.log(`Request ${id} is "${status.status}": ${status.signers.map((s: any) => `${s.name} ${s.status}`).join(', ')}`)
  if (!confirm) return console.log('Read only. Add --confirm to wait for the signed copy, check it and delete the test.')

  const until = Date.now() + 7 * 60_000
  while (status.status !== 'completed' && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 10_000))
    status = await requestStatus(payload, id)
    process.stdout.write(`  ${new Date().toISOString().slice(11, 19)} ${status.status}\n`)
  }
  const req = (await payload.findByID({ collection: 'signature-requests', id, depth: 1, overrideAccess: true })) as Record<string, any>
  const checks: [string, boolean, string?][] = []
  checks.push(['the request finished', req.status === 'completed', req.status])
  if (req.status !== 'completed') {
    for (const e of (req.events || []).slice(-4)) console.log(`  history: ${e.text}`)
  }
  const sessions = (await payload.find({ collection: 'signing-sessions', where: { request: { equals: id } }, depth: 0, overrideAccess: true, showHiddenFields: true })).docs as Record<string, any>[]
  checks.push(['both signers are recorded as signed', sessions.length === 2 && sessions.every((s) => s.status === 'signed'), sessions.map((s) => s.status).join(', ')])
  checks.push(['each signature has an IP address and a device', sessions.every((s) => s.ip && s.device && s.signature), sessions.map((s) => `${s.ip ?? '-'} / ${s.device ?? '-'}`).join('; ')])
  const original = await readUpload(req, 'signature-requests')
  checks.push(['the original PDF is unchanged since it was sent', sha256(original) === req.originalHash])
  const signedDoc = req.signedFile && typeof req.signedFile === 'object' ? req.signedFile : null
  if (signedDoc) {
    const bytes = await readUpload(signedDoc, 'signed-documents')
    const hash = sha256(bytes)
    checks.push(['the stored signed copy matches its fingerprint', hash === req.signedHash && hash === signedDoc.hash])
    const [before, after] = await Promise.all([PDFDocument.load(original), PDFDocument.load(bytes)])
    checks.push(['the signed copy has the certificate page added', after.getPageCount() === before.getPageCount() + 1, `${before.getPageCount()} -> ${after.getPageCount()} pages`])
    const out = opt('--out')
    if (out) fs.writeFileSync(path.join(out, 'signing-test-signed.pdf'), bytes)
    const token = openToken(sessions[0]?.tokenSealed)
    if (token) {
      const res = await fetch(`${SITE_URL()}/sign/${token}/signed/`)
      const body = Buffer.from(await res.arrayBuffer())
      checks.push(['a signer can download the signed copy from the website', res.ok && sha256(new Uint8Array(body)) === hash, `${res.status} ${res.headers.get('content-type')}`])
    }
  } else {
    checks.push(['a signed copy was stored', false])
  }
  console.log('')
  for (const [what, ok, detail] of checks) console.log(`${ok ? '✓' : '✗'} ${what}${detail ? `  (${detail})` : ''}`)
  console.log('')
  await cleanup(payload, id)
  if (checks.some(([, ok]) => !ok)) process.exit(1)
}

async function cleanup(payload: Payload, id: string) {
  const req = await loadTestRequest(payload, id)
  const signed = (await payload.find({ collection: 'signed-documents', where: { request: { equals: id } }, depth: 0, overrideAccess: true })).docs as Record<string, any>[]
  const sessions = (await payload.find({ collection: 'signing-sessions', where: { request: { equals: id } }, depth: 0, overrideAccess: true })).docs
  console.log(`To delete: request ${id} and its PDF, ${sessions.length} signing session(s), ${signed.length} signed cop(ies) and their files.`)
  if (!confirm) return console.log('Read only. Add --confirm to delete them.')

  for (const d of signed) await payload.delete({ collection: 'signed-documents', id: d.id, overrideAccess: true })
  await payload.delete({ collection: 'signing-sessions', where: { request: { equals: id } }, overrideAccess: true })
  // Sent and signed requests are refused deletion on purpose; this one is a
  // test, so step it out of that state without running the hooks first.
  await payload.db.updateOne({ collection: 'signature-requests', id, data: { status: 'cancelled' }, returning: false } as never)
  await payload.delete({ collection: 'signature-requests', id, overrideAccess: true })

  const left = {
    request: (await payload.find({ collection: 'signature-requests', where: { id: { equals: id } }, overrideAccess: true })).totalDocs,
    sessions: (await payload.find({ collection: 'signing-sessions', where: { request: { equals: id } }, overrideAccess: true })).totalDocs,
    signed: (await payload.find({ collection: 'signed-documents', where: { request: { equals: id } }, overrideAccess: true })).totalDocs,
    originalFile: await stillStored(req),
    signedFiles: (await Promise.all(signed.map(stillStored))).filter(Boolean).length,
  }
  const clean = !left.request && !left.sessions && !left.signed && !left.originalFile && !left.signedFiles
  console.log(`${clean ? '✓' : '✗'} deleted: ${JSON.stringify(left)}`)

  // So the first real request is QDS-<year>-0001 rather than numbered after the test.
  const pool = (payload.db as unknown as { pool: { query: (q: string) => Promise<{ rows: any[] }> } }).pool
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "signature_requests"`)
  if (rows[0].n === 0) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('"signature_requests"', 'id'), 1, false)`)
    console.log('✓ no requests remain, so numbering starts again at 1')
  }
  if (!clean) process.exit(1)
}

if (step === 'dry-run') {
  await dryRun()
  process.exit(0)
}
if (!['send', 'finish', 'cleanup'].includes(step)) fail(`Unknown step "${step}".`)
if (step === 'send' && !confirm) {
  await dryRun()
  process.exit(0)
}
const payload = await boot()
const id = args[1]
if (step === 'send') await send(payload)
else if (!id || !/^\d+$/.test(id)) fail('Give the request id.')
else if (step === 'finish') await finish(payload, id)
else await cleanup(payload, id)
process.exit(0)
