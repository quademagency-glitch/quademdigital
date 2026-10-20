import type { Payload, PayloadRequest, TaskConfig } from 'payload'
import { SERVICE_OPTIONS } from '../collections/JourneyTemplates'
import { audit } from './audit'
import { pickOwnTemplate, pickTemplate } from './onboardingKit'
import { reportProblem } from './problems'

/*
  A client's project timeline, made and emailed without anyone typing it
  (Ernest, 18 October 2026: "creating clients project timelines in their
  portal and emailing them should be automated").

  MADE when the client's onboarding is first queued (lib/onboarding.ts), the
  one moment every way of winning a client passes through: a lead marked Won,
  a client added by hand, the CMS. The steps are the ready journey of each
  service they bought, put together in date order and dated from their start
  date, so a website with SEO gets the website's steps and the SEO's, with one
  kick-off call between them, not the general journey. A proposal or an
  accepted quotation carries steps of its own, and provisionFromProposal
  writes those instead: it creates the client with `context.journey` set to
  'from-deal' so the two never both run.

  EMAILED once a day at 09:00 Accra time, to Won and Active clients whose
  switch is on (clients.timelineEmails). First the whole plan, once their
  welcome email with the portal code has gone and the steps are two hours
  old, so a correction made straight after Won goes out corrected. After
  that, an update only when something they can see has changed since the last
  email: a step done, a date moved, a step added, an update posted. A step
  ticked and unticked on the same day sends nothing. Each email is kept in
  timeline-emails with what it showed, which is what the next day compares
  against. Every one is copied, unseen, to Ernest.
*/

type Doc = Record<string, any>

const FROM = 'Ernest at Quadem Digital <ernest@quademdigital.com>'
const REPLY_TO = 'ernest@quademdigital.com'
export const TIMELINE_COPY_TO = process.env.TIMELINE_COPY_TO || 'ernest@quademdigital.com'
const PORTAL_URL = 'https://quademdigital.com/portal/'
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY = 86_400_000
/** How long a new timeline waits before its plan is emailed, so a correction made straight after Won is the one they get. */
const SETTLE_MS = 2 * 60 * 60 * 1000

// ── The steps ──

const SERVICES = new Set(SERVICE_OPTIONS.map((o) => o.value).filter((v) => v !== 'multiple'))
/** Put in front of a step whose name another service's step already has. */
const SHORT: Record<string, string> = { 'web-design': 'Website', 'digital-marketing': 'Growth', branding: 'Branding', 'video-production': 'Video', 'seo-paid-ads': 'SEO', 'social-media': 'Social media', 'ai-automation': 'Assistant', fieldwork: 'Fieldwork', custom: 'Project' }
/** How the plan email names what they bought. */
const BOUGHT: Record<string, string> = { 'web-design': 'your website', 'digital-marketing': 'your growth marketing', branding: 'your brand identity', 'video-production': 'your videos', 'seo-paid-ads': 'your SEO', 'social-media': 'your social media', 'ai-automation': 'your WhatsApp assistant', fieldwork: 'your lead lists', custom: 'your project' }

export type TemplateStep = { title?: string | null; detail?: string | null; owner?: string | null; stage?: string | null; dueOffsetDays?: number | null; clientVisible?: boolean | null }
export type PlannedStep = TemplateStep & { title: string; sourceTemplate: number | string }
type Part = { service: string; oneOff: boolean; template: Doc }

/** Each service the client bought, once, and whether it is paid once rather than monthly. */
export function servicesOf(client: Doc): { service: string; oneOff: boolean }[] {
  const out: { service: string; oneOff: boolean }[] = []
  for (const row of (client.customizations?.services ?? []) as Doc[]) {
    if (SERVICES.has(row?.service) && !out.some((o) => o.service === row.service)) out.push({ service: row.service, oneOff: row.billing === 'one-off' })
  }
  if (out.length) return out
  // One service, kept as before: a duration of 0 months is a one-off.
  return client.service && SERVICES.has(client.service) ? [{ service: client.service, oneOff: client.customizations?.duration === 0 }] : []
}

const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '')
const offsetOf = (s: TemplateStep) => (Number.isFinite(Number(s.dueOffsetDays)) ? Number(s.dueOffsetDays) : 0)

/**
 * Journeys put together into one timeline, in date order. The start is shared:
 * an onboarding step two services both have (the kick-off call) is there once.
 * Later steps with the same name are different work, so each says which
 * service it is for. A service paid once drops the template's monthly steps,
 * which would promise work that was not sold.
 */
export function combineJourneys(parts: Part[]): PlannedStep[] {
  const out: (PlannedStep & { p: number; i: number })[] = []
  const at = new Map<string, number>()
  parts.forEach(({ service, oneOff, template }, p) => {
    ;((template.steps ?? []) as TemplateStep[]).forEach((step, i) => {
      let title = String(step?.title ?? '').trim()
      if (!title) return
      if (oneOff && step.stage === 'retainer') return
      const seen = at.get(titleKey(title))
      if (seen !== undefined) {
        if ((step.stage ?? 'onboarding') === 'onboarding' && (out[seen].stage ?? 'onboarding') === 'onboarding') return
        title = `${SHORT[service] ?? 'Project'}: ${title}`
      }
      at.set(titleKey(title), out.length)
      out.push({ ...step, title, sourceTemplate: template.id, p, i })
    })
  })
  return out.sort((a, b) => offsetOf(a) - offsetOf(b) || a.p - b.p || a.i - b.i).map(({ p: _p, i: _i, ...step }) => step)
}

/** The timeline a client would get from the ready journeys, and which ones it came from. */
export async function journeyFor(payload: Payload, client: Doc, req?: PayloadRequest): Promise<{ steps: PlannedStep[]; from: string } | null> {
  const bought = servicesOf(client)
  const parts: Part[] = []
  let uncovered = false
  if (bought.length > 1) {
    for (const b of bought) {
      const template = await pickOwnTemplate(payload, b.service, req)
      if (template) parts.push({ ...b, template })
      else uncovered = true
    }
  }
  // One service, or a service with no journey of its own: the usual pick, which falls back to the general journey.
  if (!parts.length || uncovered) {
    const one = bought.length === 1 ? bought[0] : null
    const template = await pickTemplate(payload, one?.service ?? client.service, req)
    if (template && !parts.some((p) => p.template.id === template.id)) parts.push({ service: one?.service ?? 'custom', oneOff: one?.oneOff ?? false, template })
  }
  const steps = combineJourneys(parts)
  return steps.length ? { steps, from: parts.map((p) => String(p.template.name || 'a journey')).join(' + ') } : null
}

const startOf = (client: Doc) => (client.startDate && Number.isFinite(Date.parse(client.startDate)) ? Date.parse(client.startDate) : Date.now())

/** Write steps onto a client, dated from their start date and numbered from `firstOrder`. */
export async function addSteps(payload: Payload, client: Doc, steps: PlannedStep[], firstOrder: number, req?: PayloadRequest): Promise<number> {
  const base = startOf(client)
  let order = firstOrder
  for (const step of steps) {
    await payload.create({
      collection: 'client-journey-steps',
      data: {
        client: client.id,
        title: step.title,
        detail: step.detail || undefined,
        owner: step.owner || 'quadem',
        stage: step.stage || 'onboarding',
        status: 'todo',
        dueDate: new Date(base + offsetOf(step) * DAY).toISOString(),
        clientVisible: step.clientVisible !== false,
        order,
        sourceTemplate: step.sourceTemplate,
      } as never,
      overrideAccess: true,
      req,
    })
    order += 1
  }
  return order - firstOrder
}

/** The client's timeline from the ready journeys, unless they already have steps. */
export async function makeJourney(payload: Payload, client: Doc, req?: PayloadRequest): Promise<{ created: number; existing: number; from: string | null }> {
  const existing = await payload.count({ collection: 'client-journey-steps', where: { client: { equals: client.id } }, overrideAccess: true, req })
  if (existing.totalDocs) return { created: 0, existing: existing.totalDocs, from: null }
  const plan = await journeyFor(payload, client, req)
  if (!plan) return { created: 0, existing: 0, from: null }
  return { created: await addSteps(payload, client, plan.steps, 0, req), existing: 0, from: plan.from }
}

/**
 * Called by the client's afterChange as their onboarding is queued: the
 * timeline is made inside the same save, so it is on their page and their
 * portal from the start. Only the first time (a retry keeps what is there,
 * including steps Ernest removed), and never for a deal with steps of its
 * own. It never stops the save; Ernest hears if it could not be made.
 */
export async function makeJourneyOnWin({ doc, previousDoc, req, context }: { doc: Doc; previousDoc?: Doc | null; req: PayloadRequest; context?: Record<string, unknown> }) {
  if (previousDoc?.onboardingState?.runId || context?.journey === 'from-deal') return
  const name = doc.clientName || 'a new client'
  try {
    const r = await makeJourney(req.payload, doc, req)
    if (!r.created && !r.existing) {
      await reportProblem(req, `timeline:${doc.id}`, `No timeline for ${name}`, 'No ready journey matches what they bought, so their portal shows no timeline. Add the usual steps from their page in the portal, or mark a journey ready under Client onboarding.')
    }
  } catch (error) {
    await reportProblem(req, `timeline:${doc.id}`, `The timeline for ${name} could not be made`, error)
  }
}

// ── What changed since the last email ──

export type StepDoc = { id: number | string; title: string; detail?: string | null; owner?: string | null; status?: string | null; dueDate?: string | null; completedAt?: string | null; order?: number | null; createdAt?: string | null }
export type Update = { id?: string | null; date?: string | null; title?: string | null; description?: string | null }
/** What an email showed: each step as it stood, and which updates it had. */
export type Snapshot = { steps: Record<string, { title: string; status: string; due: string | null }>; updates: string[] }
export type Changes = { done: StepDoc[]; added: StepDoc[]; moved: { step: StepDoc; was: string | null }[]; posted: Update[] }

const dayOf = (iso?: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString().slice(0, 10) : null)

/** In date order, as a timeline reads; steps with no date last, then as Ernest ordered them. */
export const sortSteps = <T extends StepDoc>(steps: T[]): T[] =>
  [...steps].sort((a, b) => (dayOf(a.dueDate) ?? '9999').localeCompare(dayOf(b.dueDate) ?? '9999') || (a.order ?? 0) - (b.order ?? 0))

export function snapshotOf(steps: StepDoc[], updates: Update[]): Snapshot {
  return {
    steps: Object.fromEntries(steps.map((s) => [String(s.id), { title: s.title, status: s.status || 'todo', due: dayOf(s.dueDate) }])),
    updates: updates.map((u) => String(u.id ?? '')).filter(Boolean),
  }
}

/** What the client has not been told: steps done, steps added, dates moved, updates posted. */
export function changesSince(before: Snapshot | null | undefined, steps: StepDoc[], updates: Update[]): Changes {
  const was = before?.steps ?? {}
  const told = new Set(before?.updates ?? [])
  const changes: Changes = { done: [], added: [], moved: [], posted: [] }
  for (const step of steps) {
    const prev = was[String(step.id)]
    if (step.status === 'done') {
      if (prev?.status !== 'done') changes.done.push(step)
    } else if (!prev) changes.added.push(step)
    else if (dayOf(step.dueDate) && prev.due !== dayOf(step.dueDate)) changes.moved.push({ step, was: prev.due })
  }
  changes.posted = updates.filter((u) => u.id && !told.has(String(u.id)))
  return changes
}

export const hasNews = (c: Changes) => c.done.length + c.added.length + c.moved.length + c.posted.length > 0

// ── The emails ──

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** "Mon 20 Oct", with the year only when it is not this one. */
export function dayText(iso?: string | null, now = new Date()) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ''
  const d = new Date(iso)
  const year = d.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: 'numeric' as const }
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...year, timeZone: 'Africa/Accra' }).format(d).replace(',', '')
}

const who = (s: StepDoc) => (s.owner === 'client' ? 'You' : 'Quadem Digital')

/** "your website and your SEO and ads" */
export function boughtText(client: Doc) {
  const names = servicesOf(client).map((s) => BOUGHT[s.service]).filter(Boolean)
  if (!names.length) return 'your project'
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export type TimelineMail = {
  kind: 'plan' | 'update'
  business: string
  first: string
  bought: string
  /** Only the steps they can see, in timeline order. */
  steps: StepDoc[]
  /** Newest first. */
  updates: Update[]
  changes: Changes | null
  /** Whether more emails will follow, so the plan only promises them when they will. */
  followUps: boolean
  now?: Date
}

const NAVY = '#0D1B6E'
const P = 'color:#1A1A1A;font-size:15px;line-height:1.7;margin:0 0 16px;'
const H = `color:${NAVY};font-size:16px;font-weight:bold;margin:24px 0 8px;`
const CELL = 'padding:10px 8px 10px 0;border-bottom:1px solid #eef1f6;vertical-align:top;'

function stepTable(steps: StepDoc[], now: Date) {
  const rows = steps
    .map((s) => {
      const done = s.status === 'done'
      const date = done ? `<span style="color:#0a7d4f;font-weight:bold;">Done</span>` : esc(dayText(s.dueDate, now))
      const title = `<div style="color:${done ? '#6b7280' : '#1A1A1A'};font-size:14px;font-weight:bold;">${esc(s.title)}</div>`
      const detail = s.detail && !done ? `<div style="color:#5b6474;font-size:13px;line-height:1.5;margin-top:2px;">${esc(s.detail)}</div>` : ''
      const mine = s.owner === 'client' && !done
      return `<tr><td style="${CELL}width:84px;color:#333;font-size:13px;white-space:nowrap;">${date}</td><td style="${CELL}">${title}${detail}</td><td style="${CELL}width:92px;text-align:right;font-size:12px;white-space:nowrap;${mine ? `color:${NAVY};font-weight:bold;` : 'color:#6b7280;'}">${who(s)}</td></tr>`
    })
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">${rows}</table>`
}

const list = (items: string[]) => `<ul style="margin:0 0 8px;padding-left:20px;color:#1A1A1A;font-size:14px;line-height:1.7;">${items.map((i) => `<li style="margin:0 0 4px;">${i}</li>`).join('')}</ul>`

function frame(title: string, body: string) {
  return `
<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;margin:24px auto;border:1px solid #dde3f0;border-radius:10px;overflow:hidden;">
  <div style="background:${NAVY};padding:24px 28px;">
    <div style="color:#00B4D8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Quadem Digital</div>
    <div style="color:#fff;font-size:22px;font-weight:bold;">${esc(title)}</div>
  </div>
  <div style="background:#fff;padding:28px;">
    ${body}
    <a href="${PORTAL_URL}" style="display:inline-block;margin-top:20px;background:${NAVY};color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:bold;">Open your portal</a>
    <p style="color:#555;font-size:13px;line-height:1.7;margin:20px 0 0;">Any questions, just reply to this email.<br>Ernest, Quadem Digital</p>
  </div>
</div>`
}

/** The plan email or the update email, as HTML and as plain text. */
export function timelineEmail(m: TimelineMail): { subject: string; html: string; text: string } {
  const now = m.now ?? new Date()
  const hello = m.first ? `Hi ${m.first},` : 'Hello,'
  const open = m.steps.filter((s) => s.status !== 'done')
  const yours = open.filter((s) => s.owner === 'client')
  const next = open.filter((s) => s.owner !== 'client').slice(0, 3)
  const text: string[] = [hello, '']
  let body = `<p style="${P}">${esc(hello)}</p>`

  if (m.kind === 'plan') {
    const intro = `Here is the timeline for ${m.bought}, step by step, with the date each step is due.${yours.length ? ' The steps marked You are the ones I need from you.' : ''}`
    body += `<p style="${P}">${esc(intro)}</p>`
    text.push(intro, '')
    if (yours[0]) {
      const first = `First from you: ${yours[0].title}${yours[0].dueDate ? `, by ${dayText(yours[0].dueDate, now)}` : ''}.`
      body += `<div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px;color:${NAVY};font-size:14px;font-weight:bold;">${esc(first)}</div>`
      text.push(first, '')
    }
    body += stepTable(m.steps, now)
    for (const s of m.steps) text.push(`${s.status === 'done' ? 'Done' : dayText(s.dueDate, now)}  ${s.title} (${who(s)})`)
    if (m.updates.length) {
      body += `<p style="${H}">Updates</p>${list(m.updates.slice(0, 5).map((u) => `<b>${esc(dayText(u.date, now))}</b>: ${esc(u.title)}${u.description ? `<br><span style="color:#5b6474;font-size:13px;">${esc(u.description)}</span>` : ''}`))}`
      text.push('', 'Updates', ...m.updates.slice(0, 5).map((u) => `${dayText(u.date, now)}: ${u.title}${u.description ? `. ${u.description}` : ''}`))
    }
    const after = `Your portal always shows the latest version of this timeline.${m.followUps ? ' When something on it changes, I will email you.' : ''}`
    body += `<p style="${P}margin-top:16px;">${esc(after)}</p>`
    text.push('', after)
    const subject = `Your project timeline: ${m.business}`
    text.push('', `Open your portal: ${PORTAL_URL}`, '', 'Any questions, just reply to this email.', 'Ernest, Quadem Digital')
    return { subject, html: frame('Your project timeline', body), text: text.join('\n') }
  }

  const c = m.changes ?? { done: [], added: [], moved: [], posted: [] }
  const intro = 'Here is what has moved on your project since my last email.'
  body += `<p style="${P}">${esc(intro)}</p>`
  text.push(intro)
  const section = (title: string, items: [string, string][]) => {
    if (!items.length) return
    body += `<p style="${H}">${esc(title)}</p>${list(items.map(([html]) => html))}`
    text.push('', title, ...items.map(([, plain]) => `- ${plain}`))
  }
  section('Done', c.done.map((s) => [`${esc(s.title)}${s.completedAt ? ` <span style="color:#6b7280;">(${esc(dayText(s.completedAt, now))})</span>` : ''}`, `${s.title}${s.completedAt ? ` (${dayText(s.completedAt, now)})` : ''}`]))
  section('Updates', c.posted.map((u) => [`<b>${esc(u.title)}</b>${u.description ? `<br><span style="color:#5b6474;font-size:13px;">${esc(u.description)}</span>` : ''}`, `${u.title}${u.description ? `. ${u.description}` : ''}`]))
  section('New dates', c.moved.map(({ step, was }) => {
    const plain = `${step.title}: now ${dayText(step.dueDate, now)}${was ? `, was ${dayText(was, now)}` : ''}`
    return [`${esc(step.title)}: now <b>${esc(dayText(step.dueDate, now))}</b>${was ? `, was ${esc(dayText(was, now))}` : ''}`, plain]
  }))
  section('New on your timeline', c.added.map((s) => [`${esc(s.title)} (${who(s)})${s.dueDate ? `, ${esc(dayText(s.dueDate, now))}` : ''}`, `${s.title} (${who(s)})${s.dueDate ? `, ${dayText(s.dueDate, now)}` : ''}`]))
  // Their next three, as with what comes next from us: the rest is on their portal.
  section('Waiting on you', yours.slice(0, 3).map((s) => [`<b>${esc(s.title)}</b>${s.dueDate ? `, due ${esc(dayText(s.dueDate, now))}` : ''}`, `${s.title}${s.dueDate ? `, due ${dayText(s.dueDate, now)}` : ''}`]))
  section('Coming up', next.map((s) => [`${esc(s.title)}${s.dueDate ? `, ${esc(dayText(s.dueDate, now))}` : ''}`, `${s.title}${s.dueDate ? `, ${dayText(s.dueDate, now)}` : ''}`]))
  if (!open.length) {
    const all = 'Every step on your timeline is now done.'
    body += `<p style="${P}margin-top:16px;">${esc(all)}</p>`
    text.push('', all)
  }
  text.push('', `Your full timeline is on your portal: ${PORTAL_URL}`, '', 'Any questions, just reply to this email.', 'Ernest, Quadem Digital')
  return { subject: `Project update: ${m.business}`, html: frame('Your project update', body), text: text.join('\n') }
}

/** A few words on what an email carried, for the portal and the audit log. */
export function summaryOf(kind: 'plan' | 'update', steps: StepDoc[], c: Changes | null) {
  if (kind === 'plan' || !c) return `${steps.length} step${steps.length === 1 ? '' : 's'}`
  const n = (k: number, one: string, many: string) => (k ? `${k} ${k === 1 ? one : many}` : '')
  return [n(c.done.length, 'step done', 'steps done'), n(c.posted.length, 'update', 'updates'), n(c.moved.length, 'new date', 'new dates'), n(c.added.length, 'new step', 'new steps')].filter(Boolean).join(', ')
}

// ── Sending ──

export type TimelineResult = { sent: true; kind: 'plan' | 'update'; to: string; summary: string } | { sent: false; reason: string }

/**
 * Email one client what they have not been told about their timeline. By
 * itself (the daily job) it waits for the welcome email and for a new
 * timeline to settle, and sends nothing when nothing has changed. `now` is
 * Ernest pressing the button: it sends whatever the switch says, and the whole
 * timeline again when there is nothing new.
 */
export async function sendTimelineEmail(req: PayloadRequest, clientId: number | string, opts: { now?: boolean } = {}): Promise<TimelineResult> {
  const payload = req.payload
  const client = (await payload.findByID({ collection: 'clients', id: clientId, depth: 0, overrideAccess: true, req, disableErrors: true })) as Doc | null
  if (!client) return { sent: false, reason: 'That client is not there.' }
  const to = String(client.clientEmail || '').trim()
  if (!EMAIL_OK.test(to)) return { sent: false, reason: `${client.clientName || 'This client'} has no email address on their record.` }
  if (!opts.now && client.timelineEmails !== true) return { sent: false, reason: 'Timeline emails are off for this client.' }

  const found = await payload.find({
    collection: 'client-journey-steps',
    where: { and: [{ client: { equals: client.id } }, { clientVisible: { equals: true } }] },
    limit: 300,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
  })
  const steps = sortSteps(found.docs as unknown as StepDoc[])
  const updates = [...((client.timeline ?? []) as Update[])].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  const last = (await payload.find({ collection: 'timeline-emails', where: { client: { equals: client.id } }, sort: '-sentAt', limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as Doc | undefined

  let kind: 'plan' | 'update' = 'plan'
  let changes: Changes | null = null
  if (!last) {
    if (!steps.length) return { sent: false, reason: 'They have no timeline yet.' }
    if (!opts.now) {
      // The plan points at their portal, so it waits for the welcome email with the code.
      const onboarding = client.onboardingState
      if (onboarding?.status && onboarding.steps?.welcome?.status !== 'complete') return { sent: false, reason: 'Their welcome email has not gone yet.' }
      const newest = Math.max(...found.docs.map((s: Doc) => Date.parse(s.createdAt) || 0))
      if (Date.now() - newest < SETTLE_MS) return { sent: false, reason: 'Their timeline was made less than two hours ago.' }
    }
  } else {
    changes = changesSince(last.snapshot as Snapshot, steps, updates)
    if (hasNews(changes)) kind = 'update'
    else if (opts.now) changes = null
    else return { sent: false, reason: 'Nothing they can see has changed since the last email.' }
  }

  const business = String(client.clientName || 'your business')
  const first = String(client.contactName || '').trim().split(/\s+/)[0] || ''
  const mail = timelineEmail({ kind, business, first, bought: boughtText(client), steps, updates, changes, followUps: client.timelineEmails === true })
  const sent = (await payload.sendEmail({ from: FROM, to, bcc: TIMELINE_COPY_TO, replyTo: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text })) as { id?: string } | undefined
  const summary = summaryOf(kind, steps, changes)
  try {
    await payload.create({
      collection: 'timeline-emails',
      data: { client: client.id, kind, sentAt: new Date().toISOString(), to, subject: mail.subject, summary, snapshot: snapshotOf(steps, updates), sendId: sent?.id ?? null } as never,
      overrideAccess: true,
      req,
    })
  } catch (error) {
    // The email went; without this record tomorrow's would repeat it, so Ernest hears.
    await reportProblem(req, `timeline-record:${client.id}`, `${business}'s timeline email went, but was not recorded`, error)
  }
  await audit(req, {
    action: kind === 'plan' ? 'client.timeline-emailed' : 'client.timeline-update-emailed',
    summary: kind === 'plan' ? `Whole timeline (${summary}) emailed to ${business} (${to})` : `Timeline update emailed to ${business} (${to}): ${summary}`,
    subjectType: 'clients',
    subjectId: client.id,
  })
  return { sent: true, kind, to, summary }
}

/** The daily run: every Won or Active client with the switch on. One failing never stops the others. */
export async function runTimelineEmails(req: PayloadRequest): Promise<number> {
  const clients = await req.payload.find({
    collection: 'clients',
    where: { and: [{ pipelineStatus: { in: ['won', 'active'] } }, { timelineEmails: { equals: true } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
  })
  let sent = 0
  for (const client of clients.docs as Doc[]) {
    try {
      if ((await sendTimelineEmail(req, client.id)).sent) sent += 1
    } catch (error) {
      await reportProblem(req, `timeline-email:${client.id}`, `${client.clientName || 'A client'}'s timeline email did not go`, error)
    }
  }
  return sent
}

export const clientTimelineEmailsTask: TaskConfig<any> = {
  slug: 'clientTimelineEmails',
  retries: 0,
  // 09:00 in Accra, which is UTC all year; the five-minute runner sends by 09:05.
  schedule: [{ cron: '0 9 * * *', queue: 'default' }],
  outputSchema: [{ name: 'sent', type: 'number' }],
  handler: async ({ req }) => ({ output: { sent: await runTimelineEmails(req) } }),
}
