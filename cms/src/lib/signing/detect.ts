/**
 * Finds the places in a PDF where people are meant to sign, and works out whose
 * place each one is.
 *
 * Quadem's documents already carry their own signature section, so the signing
 * flow uses it rather than drawing boxes by hand. Three layouts exist in the
 * real documents, and each is handled:
 *
 *   Omek service agreement   a "Signature" label BELOW a drawn line, two columns
 *                            headed SERVICE PROVIDER and CLIENT
 *   Citywide agreement       inline blanks: "Signature: ______", "Date: ______"
 *                            under "For Quadem Digital Enterprise" / "For Citywide..."
 *   Business Development     letter-spaced labels ("S I G N AT U R E") ABOVE an
 *   Agreement (Charles)      empty space, a witness block under each party, and
 *                            "Initials: Company ____ Trainee ____" on every page
 *
 * The signature lines themselves are drawn shapes, not text, so the labels are
 * what is read. For a label on its own, the empty band beside it (above or
 * below, whichever is wider) is where the signature goes. For a label followed
 * by underscores, the underscores are the place.
 *
 * Everything is in PDF points with the origin at the bottom left, the same
 * space pdf-lib draws in and pdf.js converts from, so nothing is translated
 * between finding a place and filling it.
 */

import { SENDER } from './places'

export type FieldKind = 'signature' | 'initials' | 'name' | 'date' | 'title' | 'text'

export interface DetectedField {
  page: number
  x: number
  y: number
  width: number
  height: number
  kind: FieldKind
  /** Which party this place belongs to: a column, or an initials key. */
  party: string
  /** Where this place came from, in words, for the admin screen. */
  context: string
  /** For a text blank: the words before it, which say what goes in it. */
  label?: string
}

export interface DetectedParty {
  id: string
  page: number
  witness: boolean
  /** Every word near the party's column: headings, company names, a filled-in name. */
  context: string
}

export interface Detection {
  pages: { width: number; height: number }[]
  fields: DetectedField[]
  parties: DetectedParty[]
}

interface Item { str: string; x: number; y: number; w: number; h: number }
interface Segment { text: string; items: Item[]; x: number; x2: number; y: number; h: number }
interface Run { x: number; x2: number; y: number; h: number; before: string }
interface Rule { x1: number; x2: number; y: number }
/** A signature block's column, so a blank inside it goes to that block's person. */
interface Block { x0: number; x1: number; lo: number; hi: number; witnessY: number; party: string; witnessParty: string | null }

const SAME_LINE = 2.5
const COLUMN_GAP = 14

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * "S I G N E D  F O R" reads as "SIGNED FOR". Letter-spacing comes one word per
 * item, and kerning sometimes leaves a pair together ("S I G N AT U R E"), so a
 * word counts as spaced when every piece is one or two letters.
 */
const despace = (s: string) => {
  const parts = s.trim().split(' ')
  return parts.length > 1 && parts.every((t) => t.length > 0 && t.length <= 2) ? parts.join('') : s
}
const readable = (seg: Segment) =>
  seg.items.map((i) => despace(i.str.trim())).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

/** Uppercase letters and digits only, so "S I G N AT U R E" reads as SIGNATURE. */
const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

const LABELS: { kind: FieldKind | 'witness'; re: RegExp }[] = [
  // Ends in SIGNATURE or SIGNATORY, so "Client signature" counts and the
  // section heading "Signatures" does not.
  { kind: 'signature', re: /^[A-Z]{0,24}(SIGNATURE|SIGNATORY)$|^(SIGNED|SIGNHERE)$/ },
  { kind: 'initials', re: /^INITIALS?$/ },
  { kind: 'date', re: /^(DATE|DATED|DATESIGNED|SIGNEDDATE|SIGNINGDATE)$/ },
  { kind: 'name', re: /^(NAME|FULLNAME|PRINTNAME|PRINTEDNAME|NAMEINFULL)$/ },
  { kind: 'title', re: /^(TITLE|POSITION|DESIGNATION|ROLE|JOBTITLE|CAPACITY)$/ },
  { kind: 'witness', re: /^(WITNESS|WITNESSES|WITNESSEDBY|INTHEPRESENCEOF)$/ },
]

/** The part of a segment that names it: up to a colon, or the whole thing. */
const splitLabel = (text: string) => {
  const i = text.indexOf(':')
  return i === -1 ? { label: text, rest: '' } : { label: text.slice(0, i), rest: text.slice(i + 1) }
}

const classify = (seg: Segment) => {
  const { label, rest } = splitLabel(seg.text)
  const c = compact(label)
  if (!c || c.length > 30) return null
  for (const l of LABELS) if (l.re.test(c)) return { kind: l.kind, rest, witnessLabel: /WITNESS/.test(c) }
  return null
}

/**
 * Where the underscore runs in a segment sit on the page. pdf.js gives one
 * width for a whole item, so it is shared out: ordinary letters at about half
 * the font size each, and the underscores take what is left. Assuming the
 * underscore's width instead put Citywide's runs 40pt too far left, because
 * its font draws underscores at 0.42em where Helvetica uses 0.56em. An item
 * that is nothing but underscores needs no estimate at all.
 */
const findRuns = (seg: Segment): Run[] => {
  const runs: Run[] = []
  let before = ''
  for (const it of seg.items) {
    const parts = it.str.split(/(_{3,})/)
    const nU = parts.filter((p) => /^_{3,}$/.test(p)).reduce((n, p) => n + p.length, 0)
    if (!nU) { before += ' ' + it.str; continue }
    const nO = it.str.length - nU
    let ow = nO ? it.h * 0.5 : 0
    let uw = (it.w - nO * ow) / nU
    if (uw < it.h * 0.3 || uw > it.h * 0.65) {
      uw = it.h * 0.5
      ow = nO ? Math.max(0, (it.w - nU * uw) / nO) : 0
    }
    let x = it.x
    for (const p of parts) {
      if (/^_{3,}$/.test(p)) {
        runs.push({ x, x2: x + p.length * uw, y: it.y, h: it.h, before: before.trim() })
        before = ''
        x += p.length * uw
      } else {
        before += ' ' + p
        x += p.length * ow
      }
    }
  }
  return runs
}

const loadPdfjs = async () => {
  // The legacy build runs in Node without a worker thread or a canvas.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjs
}

async function readPages(data: Uint8Array) {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data, verbosity: 0, isEvalSupported: false }).promise
  const pages: { width: number; height: number; items: Item[]; rules: Rule[] }[] = []
  const OPS = pdfjs.OPS as Record<string, number>
  const PAINT = new Set([OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke])
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const [x0, y0, x1, y1] = page.view
    const tc = await page.getTextContent()
    const items: Item[] = []
    for (const raw of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
      if (!raw.str || !raw.str.trim() || !raw.transform) continue
      const [, , c, d, e, f] = raw.transform
      const h = raw.height || Math.hypot(c, d) || 10
      items.push({ str: raw.str, x: e, y: f, w: raw.width || 0, h })
    }
    pages.push({ width: x1 - x0, height: y1 - y0, items, rules: await readRules(page, OPS, PAINT) })
  }
  await doc.destroy()
  return pages
}

type Matrix = [number, number, number, number, number, number]
const compose = (m: Matrix, n: number[]): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: Matrix, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/**
 * The horizontal lines drawn on a page: signature lines, underlines, rules.
 *
 * Signature lines are shapes, not text, and the label beside one does not say
 * exactly where it is: in Charles's agreement the line sits 40pt under the
 * party's SIGNATURE label but 26pt under the witness's. Snapping to the real
 * line puts the signature on it. pdf.js hands paths over in the coordinates
 * current when they were drawn, so the transform has to be followed through
 * save, restore and form XObjects to land in page space.
 */
async function readRules(
  page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }> },
  OPS: Record<string, number>,
  PAINT: Set<number>,
): Promise<Rule[]> {
  const ops = await page.getOperatorList()
  const rules: Rule[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const stack: Matrix[] = []
  for (let k = 0; k < ops.fnArray.length; k++) {
    const fn = ops.fnArray[k]
    const args = ops.argsArray[k] as unknown[]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() || ctm
    else if (fn === OPS.transform) ctm = compose(ctm, args as number[])
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(args[0]) || ArrayBuffer.isView(args[0])) ctm = compose(ctm, Array.from(args[0] as ArrayLike<number>)) }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm
    else if (fn === OPS.constructPath && PAINT.has(args[0] as number)) {
      const mm = args[2] as ArrayLike<number> | null
      if (!mm || mm.length < 4) continue
      const pts = [apply(ctm, mm[0], mm[1]), apply(ctm, mm[2], mm[3]), apply(ctm, mm[0], mm[3]), apply(ctm, mm[2], mm[1])]
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
      if (h < 2.5 && w >= 40) rules.push({ x1: Math.min(...xs), x2: Math.max(...xs), y: (Math.max(...ys) + Math.min(...ys)) / 2 })
    }
  }
  return rules
}

/** Items on one baseline, then split wherever a gap says "another column". */
function toSegments(items: Item[]): Segment[] {
  const lines: Item[][] = []
  for (const it of [...items].sort((a, b) => b.y - a.y)) {
    const line = lines.find((l) => Math.abs(l[0].y - it.y) < SAME_LINE)
    if (line) line.push(it)
    else lines.push([it])
  }
  const segments: Segment[] = []
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x)
    let cur: Item[] = []
    const flush = () => {
      if (!cur.length) return
      let text = ''
      cur.forEach((it, i) => {
        const gap = i ? it.x - (cur[i - 1].x + cur[i - 1].w) : 0
        text += (i && gap > 1 ? ' ' : '') + it.str
      })
      const x2 = Math.max(...cur.map((i) => i.x + i.w))
      segments.push({ text: text.replace(/\s+/g, ' ').trim(), items: cur, x: cur[0].x, x2, y: cur[0].y, h: Math.max(...cur.map((i) => i.h)) })
      cur = []
    }
    for (const it of line) {
      const prev = cur[cur.length - 1]
      if (prev && it.x - (prev.x + prev.w) > COLUMN_GAP) flush()
      cur.push(it)
    }
    flush()
  }
  return segments
}

/** "This Agreement is made on the" -> "made on the": the last few words before a blank. */
const blankLabel = (before: string) => {
  const words = before.split(' ').map((w) => despace(w)).join(' ').replace(/[\s:;,.\-–]+$/, '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-6).join(' ').slice(0, 80)
}

/**
 * Underscore blanks that are not a signature, name, date, title or initials
 * place: "Address: ________", "dated this ____ day of ________". One inside a
 * signature block is that block's person to fill in on the signing page;
 * anywhere else, it is Ernest's to fill in before sending.
 */
function findBlanks(pageNo: number, pageWidth: number, segs: Segment[], isLabelled: (s: Segment) => boolean, blocks: Block[], fields: DetectedField[]) {
  for (const seg of segs) {
    if (isLabelled(seg)) continue
    for (const run of findRuns(seg)) {
      // A row of underscores right across the page is a divider, not a blank.
      if (run.x2 - run.x > pageWidth * 0.6 && !seg.text.replace(/_/g, '').trim()) continue
      const block = blocks.find((b) => seg.x >= b.x0 && seg.x < b.x1 && seg.y >= b.lo && seg.y <= b.hi)
      const party = block ? (block.witnessParty && seg.y < block.witnessY ? block.witnessParty : block.party) : SENDER
      // When no words come first in the same piece of text, they are either
      // right beside it ("Client name" | "________") or on the line just above
      // it ("Build start date" over its blank). Only close neighbours count:
      // the other column's text can share the baseline, and it is not a label.
      const near = run.before ? null
        : segs
          .filter((o) => o !== seg && Math.abs(o.y - seg.y) < SAME_LINE && o.x2 <= run.x + 2 && run.x - o.x2 < 40)
          .sort((p, q) => q.x2 - p.x2)[0]
        || segs
          .filter((o) => o.y > seg.y + SAME_LINE && o.y - seg.y < Math.max(26, run.h * 2.4) && Math.abs(o.x - run.x) < 30 && !findRuns(o).length)
          .sort((p, q) => p.y - q.y)[0]
      const label = blankLabel(run.before || (near ? readable(near) : ''))
      fields.push({
        page: pageNo, kind: 'text', party,
        x: r1(run.x + 1), y: r1(run.y - 2), width: r1(Math.max(24, run.x2 - run.x - 2)), height: r1(Math.max(11, run.h * 1.3)),
        context: label || 'Blank', ...(label ? { label } : {}),
      })
    }
  }
}

export async function detectSignatureFields(pdf: Uint8Array | Buffer): Promise<Detection> {
  const data = pdf instanceof Uint8Array && !(pdf instanceof Buffer) ? pdf : new Uint8Array(pdf)
  const pages = await readPages(data)
  const fields: DetectedField[] = []
  const parties: DetectedParty[] = []

  pages.forEach((page, idx) => {
    const pageNo = idx + 1
    const segs = toSegments(page.items)
    const marginLeft = Math.min(...segs.map((s) => s.x), page.width)
    const labelled = segs
      .map((seg) => ({ seg, cls: classify(seg) }))
      .filter((l): l is { seg: Segment; cls: NonNullable<ReturnType<typeof classify>> } => Boolean(l.cls))

    // Initials can be anywhere, usually a footer on every page.
    for (const { seg, cls } of labelled.filter((l) => l.cls.kind === 'initials')) {
      const runs = findRuns(seg)
      runs.forEach((run, i) => {
        const key = compact(run.before.replace(/^initials?:?/i, '')).toLowerCase() || String(i)
        fields.push({
          page: pageNo, kind: 'initials', party: `initials:${key}`,
          x: r1(run.x + 1), y: r1(run.y - 2), width: r1(Math.max(24, run.x2 - run.x - 2)), height: r1(Math.max(12, run.h * 1.5)),
          context: `Initials, ${despace(run.before.replace(/^initials?:?/i, '').trim()) || `place ${i + 1}`}`,
        })
      })
      void cls
    }

    const isLabelledSeg = (s: Segment) => labelled.some((l) => l.seg === s)
    const blocks: Block[] = []

    // Columns are wherever a signature label starts.
    const sigLabels = labelled.filter((l) => l.cls.kind === 'signature')
    if (!sigLabels.length) { findBlanks(pageNo, page.width, segs, isLabelledSeg, blocks, fields); return }
    const colStarts = [...new Set(sigLabels.map((l) => Math.round(l.seg.x)))].sort((a, b) => a - b)
      .filter((x, i, a) => !i || x - a[i - 1] > 25)
    const columnOf = (x: number) => {
      let best = -1, dist = Infinity
      colStarts.forEach((c, i) => { const d = Math.abs(x - c); if (d < dist) { dist = d; best = i } })
      return dist < 30 ? best : -1
    }
    const colEnd = (i: number) =>
      i < colStarts.length - 1 ? colStarts[i + 1] - 12 : Math.min(page.width - marginLeft, colStarts[i] + 260)
    const inColumn = (s: Segment, i: number) => s.x >= colStarts[i] - 8 && s.x < colEnd(i)
    const isLabel = (s: Segment) => labelled.some((l) => l.seg === s)

    const sigYs = sigLabels.map((l) => l.seg.y)
    const near = (y: number) => sigYs.some((sy) => Math.abs(sy - y) < 220)

    colStarts.forEach((_, ci) => {
      const inCol = labelled.filter((l) => columnOf(l.seg.x) === ci && near(l.seg.y) && l.cls.kind !== 'initials')
      if (!inCol.length) return
      const witnessY = Math.max(-Infinity, ...inCol.filter((l) => l.cls.kind === 'witness').map((l) => l.seg.y))
      const colSegs = segs.filter((s) => inColumn(s, ci))

      // Which side of a lone label is the empty space, judged on the
      // column's signature label and applied to the rest of the column.
      const bands = (seg: Segment) => {
        const above = colSegs.filter((s) => s.y > seg.y + SAME_LINE).sort((a, b) => a.y - b.y)[0]
        const below = colSegs.filter((s) => s.y < seg.y - SAME_LINE).sort((a, b) => b.y - a.y)[0]
        const aTop = above ? above.y - above.h * 0.25 - 2 : seg.y + 60
        const aBot = seg.y + seg.h * 0.85 + 1
        const bTop = seg.y - seg.h * 0.25 - 1
        const bBot = below ? below.y + below.h * 0.85 + 2 : seg.y - 60
        return { above, below, aTop, aBot, bTop, bBot, freeA: aTop - aBot, freeB: bTop - bBot }
      }
      const firstSig = inCol.find((l) => l.cls.kind === 'signature')
      let orientation: 'above' | 'below' = 'above'
      if (firstSig && !findRuns(firstSig.seg).length) {
        const b = bands(firstSig.seg)
        orientation = b.freeB > b.freeA ? 'below' : 'above'
      }

      const partyId = (witness: boolean) => `p${pageNo}c${ci}${witness ? 'w' : ''}`
      const filledValues: string[] = []

      for (const { seg, cls } of inCol) {
        if (cls.kind === 'witness') continue
        const witness = cls.witnessLabel || seg.y < witnessY
        const party = partyId(witness)
        const kind = cls.kind as FieldKind
        const runs = findRuns(seg)
        const labelWords = splitLabel(readable(seg)).label.replace(/\s+/g, ' ').trim()

        if (runs.length) {
          const run = runs[0]
          if (kind === 'signature') {
            const b = bands(seg)
            const top = b.above ? Math.min(run.y + 36, b.aTop) : run.y + 36
            fields.push({ page: pageNo, kind, party, x: r1(run.x), y: r1(run.y - 2), width: r1(Math.min(220, run.x2 - run.x)), height: r1(Math.max(14, top - (run.y - 2))), context: labelWords })
          } else {
            fields.push({ page: pageNo, kind, party, x: r1(run.x + 2), y: r1(run.y - 1), width: r1(Math.min(220, run.x2 - run.x - 2)), height: r1(Math.max(10, run.h * 1.2)), context: labelWords })
          }
          continue
        }

        // A label with a value already beside it is filled in: "Name: Ernest
        // Avorwlanu", or NAME with "Charles Ohanu" on the next line. It is not
        // a place to sign, but it says whose column this is.
        const inlineValue = splitLabel(seg.text).rest.trim()
        if (inlineValue) { filledValues.push(inlineValue); continue }
        const b = bands(seg)
        const side = kind === 'signature' && seg === firstSig?.seg ? orientation : orientation
        const neighbour = side === 'above' ? b.above : b.below
        const gap = neighbour ? Math.abs(neighbour.y - seg.y) : Infinity
        if (neighbour && !isLabel(neighbour) && gap < seg.h + 14) { filledValues.push(readable(neighbour)); continue }

        const x = colStarts[ci]
        const width = Math.min(200, colEnd(ci) - x)
        // The drawn line in this column nearest the label, inside the space.
        const [lo, hi] = side === 'above' ? [b.aBot, b.aTop] : [b.bBot, b.bTop]
        const line = page.rules
          .filter((r) => r.x1 >= x - 15 && r.x1 < x + 40 && r.x2 - r.x1 <= colEnd(ci) - x + 40 && r.y >= lo - (kind === 'signature' ? 10 : 14) && r.y <= hi + 2)
          .sort((p, q) => (side === 'above' ? p.y - q.y : q.y - p.y))[0]
        if (kind === 'signature') {
          let bot: number, top: number
          if (line) { bot = line.y + 0.8; top = Math.min(bot + 40, side === 'above' ? b.aTop : b.bTop) }
          else if (side === 'above') { bot = b.aBot; top = Math.min(b.aBot + 40, b.aTop) }
          else { bot = Math.max(b.bBot, b.bTop - 40); top = b.bTop }
          if (top - bot < 14) continue
          const w = line ? Math.min(width, line.x2 - x) : width
          fields.push({ page: pageNo, kind, party, x: r1(x), y: r1(bot), width: r1(w), height: r1(top - bot), context: labelWords })
        } else {
          const free = side === 'above' ? b.freeA : b.freeB
          if (free < 10 && !line) continue
          const h = line ? 14 : Math.min(16, free)
          const y = line ? line.y + 1 : side === 'above' ? b.aBot : b.bTop - h
          const w = line ? Math.min(width, line.x2 - x) : width
          fields.push({ page: pageNo, kind, party, x: r1(x), y: r1(y), width: r1(w), height: r1(h), context: labelWords })
        }
      }

      // Words that say whose column this is: everything above the first label
      // in the column, up to a line that runs across into another column.
      const topLabelY = Math.max(...inCol.map((l) => l.seg.y))
      // Stops at a paragraph break (the first gap may be the signature space
      // itself, so it is allowed to be wider), at a section heading set larger
      // than the labels, and at a full sentence such as "Signed in two copies,
      // one for each party."
      const heading: string[] = []
      const labelH = Math.max(...inCol.map((l) => l.seg.h))
      let lastY = topLabelY
      for (const s of segs.filter((s) => s.y > topLabelY + SAME_LINE).sort((a, b) => a.y - b.y)) {
        if (s.y - topLabelY > 160 || s.y - lastY > (heading.length ? 45 : 95)) break
        if (s.h > labelH * 1.25 && heading.length) break
        if (/\.$/.test(s.text) && s.text.split(' ').length > 6) break
        if (s.x < colStarts[ci] - 8 || s.x >= colEnd(ci)) {
          if (s.x < colStarts[ci] - 8 && s.x2 > colStarts[ci] + 10) break
          continue
        }
        if (s.x2 > colEnd(ci) + 12) break
        heading.push(readable(s))
        lastY = s.y
      }
      const main = [...heading, ...filledValues.slice(0, 2)].join(' · ')
      parties.push({ id: partyId(false), page: pageNo, witness: false, context: main })
      const hasWitness = inCol.some((l) => l.cls.kind === 'witness')
      if (hasWitness) {
        parties.push({ id: partyId(true), page: pageNo, witness: true, context: `Witness for ${(heading[0] || main).replace(/^for\s+/i, '')}` })
      }
      blocks.push({
        x0: colStarts[ci] - 8, x1: colEnd(ci), lo: Math.min(...inCol.map((l) => l.seg.y)) - 30, hi: topLabelY + 12,
        witnessY, party: partyId(false), witnessParty: hasWitness ? partyId(true) : null,
      })
    })
    findBlanks(pageNo, page.width, segs, isLabelledSeg, blocks, fields)
  })

  // Initials keys become parties too, so they can be matched like columns.
  for (const key of new Set(fields.filter((f) => f.kind === 'initials').map((f) => f.party))) {
    parties.push({ id: key, page: 0, witness: false, context: `Initials: ${key.slice('initials:'.length)}` })
  }

  return { pages: pages.map(({ width, height }) => ({ width, height })), fields, parties }
}
