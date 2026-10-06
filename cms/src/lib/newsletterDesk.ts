import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { geminiGenerate, parseReply, type Generate } from './quoteAi'

/**
 * The newsletter from the founder portal: a first draft written from the
 * founder's notes, and how many people each audience reaches before he sends.
 * Sending itself stays where it was (the campaign's /:id/send, which asks the
 * website to render and send it).
 */

export const SEGMENTS = ['all', 'seo', 'web-design', 'brand-identity', 'video', 'test'] as const
const AUDIENCE_TEXT: Record<string, string> = {
  all: 'everyone on the list',
  seo: 'people interested in SEO and paid ads',
  'web-design': 'people interested in web design',
  'brand-identity': 'people interested in brand identity',
  video: 'people interested in AI video and reels',
  test: 'everyone on the list',
}

/** The website's rule (src/pages/api/campaigns/send.ts): no interests chosen means everything. */
export const inSegment = (interests: unknown, segment: string) => {
  if (segment === 'all') return true
  const chosen = Array.isArray(interests) ? (interests as string[]) : []
  return !chosen.length || chosen.includes(segment) || chosen.includes('general')
}

export type CampaignDraft = { subject: string; previewText: string; body: string; ctaText: string; ctaUrl: string }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s*\u2014\s*/g, ', ').replace(/\r/g, '').trim().slice(0, max) : '')

/** Whatever the model wrote, made safe for a draft: lengths kept, links only to real web addresses. */
export function cleanDraft(raw: unknown): CampaignDraft {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const url = str(r.ctaUrl, 300)
  return {
    subject: str(r.subject, 120),
    previewText: str(r.previewText, 160),
    body: str(r.body, 6000),
    ctaText: str(r.ctaText, 40),
    ctaUrl: /^https:\/\/[^\s]+$/i.test(url) ? url : '',
  }
}

export function newsletterPrompt(notes: string, segment: string) {
  return `You write the email newsletter for Quadem Digital, a small digital agency in Accra run by its founder, Ernest. It helps businesses in Ghana, Nigeria and further afield with websites, branding, social media, AI video and reels, and SEO and ads.

Write one newsletter from the founder's notes below, to ${AUDIENCE_TEXT[segment] ?? 'everyone on the list'}.

Rules:
- Plain, warm British English, as Ernest writing to people he knows. Short sentences. No hype, no exclamation marks in a row, no em dashes.
- Useful first: one clear idea the reader can use, then one simple next step.
- 120 to 250 words in the body.
- Do not invent facts, prices, results or client names that are not in the notes.
- body uses this simple format: a blank line between paragraphs; "## " starts a short heading; "- " starts a bullet; **two stars** for bold; [link text](https://address) for a link. Nothing else.
- Do not put a greeting line like "Hi there" or a sign-off in the body; the email adds them.
- ctaText: two to five words for the button, or empty. ctaUrl: an https address from the notes, or https://quademdigital.com/contact/ if the notes ask people to get in touch, or empty.

Reply with JSON only: {"subject":"...","previewText":"...","body":"...","ctaText":"...","ctaUrl":"..."}

The founder's notes:
---
${notes.slice(0, 5000)}
---`
}

export async function draftNewsletter(notes: string, segment: string, generate: Generate = geminiGenerate) {
  return cleanDraft(parseReply(await generate(newsletterPrompt(notes, segment))))
}

const founderOnly = (req: PayloadRequest) => (hasRole(req.user, 'admin') ? null : Response.json({ error: 'Only the founder can do this.' }, { status: req.user ? 403 : 401 }))

export const newsletterDeskEndpoints: Endpoint[] = [
  {
    path: '/draft-copy',
    method: 'post',
    handler: async (req) => {
      const no = founderOnly(req)
      if (no) return no
      let b: Record<string, unknown> = {}
      try {
        b = ((await req.json?.()) ?? {}) as Record<string, unknown>
      } catch {
        /* an empty body is answered below */
      }
      const notes = String(b.notes ?? '').trim()
      if (notes.length < 15) return Response.json({ error: 'Write a little more: what the email is about, and what you want readers to do.' }, { status: 400 })
      const segment = (SEGMENTS as readonly string[]).includes(String(b.segment)) ? String(b.segment) : 'all'
      try {
        return Response.json({ ok: true, draft: await draftNewsletter(notes, segment) })
      } catch (err) {
        req.payload.logger.error({ err }, 'A newsletter draft could not be written')
        return Response.json({ error: 'The draft could not be written just now. Try again, or write it yourself.' }, { status: 502 })
      }
    },
  },
  {
    // How many confirmed subscribers each audience reaches, for "Send to N people".
    path: '/audience',
    method: 'get',
    handler: async (req) => {
      const no = founderOnly(req)
      if (no) return no
      const subs = await req.payload.find({ collection: 'subscribers', where: { status: { equals: 'subscribed' } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, req })
      const seen = new Map<string, unknown>()
      for (const s of subs.docs as { email?: string; interests?: unknown }[]) if (s.email) seen.set(s.email.trim().toLowerCase(), s.interests)
      const counts = Object.fromEntries(SEGMENTS.filter((x) => x !== 'test').map((seg) => [seg, [...seen.values()].filter((i) => inSegment(i, seg)).length]))
      const all = await req.payload.find({ collection: 'subscribers', limit: 0, pagination: false, depth: 0, overrideAccess: true, req })
      const byStatus: Record<string, number> = {}
      for (const s of all.docs as { status?: string }[]) byStatus[s.status ?? 'pending'] = (byStatus[s.status ?? 'pending'] ?? 0) + 1
      return Response.json({ counts: { ...counts, test: 1 }, byStatus })
    },
  },
]
