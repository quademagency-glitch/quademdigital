import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { GEMINI_REQUEST, geminiModel } from '../utils/geminiModel'
import { parseReply } from './quoteAi'
import { readUpload } from './signing/files'

/*
  What was agreed, read from what Ernest already has (17 October 2026: "In
  making a quote, I should be able to upload a proposal and make edits where
  necessary. Also when won, I should upload the proposal or the discussions
  that went on to be able to write the right agreements").

  The proposal he wrote, an earlier quotation, a WhatsApp chat exported as
  text, screenshots of it, emails pasted in: the model reads them together and
  answers the facts a quotation and a service agreement are written from. It
  writes nothing. The answer fills a form Ernest checks and corrects (the
  quotation editor, or the Won step in the portal, which also shows him the
  agreement before it goes), so a wrong reading is a field he fixes, never a
  term a client signs.

  As in utils/proposalParser.ts, nothing is guessed: a fact the material does
  not state comes back null and stays an empty field, and every value is
  checked against what the CMS accepts before it is returned (cleanAgreed).
  The files are Ernest's own (documents with `founderOnly`), read straight
  from the private bucket; a Word file's words come from the portal, which
  reads them in the browser, because the CMS has no Word reader.
*/

export const AGREED_SERVICES = ['web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple', 'custom'] as const
const CURRENCIES = ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP']

export type AgreedLine = { description: string; quantity: number; rate: number }

export type Agreed = {
  clientName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  country: string | null
  service: (typeof AGREED_SERVICES)[number] | null
  packageName: string | null
  currency: string | null
  /** The headline price in whole units: the one-off total, or the monthly fee when recurring. */
  total: number | null
  recurring: boolean | null
  durationMonths: number | null
  depositPercent: number | null
  startDate: string | null
  revisions: number | null
  numberOfPages: number | null
  postsPerMonth: number | null
  platforms: string | null
  paymentTerms: string | null
  specialTerms: string | null
  deliverables: string[]
  lineItems: AgreedLine[]
  summary: string | null
  /** Where the material is unclear or changes its mind: for Ernest to settle. */
  toConfirm: string[]
}

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } }
export type ReadModel = (parts: Part[]) => Promise<string>

/** The model call, kept apart so tests can stand in for it. */
export const geminiRead: ReadModel = async (parts) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel(
    { model: geminiModel(), generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } },
    GEMINI_REQUEST,
  )
  const result = await model.generateContent(parts as never)
  return result.response.text()
}

export function agreedPrompt(purpose: 'quote' | 'won', today: string): string {
  return `You are reading what a client and Quadem Digital Enterprise agreed, or are about to agree: a proposal, a quotation, a chat, emails or notes. Quadem Digital (Ernest, in Accra, Ghana) is the seller. The client is the business buying.
${purpose === 'quote' ? 'Ernest is turning his own proposal into a quotation the client accepts online.' : 'The client said yes. These facts write their service agreement, so they must be what was actually agreed.'}

Answer with one JSON object and nothing else. Every key is required: null where the material does not say it, an empty array for a list it does not give.
  "clientName"      the business buying, never Quadem
  "contactName"     the person at the client
  "email"           their email address
  "phone"           their phone or WhatsApp number
  "country"         ISO two letter code of the client's country, e.g. GH, NG, GB
  "service"         exactly one of: ${AGREED_SERVICES.join(', ')} ("multiple" for several of them, "custom" when none fits)
  "packageName"     the package or plan name as written
  "currency"        ISO three letter code the prices are in, e.g. GHS, USD
  "total"           the headline price as a number: the one-off total, or the monthly fee when it is charged every month
  "recurring"       true if charged every month, false if one off
  "durationMonths"  how many months a monthly engagement runs, as a number
  "depositPercent"  the deposit to start, as a number out of 100
  "startDate"       the agreed start, as YYYY-MM-DD
  "revisions"       how many rounds of changes are included, as a number
  "numberOfPages"   for a website, how many pages
  "postsPerMonth"   for social media, how many posts a month
  "platforms"       for social media or ads, the platforms, comma separated, e.g. "Facebook, Instagram"
  "paymentTerms"    how and when they pay, in one sentence
  "specialTerms"    anything agreed only for this client, in one or two sentences
  "deliverables"    what the client gets, one short line each, in the material's own words
  "lineItems"       the priced items as listed: {"description": string, "quantity": number, "rate": number}, rate being one unit's price
  "summary"         two to four plain sentences on what Quadem will do for them
  "toConfirm"       up to five short questions, where the material is unclear or contradicts itself

Rules:
  Never invent. A fact the material does not state is null, and a deliverable it does not list is left out.
  When a conversation changes its mind (a price is negotiated, something is dropped or added), take the last thing both sides agreed, and add a toConfirm question saying what changed.
  Numbers carry no currency symbol and no thousands separator.
  If only a total is given, lineItems is one line describing the work at that total.
  Today is ${today}. Read "next Monday" or "the 1st" from today.
  Never use an em dash or an en dash in any string.

The material follows.`
}

const deDash = (s: string) => s.replace(/\s+[—–]\s+/g, ', ').replace(/[—–]/g, '-') // em-dash-ok: this is the strip, not a use
const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const t = deDash(String(v)).replace(/\s+/g, ' ').trim().slice(0, max)
  return t || null
}
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const whole = (v: unknown, min: number, max: number): number | null => {
  const n = num(v)
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null
}
const list = (v: unknown, count: number, max: number): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter((x): x is string => Boolean(x)).slice(0, count) : []

/** Whatever the model said, made safe to fill a form with: unknown or impossible values become empty. */
export function cleanAgreed(raw: unknown): Agreed {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const email = str(r.email, 120)
  const country = str(r.country, 2)?.toUpperCase() ?? null
  const currency = str(r.currency, 3)?.toUpperCase() ?? null
  const service = str(r.service, 40)
  const total = num(r.total)
  const deposit = num(r.depositPercent)
  const start = str(r.startDate, 10)
  const lineItems = (Array.isArray(r.lineItems) ? r.lineItems : [])
    .map((l) => {
      const line = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
      return { description: str(line.description, 200) ?? '', quantity: whole(line.quantity, 1, 1000) ?? 1, rate: num(line.rate) ?? 0 }
    })
    .filter((l) => l.description && l.rate > 0)
    .slice(0, 20)
  return {
    clientName: str(r.clientName, 120),
    contactName: str(r.contactName, 120),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: str(r.phone, 40),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    service: (AGREED_SERVICES as readonly string[]).includes(service ?? '') ? (service as Agreed['service']) : null,
    packageName: str(r.packageName, 120),
    currency: currency && CURRENCIES.includes(currency) ? currency : null,
    total: total !== null && total > 0 ? Math.round(total * 100) / 100 : null,
    recurring: typeof r.recurring === 'boolean' ? r.recurring : null,
    durationMonths: whole(r.durationMonths, 1, 60),
    depositPercent: deposit !== null && deposit > 0 && deposit < 100 ? deposit : null,
    startDate: start && /^\d{4}-\d{2}-\d{2}$/.test(start) && Number.isFinite(Date.parse(start)) ? start : null,
    revisions: whole(r.revisions, 0, 20),
    numberOfPages: whole(r.numberOfPages, 1, 500),
    postsPerMonth: whole(r.postsPerMonth, 1, 300),
    platforms: str(r.platforms, 120),
    paymentTerms: str(r.paymentTerms, 300),
    specialTerms: str(r.specialTerms, 600),
    deliverables: list(r.deliverables, 20, 160),
    lineItems,
    summary: str(r.summary, 600),
    toConfirm: list(r.toConfirm, 5, 200),
  }
}

type Doc = Record<string, any>
export type ReadNote = { id: number; title: string; how: 'read' | 'words' | 'left out'; why?: string }

/** The model reads PDFs and pictures as they are, up to about this much in one go. */
const INLINE_BUDGET = 14 * 1024 * 1024
const MODEL_TYPES = /^(application\/pdf|image\/(png|jpeg|webp|heic|heif))$/

/** The files, as parts the model reads, with a word on each: read, read as words, or left out and why. */
export async function partsFrom(req: PayloadRequest, ids: number[], text: string): Promise<{ parts: Part[]; notes: ReadNote[] }> {
  const parts: Part[] = []
  const notes: ReadNote[] = []
  let budget = INLINE_BUDGET
  for (const id of ids) {
    const doc = (await req.payload.findByID({ collection: 'documents', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as Doc | null
    if (!doc) {
      notes.push({ id, title: `File ${id}`, how: 'left out', why: 'It is not there any more.' })
      continue
    }
    const title = String(doc.title || doc.filename || `File ${id}`)
    const type = String(doc.mimeType || '')
    try {
      if (/wordprocessingml/.test(type)) {
        notes.push({ id, title, how: 'words', why: 'Its words came from the portal.' })
        continue
      }
      if (!MODEL_TYPES.test(type) && type !== 'text/plain' && type !== 'text/csv') {
        notes.push({ id, title, how: 'left out', why: 'This kind of file cannot be read. Use a PDF, a picture or a text file.' })
        continue
      }
      const bytes = Buffer.from(await readUpload(doc, 'documents'))
      if (type === 'text/plain' || type === 'text/csv') {
        parts.push({ text: `--- ${title} ---\n${bytes.toString('utf8').slice(0, 60000)}` })
        notes.push({ id, title, how: 'read' })
      } else if (bytes.length <= budget) {
        budget -= bytes.length
        parts.push({ text: `--- ${title} ---` }, { inlineData: { mimeType: type, data: bytes.toString('base64') } })
        notes.push({ id, title, how: 'read' })
      } else if (type === 'application/pdf') {
        // Too big to read whole: its words only.
        const { PDFParse } = await import('pdf-parse')
        const words = ((await new PDFParse({ data: bytes }).getText())?.text || '').trim()
        if (words.length < 40) notes.push({ id, title, how: 'left out', why: 'It is too big to read as pictures, and has almost no words in it.' })
        else {
          parts.push({ text: `--- ${title} ---\n${words.slice(0, 60000)}` })
          notes.push({ id, title, how: 'words', why: 'It is big, so only its words were read.' })
        }
      } else {
        notes.push({ id, title, how: 'left out', why: 'Too many pictures to read at once. Read the rest separately.' })
      }
    } catch (err) {
      req.payload.logger.error({ err, id }, 'A file to read for an agreement could not be opened')
      notes.push({ id, title, how: 'left out', why: 'It could not be opened.' })
    }
  }
  if (text.trim()) parts.push({ text: `--- Written or pasted by Ernest ---\n${text.trim().slice(0, 60000)}` })
  return { parts, notes }
}

export async function readAgreed(req: PayloadRequest, input: { documents: number[]; text?: string; purpose: 'quote' | 'won' }, model: ReadModel = geminiRead) {
  const { parts, notes } = await partsFrom(req, input.documents, String(input.text ?? ''))
  if (!parts.length) throw new Error('nothing to read')
  const reply = await model([{ text: agreedPrompt(input.purpose, new Date().toISOString().slice(0, 10)) }, ...parts])
  return { agreed: cleanAgreed(parseReply(reply)), notes }
}

/** "Read them": what Ernest's files and words say was agreed, for the form he checks. Writes nothing. */
export const agreedEndpoints: Endpoint[] = [
  {
    path: '/agreed/read',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest reads what was agreed.' }, { status: req.user ? 403 : 401 })
      const b = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
      const documents = (Array.isArray(b.documents) ? b.documents : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12)
      const text = String(b.text ?? '').slice(0, 60000)
      const purpose = b.purpose === 'quote' ? 'quote' : 'won'
      if (!documents.length && text.trim().length < 20) return Response.json({ error: 'Add the proposal or the conversation, or paste what was agreed.' }, { status: 400 })
      try {
        return Response.json({ ok: true, ...(await readAgreed(req, { documents, text, purpose })) })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (/GEMINI_API_KEY/.test(msg)) return Response.json({ error: 'Reading is switched off on the CMS (GEMINI_API_KEY is not set). Fill the details in by hand.' }, { status: 503 })
        if (msg === 'nothing to read') return Response.json({ error: 'None of the files could be read. Use a PDF, a picture or a text file, or paste the words.' }, { status: 400 })
        req.payload.logger.error({ err }, 'What was agreed could not be read')
        return Response.json({ error: 'It could not be read just now. Try again, or fill the details in by hand.' }, { status: 502 })
      }
    },
  },
]
