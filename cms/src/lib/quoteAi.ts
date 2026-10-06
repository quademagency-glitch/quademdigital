import { geminiModel } from '../utils/geminiModel'

/**
 * A quotation suggested from what the founder discussed with a client.
 *
 * The founder writes down the conversation; the model reads it against the
 * price list (already priced in the client's currency by the portal) and says
 * which packages fit, or what custom lines to quote when nothing does, with a
 * short reason and anything worth confirming with the client.
 *
 * The model's answer is only ever a draft, and it is checked before it is
 * used (cleanSuggestion): a package it names must be on the price list, and a
 * package line always carries the list's own price, never one the model made
 * up. Only custom lines carry the model's estimate, and they say so.
 */

export const SERVICES = ['web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple'] as const

/** One price list item, priced for this client by the portal (minor units; null for a custom price). */
export type CatalogueItem = {
  id: number | string
  name: string
  kind?: string | null
  service?: string | null
  description?: string | null
  features?: string[] | null
  priceMinor: number | null
  cycle?: string | null
}

export type SuggestedLine = { plan?: number | string; description: string; quantity: number; rate: number; estimate?: boolean }

export type Suggestion = {
  lines: SuggestedLine[]
  service: (typeof SERVICES)[number] | null
  recurring: boolean
  durationMonths: number | null
  depositPercent: number
  summary: string
  deliverables: string[]
  why: string
  questions: string[]
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s*\u2014\s*/g, ', ').trim().slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[\s,]/g, '')) : NaN)

/**
 * Whatever the model returned, made safe to put on a draft: known packages at
 * their list price, sensible quantities, custom lines marked as estimates.
 */
export function cleanSuggestion(raw: unknown, catalogue: CatalogueItem[]): Suggestion {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const byId = new Map(catalogue.map((c) => [String(c.id), c]))
  const lines: SuggestedLine[] = []
  for (const l of Array.isArray(r.lines) ? r.lines.slice(0, 12) : []) {
    const line = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
    const plan = line.planId != null ? byId.get(String(line.planId)) : undefined
    const quantity = Math.max(1, Math.min(100, Math.round(num(line.quantity)) || 1))
    if (plan) {
      const fixed = plan.priceMinor != null
      const rate = fixed ? (plan.priceMinor as number) / 100 : Math.max(0, num(line.rate) || 0)
      lines.push({ plan: plan.id, description: str(line.description, 160) || plan.name, quantity, rate, ...(fixed ? {} : { estimate: true }) })
      continue
    }
    const description = str(line.description, 160)
    const rate = num(line.rate)
    if (!description || !Number.isFinite(rate) || rate < 0) continue
    lines.push({ description, quantity, rate: Math.round(rate * 100) / 100, estimate: true })
  }
  const service = (SERVICES as readonly string[]).includes(String(r.service)) ? (r.service as Suggestion['service']) : null
  const months = Math.round(num(r.durationMonths))
  const deposit = Math.round(num(r.depositPercent))
  return {
    lines,
    service,
    recurring: r.recurring === true,
    durationMonths: r.recurring === true && months >= 1 && months <= 36 ? months : null,
    depositPercent: deposit >= 0 && deposit <= 90 ? deposit : 0,
    summary: str(r.summary, 1200),
    deliverables: (Array.isArray(r.deliverables) ? r.deliverables : []).map((d) => str(d, 160)).filter(Boolean).slice(0, 15),
    why: str(r.why, 700),
    questions: (Array.isArray(r.questions) ? r.questions : []).map((q) => str(q, 200)).filter(Boolean).slice(0, 5),
  }
}

export function quotePrompt(notes: string, currency: string, catalogue: CatalogueItem[]) {
  const list = catalogue
    .map((c) =>
      [
        `- id ${c.id}: ${c.name}`,
        c.kind ? ` (${c.kind})` : '',
        c.service ? `, service ${c.service}` : '',
        c.priceMinor != null ? `, ${currency} ${(c.priceMinor / 100).toLocaleString('en-GB')}${c.cycle ? ` ${c.cycle}` : ''}` : ', custom price',
        c.description ? `. ${c.description.replace(/\s+/g, ' ').slice(0, 240)}` : '',
        c.features?.length ? ` Includes: ${c.features.slice(0, 8).join('; ')}.` : '',
      ].join(''),
    )
    .join('\n')
  return `You price work for Quadem Digital, a small digital agency in Accra (websites, branding, social media, video, SEO and ads).
The founder spoke with a client and wrote notes below. Choose what to quote.

Rules:
- Prefer items from the price list. Use an item's id as planId. Never invent a package that is not on the list.
- Use a custom line (no planId) only for work the list does not cover, with a fair price in ${currency} consistent with the list's prices.
- Keep it to what the client asked for. Do not upsell.
- If they want monthly work (social media, SEO, retainers), set recurring true and give the months if they said.
- depositPercent: 50 for one-off builds unless the notes say otherwise; 0 for monthly work.
- service: one of ${SERVICES.join(', ')}.
- summary: two to four sentences to the client in plain British English, saying what Quadem will do. No hype, no em dashes.
- deliverables: short items the client gets.
- why: one or two sentences to the founder on why these items and prices.
- questions: anything unclear the founder should confirm with the client, or an empty list.

Reply with JSON only, in this shape:
{"lines":[{"planId":"id or null","description":"...","quantity":1,"rate":0}],"service":"...","recurring":false,"durationMonths":null,"depositPercent":50,"summary":"...","deliverables":["..."],"why":"...","questions":["..."]}

Price list (prices in ${currency}):
${list || '(empty)'}

The founder's notes:
---
${notes.slice(0, 6000)}
---`
}

export type Generate = (prompt: string) => Promise<string>

/** The model call, kept apart so tests can stand in for it. */
export const geminiGenerate: Generate = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: geminiModel(),
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

/** Pull the JSON object out of a reply, even one wrapped in a code fence. */
export function parseReply(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1))
    throw new Error('The suggestion was not readable')
  }
}

export async function suggestQuote(notes: string, currency: string, catalogue: CatalogueItem[], generate: Generate = geminiGenerate): Promise<Suggestion> {
  const text = await generate(quotePrompt(notes, currency, catalogue))
  return cleanSuggestion(parseReply(text), catalogue)
}
