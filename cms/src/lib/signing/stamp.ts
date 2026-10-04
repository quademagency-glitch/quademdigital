import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PlaceKind } from './places'

/**
 * Writes the signatures into the document and adds a signing certificate.
 *
 * The original pages are left as they are apart from what goes into each
 * signer's own places (signature, initials, name, date, title) and one small
 * line in the bottom margin carrying the reference. Everything a reader needs
 * to trust the result goes on the certificate at the end: who signed, when,
 * from where, how they were identified, and the fingerprint of the document
 * exactly as it was sent.
 */

export interface StampSigner {
  name: string
  email: string
  role?: string | null
  title?: string | null
  signedAt: Date
  ip?: string | null
  device?: string | null
  codeVerified?: boolean
  /** PNG bytes. */
  signature: Uint8Array
  /** PNG bytes. Optional: initials fall back to the signer's typed initials. */
  initials?: Uint8Array | null
}

export interface StampField {
  page: number
  x: number
  y: number
  width: number
  height: number
  kind: PlaceKind
  signer: number | null
  /** A text blank's words: typed by Ernest before sending, or by its signer. */
  text?: string
  /** Drawn on a placeholder such as "[Client name]", which the words replace. */
  cover?: boolean
}

export interface StampEvent { at: Date; text: string }

export interface StampInput {
  original: Uint8Array
  fields: StampField[]
  signers: StampSigner[]
  title: string
  reference: string
  originalHash: string
  sentAt: Date
  completedAt: Date
  events: StampEvent[]
}

const INK = rgb(0.06, 0.09, 0.16)
const MUTED = rgb(0.42, 0.45, 0.5)
const RULE = rgb(0.85, 0.87, 0.9)
const ACCENT = rgb(0, 0.43, 0.62)

/** "4 October 2026", in Accra, which is GMT all year. */
export const longDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' }).format(d)
export const stampTime = (d: Date) =>
  `${longDate(d)}, ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Africa/Accra' }).format(d)} GMT`

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 3)

/**
 * Standard fonts only carry the Windows Latin set. A name with a character
 * outside it would make pdf-lib throw and lose the whole document, so such
 * characters are replaced rather than allowed to fail the signing.
 */
const safe = (font: PDFFont, text: string) =>
  [...text].map((ch) => { try { font.encodeText(ch); return ch } catch { return '?' } }).join('')

const fitText = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  let t = safe(font, text)
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -2) + '…'
  return t
}

/** Lines no wider than maxWidth, broken between words. */
const wrap = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  const out: string[] = []
  let cur = ''
  for (const word of safe(font, text).split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && font.widthOfTextAtSize(next, size) > maxWidth) { out.push(cur); cur = word }
    else cur = next
  }
  if (cur) out.push(cur)
  return out.map((l) => fitText(font, l, size, maxWidth))
}

/**
 * Words typed into a blank. A blank in a contract is read as written, so they
 * are never cut short: they shrink to fit, wrap onto more lines when the place
 * is tall enough, and when even the smallest size will not fit they carry on
 * below the place rather than end in an ellipsis.
 */
function drawBlank(page: PDFPage, font: PDFFont, text: string, f: StampField) {
  const max = f.width - 4
  for (let size = Math.min(10.5, Math.max(7, f.height * 0.72)); size >= 5.5; size -= 0.5) {
    const lines = wrap(font, text, size, max)
    const fitsWide = lines.every((l) => !l.endsWith('…'))
    if (fitsWide && (lines.length === 1 || lines.length * size * 1.15 <= f.height)) {
      lines.forEach((l, k) => page.drawText(l, { x: f.x + 2, y: f.y + 2.5 + (lines.length - 1 - k) * size * 1.15, size, font, color: INK }))
      return
    }
  }
  // Broken between words only, and a word longer than the place is printed
  // whole: running past the box is better than losing a character.
  const lines: string[] = []
  let cur = ''
  for (const word of safe(font, text).split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && font.widthOfTextAtSize(next, 5.5) > max) { lines.push(cur); cur = word }
    else cur = next
  }
  if (cur) lines.push(cur)
  lines.forEach((l, k) => page.drawText(l, { x: f.x + 2, y: f.y + f.height - 6 - k * 6.3, size: 5.5, font, color: INK }))
}

function drawFitted(page: PDFPage, img: { width: number; height: number }, embedded: Parameters<PDFPage['drawImage']>[0], f: StampField) {
  const pad = 1.5
  const scale = Math.min((f.width - pad * 2) / img.width, (f.height - pad) / img.height)
  const w = img.width * scale, h = img.height * scale
  // Sit on the line, from the left, as a pen would.
  page.drawImage(embedded, { x: f.x + pad, y: f.y + pad * 0.5, width: w, height: h })
}

export async function stampDocument(input: StampInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.original, { updateMetadata: false })
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages = pdf.getPages()
  const originalCount = pages.length

  const sigImages = await Promise.all(input.signers.map((s) => pdf.embedPng(s.signature)))
  const iniImages = await Promise.all(input.signers.map((s) => (s.initials ? pdf.embedPng(s.initials) : null)))

  for (const f of input.fields) {
    if (f.kind === 'text') {
      const page = pages[f.page - 1]
      if (f.text && page) {
        if (f.cover) page.drawRectangle({ x: f.x, y: f.y, width: f.width, height: f.height, color: rgb(1, 1, 1) })
        drawBlank(page, helv, f.text, f)
      }
      continue
    }
    if (f.signer == null) continue
    const s = input.signers[f.signer]
    const page = pages[f.page - 1]
    if (!s || !page) continue
    if (f.kind === 'signature') {
      drawFitted(page, sigImages[f.signer], sigImages[f.signer], f)
    } else if (f.kind === 'initials') {
      const img = iniImages[f.signer]
      if (img) drawFitted(page, img, img, f)
      else {
        const size = Math.min(10, f.height * 0.8)
        page.drawText(safe(bold, initialsOf(s.name)), { x: f.x + 2, y: f.y + 2, size, font: bold, color: INK })
      }
    } else {
      const text = f.kind === 'name' ? s.name : f.kind === 'date' ? longDate(s.signedAt) : s.title || ''
      if (!text) continue
      const size = Math.min(10.5, Math.max(7, f.height * 0.72))
      page.drawText(fitText(helv, text, size, f.width - 4), { x: f.x + 2, y: f.y + 2.5, size, font: helv, color: INK })
    }
  }

  // One line in the margin of every original page, so a printed page can be
  // matched to its certificate.
  const footer = `Signed electronically · Ref ${input.reference} · certificate on page ${originalCount + 1}`
  for (const page of pages) {
    const { width } = page.getSize()
    const size = 6
    const t = safe(helv, footer)
    page.drawText(t, { x: (width - helv.widthOfTextAtSize(t, size)) / 2, y: 9, size, font: helv, color: MUTED })
  }

  await addCertificate(pdf, input, helv, bold, sigImages, originalCount)
  return pdf.save()
}

async function addCertificate(
  pdf: PDFDocument,
  input: StampInput,
  helv: PDFFont,
  bold: PDFFont,
  sigImages: Awaited<ReturnType<PDFDocument['embedPng']>>[],
  originalCount: number,
) {
  const W = 595.28, H = 841.89, M = 56
  let page = pdf.addPage([W, H])
  let y = H - M
  const line = (text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) => {
    const size = opts.size ?? 9.5
    const font = opts.font ?? helv
    const lines = wrap(font, text, size, W - M - (opts.x ?? M))
    lines.forEach((t, k) => {
      if (y < M + size + 10) { page = pdf.addPage([W, H]); y = H - M }
      page.drawText(t, { x: opts.x ?? M, y, size, font, color: opts.color ?? INK })
      y -= size + (k === lines.length - 1 ? (opts.gap ?? 5) : 3)
    })
  }
  const rule = () => { page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.6, color: RULE }); y -= 12 }

  line('Signing certificate', { size: 18, font: bold, gap: 6 })
  line(`This page completes "${input.title}". It records who signed it, when, and how each person was identified.`, { color: MUTED, gap: 16 })

  const kv = (k: string, v: string) => {
    if (y < M + 20) { page = pdf.addPage([W, H]); y = H - M }
    page.drawText(safe(helv, k), { x: M, y, size: 8.5, font: helv, color: MUTED })
    page.drawText(fitText(helv, v, 9, W - M - (M + 120)), { x: M + 120, y, size: 9, font: helv, color: INK })
    y -= 14
  }
  kv('Reference', input.reference)
  kv('Document', input.title)
  kv('Pages', `${originalCount}, plus this certificate`)
  kv('Sent', stampTime(input.sentAt))
  kv('Completed', stampTime(input.completedAt))
  y -= 4
  line('Fingerprint of the document as it was sent (SHA-256)', { size: 8.5, color: MUTED, gap: 3 })
  line(input.originalHash, { size: 8, font: helv, gap: 4 })
  line('Recompute this over the original file to confirm it is the document these people signed.', { size: 7.5, color: MUTED, gap: 14 })
  rule()

  line('Signatures', { size: 12, font: bold, gap: 10 })
  for (let i = 0; i < input.signers.length; i++) {
    const s = input.signers[i]
    if (y < M + 120) { page = pdf.addPage([W, H]); y = H - M }
    const img = sigImages[i]
    const boxW = 170, boxH = 56
    page.drawRectangle({ x: M, y: y - boxH + 8, width: boxW, height: boxH, borderColor: RULE, borderWidth: 0.6 })
    const scale = Math.min((boxW - 12) / img.width, (boxH - 10) / img.height)
    page.drawImage(img, { x: M + 6, y: y - boxH + 13, width: img.width * scale, height: img.height * scale })
    const x = M + boxW + 18
    const top = y
    page.drawText(fitText(bold, s.name, 10.5, W - M - x), { x, y: top, size: 10.5, font: bold, color: INK })
    const rows = [
      [s.role, s.title].filter(Boolean).join(' · '),
      s.email,
      `Signed ${stampTime(s.signedAt)}`,
      `Identified by a private link sent to this email address${s.codeVerified ? ', and a one-time code sent there and entered correctly' : ''}`,
      [s.ip ? `IP address ${s.ip}` : '', s.device || ''].filter(Boolean).join(' · '),
    ].filter(Boolean) as string[]
    let ry = top - 13
    rows.forEach((r, k) => {
      for (const t of wrap(helv, r, 8, W - M - x)) {
        page.drawText(t, { x, y: ry, size: 8, font: helv, color: k === 0 && (s.role || s.title) ? ACCENT : MUTED })
        ry -= 11
      }
    })
    y -= Math.max(boxH + 6, top - ry + 8)
    y -= 6
  }
  rule()

  line('What happened', { size: 12, font: bold, gap: 8 })
  for (const e of input.events) {
    if (y < M + 14) { page = pdf.addPage([W, H]); y = H - M }
    page.drawText(safe(helv, stampTime(e.at)), { x: M, y, size: 7.8, font: helv, color: MUTED })
    page.drawText(fitText(helv, e.text, 8, W - M - (M + 150)), { x: M + 150, y, size: 8, font: helv, color: INK })
    y -= 12
  }
  y -= 10
  line('Signed electronically through Quadem Digital Enterprise, quademdigital.com.', { size: 7.5, color: MUTED })
}
