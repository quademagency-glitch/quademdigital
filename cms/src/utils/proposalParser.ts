import type { Payload } from 'payload'

/*
  Read a proposal PDF and fill the form in.

  This is the first half of the upload-to-client path: it turns the document
  into fields a person can check. Nothing it writes reaches a client, nothing is
  created from it, and every value lands in an editable field on the proposal,
  because a model reading a PDF is a first draft and the numbers in here become
  an invoice.

  WHY IT NEVER GUESSES

  The prompt is told to answer null for anything the document does not say, and
  everything that comes back is checked against what the CMS will accept before
  it is written: a service must be one of the seven the client record offers, a
  currency one of the five Paystack settles, a country two letters, a deposit
  between 0 and 100. Anything else is dropped and left blank for Ernest to fill,
  which is a visibly empty field rather than a plausible wrong one.

  The heavy libraries are imported dynamically, the same way
  utils/aiEmailGenerator.ts does it, to keep them out of the Next config parser.
*/

const SERVICES = [
  'web-design',
  'digital-marketing',
  'branding',
  'video-production',
  'seo-paid-ads',
  'social-media',
  'multiple',
]

/* What an invoice can actually be raised in. Matches the list in Invoices.ts,
   which is what Paystack can settle. */
const CURRENCIES = ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP']

/* The journey vocabulary, matching the fields on the proposal and on
   client-journey-steps. A step naming anything else is coerced to the safe
   value rather than dropped, because losing a step loses work. */
const OWNERS = ['quadem', 'client']
const STAGES = ['onboarding', 'design', 'development', 'review', 'completed', 'retainer']

/** Em dashes are out of everything a client reads, and this text reaches copy. */
const deDash = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, '-')
    .trim()

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

const isoDate = (value: unknown): string | null => {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const PROMPT = `You are reading a client proposal for Quadem Digital Enterprise, a one person studio run by Ernest.

Pull out the facts needed to set the client up. Answer with a single JSON object and nothing else, no markdown fence.

Keys, every one required, null where the document does not say it:
  "clientName"      the business being sold to, not Quadem
  "contactName"     the person it is addressed to
  "email"           their email address
  "phone"           their phone or WhatsApp number
  "country"         ISO two letter code of the client's country, e.g. GH, NG, GB, US
  "service"         exactly one of: web-design, digital-marketing, branding, video-production, seo-paid-ads, social-media, multiple
  "packageName"     the name of the package or plan as written
  "currency"        ISO three letter code of the money the prices are in, e.g. GHS, USD
  "total"           the headline total as a number, no symbols or separators
  "recurring"       true if that total is charged every month, false if it is one off
  "depositPercent"  the deposit as a number out of 100, null if none is mentioned
  "startDate"       the agreed start date as YYYY-MM-DD
  "durationMonths"  the length of the engagement in months as a number
  "paymentTerms"    the payment terms in one short sentence
  "specialTerms"    anything agreed that is specific to this client, one or two sentences
  "deliverables"    an array of short strings, one per thing being delivered
  "lineItems"       an array of {"description": string, "quantity": number, "rate": number} for the priced items, rate being the price of one unit in the currency above
  "summary"         two sentences saying what this job is, for Ernest to read at a glance
  "journey"         the steps THIS job actually needs, in the order they happen

Each journey step is an object:
  "title"           short, plain, what happens, e.g. "Kickoff call" or "Send logo files and brand colours"
  "detail"          one sentence saying what it involves
  "owner"           "quadem" if Ernest does it, "client" if the client has to do or send something
  "stage"           one of: onboarding, design, development, review, completed, retainer
  "dueOffsetDays"   whole days after the start date, as a number, 0 for the first day
  "clientVisible"   true unless it is internal admin the client should not see

Rules for the journey:
  Build it from what this proposal actually sells. A five page site with a blog
  and a content migration is not the same journey as a one page landing site,
  and a monthly retainer is mostly repeating work, not a build.
  Include every point where the client owes something: content, logins, brand
  assets, approvals, payment of the deposit. Those are the steps that stall a
  job, and they are owner "client".
  Between five and twelve steps. Fewer is useless, more is a checklist nobody
  reads.
  Spread the offsets over the agreed duration where the document gives one.
  Never invent a deliverable that is not in the proposal.

Rules:
  Never invent a value. If the document does not say it, the answer is null.
  Never use an em dash or an en dash in any string.
  Numbers are numbers, not strings, and carry no currency symbol or thousands separator.
  If prices are listed per item, lineItems must add up to the total where the document does.

The proposal text follows.
---
`

export async function parseProposal(doc: any, payload: Payload, fileBuffer?: Buffer) {
  const id = doc?.id
  if (!id) return

  const fail = async (message: string, status: 'needs-review' | 'failed' = 'failed') => {
    await payload.update({
      collection: 'proposals',
      id,
      data: { status, parseError: message },
      context: { fromParser: true },
    })
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      /* Not a failure, just no help: the fields are all editable, so the
         proposal still works as a way in, it is simply typed rather than read. */
      await fail(
        'GEMINI_API_KEY is not set on the CMS, so the PDF was not read. Fill the fields in by hand and the rest of the flow works exactly the same.',
        'needs-review',
      )
      return
    }

    const { PDFParse } = await import('pdf-parse')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')

    /* The upload's own bytes where there are any. Re-fetching doc.url asks
       Payload's file route for a private document with no session and gets a
       403, which is the trap documented in utils/aiEmailGenerator.ts. */
    let buffer: Buffer
    if (fileBuffer?.length) {
      buffer = fileBuffer
    } else {
      const url = String(doc.url || '')
      const absolute = url.startsWith('http')
        ? url
        : `${payload.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL || ''}${url}`
      const res = await fetch(absolute)
      if (!res.ok) throw new Error(`could not read the file back (HTTP ${res.status})`)
      buffer = Buffer.from(await res.arrayBuffer())
    }

    const parser = new PDFParse({ data: buffer })
    const text = (await parser.getText())?.text || ''
    if (text.trim().length < 40) {
      await fail(
        'That PDF has almost no text in it, so it is probably a scan or a set of images. Fill the fields in by hand, or export the proposal as a text PDF and upload it again.',
        'needs-review',
      )
      return
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(`${PROMPT}${text.substring(0, 30000)}\n---\n`)
    const raw = result.response.text()

    let parsed: any
    try {
      const json = raw
        .replace(/^```json\n/g, '')
        .replace(/^```\n/g, '')
        .replace(/\n```$/g, '')
        .trim()
      parsed = JSON.parse(json)
    } catch {
      payload.logger.error({ raw }, '[proposals] model did not return JSON')
      await fail('The model did not return readable JSON. The fields are blank, fill them in by hand.', 'needs-review')
      return
    }

    /* Cast because the check is the runtime one that matters: SERVICES is the
       same seven values the field offers, and anything else has already been
       dropped by the time this is assigned. */
    const service = (
      SERVICES.includes(String(parsed.service)) ? String(parsed.service) : undefined
    ) as 'web-design' | 'digital-marketing' | 'branding' | 'video-production' | 'seo-paid-ads' | 'social-media' | 'multiple' | undefined
    const currency = CURRENCIES.includes(String(parsed.currency || '').toUpperCase())
      ? String(parsed.currency).toUpperCase()
      : undefined
    const country = /^[A-Za-z]{2}$/.test(String(parsed.country || ''))
      ? String(parsed.country).toUpperCase()
      : undefined
    const deposit = num(parsed.depositPercent)

    const lineItems = Array.isArray(parsed.lineItems)
      ? parsed.lineItems
          .map((i: any) => ({
            description: deDash(i?.description),
            quantity: num(i?.quantity) ?? 1,
            rate: num(i?.rate) ?? 0,
          }))
          .filter((i: any) => i.description && i.rate > 0)
      : []

    /* The journey this job needs, written from this proposal. Capped at twenty
       so a runaway answer cannot write a hundred rows, and offsets are clamped
       to a year: a step due in 2036 is a model slip, not a plan. */
    const journeySteps = Array.isArray(parsed.journey)
      ? parsed.journey
          .slice(0, 20)
          .map((s: any) => ({
            title: deDash(s?.title),
            detail: deDash(s?.detail) || undefined,
            owner: OWNERS.includes(String(s?.owner)) ? String(s.owner) : 'quadem',
            stage: STAGES.includes(String(s?.stage)) ? String(s.stage) : 'onboarding',
            dueOffsetDays: Math.min(Math.max(Math.round(num(s?.dueOffsetDays) ?? 0), 0), 365),
            clientVisible: s?.clientVisible !== false,
          }))
          .filter((s: { title: string }) => s.title)
      : []

    const deliverables = Array.isArray(parsed.deliverables)
      ? parsed.deliverables.map((d: any) => ({ item: deDash(d) })).filter((d: any) => d.item)
      : []

    await payload.update({
      collection: 'proposals',
      id,
      data: {
        status: 'needs-review',
        parseError: null,
        parsedAt: new Date().toISOString(),
        clientName: deDash(parsed.clientName) || undefined,
        contactName: deDash(parsed.contactName) || undefined,
        clientEmail: String(parsed.email || '').trim() || undefined,
        phone: deDash(parsed.phone) || undefined,
        country,
        service,
        packageName: deDash(parsed.packageName) || undefined,
        currency,
        total: num(parsed.total) ?? undefined,
        recurring: parsed.recurring === true,
        depositPercent: deposit !== null && deposit >= 0 && deposit <= 100 ? deposit : undefined,
        startDate: isoDate(parsed.startDate) ?? undefined,
        durationMonths: num(parsed.durationMonths) ?? undefined,
        paymentTerms: deDash(parsed.paymentTerms) || undefined,
        specialTerms: deDash(parsed.specialTerms) || undefined,
        summary: deDash(parsed.summary) || undefined,
        deliverables,
        lineItems,
        journeySteps,
      } as any,
      context: { fromParser: true },
    })

    payload.logger.info(
      `[proposals] read proposal ${id} for ${parsed.clientName || 'an unnamed client'}, ${journeySteps.length} journey step(s)`,
    )
  } catch (err: any) {
    payload.logger.error({ err }, '[proposals] could not read the proposal')
    await fail(
      `The PDF could not be read: ${err?.message || String(err)}. The fields are blank, fill them in by hand.`,
      'needs-review',
    )
  }
}
