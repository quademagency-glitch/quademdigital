/**
 * Insights (spec 14.9): for each person and the whole team, by month. No
 * database here, so it can be tested; the endpoint on daily-reports loads the
 * rows and Ernest reads the result on the portal's Insights page.
 *
 * How each figure is counted, so the numbers agree with the daily reports:
 * - Researched: leads the person found (`owner`), by the day they were logged.
 * - Messaged, follow-ups, replies: history rows they wrote, by when the row was
 *   written (`recordedAt`), as on the daily report.
 * - Quotes: quote requests they asked for.
 * - Deals: deals credited to them, by the day the client accepted.
 * - Revenue sourced: money cleared on deals they found themselves, in GH₵
 *   pesewas, refunds taken off. Money on deals handed to them is shown apart.
 * - Punctuality: reports sent on time out of reports sent.
 * - Days to a first reply: from their first message to the business's first
 *   answer, the middle value of the leads first messaged that month.
 * - Conversion: the leads they logged that month, and how far each has got
 *   since. Reaching a stage counts every stage before it.
 *
 * Months are Accra months, which are UTC months.
 */

export type Funnel = { logged: number; messaged: number; replied: number; quoted: number; won: number }

export type InsightRow = {
  researched: number
  messaged: number
  followUps: number
  replies: number
  quotes: number
  deals: number
  revenueSourcedMinor: number
  revenueHandedMinor: number
  reportsSent: number
  reportsOnTime: number
  replyDays: number | null
  funnel: Funnel
}

export type InsightPerson = { id: number; name: string; status: string | null; months: Record<string, InsightRow> }
export type Insights = { months: string[]; people: InsightPerson[]; team: Record<string, InsightRow> }

type Ref = unknown
export type InsightInput = {
  people: { id: number; name?: string | null; email?: string | null; status?: string | null }[]
  leads: {
    id: number
    owner?: Ref
    loggedAt?: string | null
    /** The day it counts on (lib/workDay.ts); research is counted by it. */
    countsOn?: string | null
    status?: string | null
    activity?: { type?: string | null; by?: Ref; at?: string | null; recordedAt?: string | null; direction?: string | null }[] | null
  }[]
  quotes: { lead?: Ref; requestedBy?: Ref; createdAt?: string | null }[]
  deals: { lead?: Ref; creditTo?: Ref; acceptedAt?: string | null; dealStatus?: string | null }[]
  payments: { creditTo?: Ref; creditType?: string | null; clearedAt?: string | null; amountGHSMinor?: number | null }[]
  reports: { user?: Ref; date?: string | null; onTime?: boolean | null }[]
}

const idOf = (v: unknown) => {
  const id = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return id === null || id === undefined || id === '' ? null : String(id)
}

export const monthOf = (d: string | Date | null | undefined) => {
  if (!d) return null
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 7)
}

/** The last `count` months, oldest first, ending with the month `now` is in. */
export const lastMonths = (count: number, now = new Date()) => {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7))
  return out
}

const emptyRow = (): InsightRow => ({
  researched: 0,
  messaged: 0,
  followUps: 0,
  replies: 0,
  quotes: 0,
  deals: 0,
  revenueSourcedMinor: 0,
  revenueHandedMinor: 0,
  reportsSent: 0,
  reportsOnTime: 0,
  replyDays: null,
  funnel: { logged: 0, messaged: 0, replied: 0, quoted: 0, won: 0 },
})

export const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  const v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  return Math.round(v * 10) / 10
}

const QUOTED_STATUSES = ['proposal-requested', 'proposal-sent', 'won']
const WON_DEALS = ['accepted', 'active', 'completed', 'ended']
const isReply = (r: { type?: string | null; direction?: string | null }) => r.type === 'reply' || r.direction === 'in'

export function buildInsights(input: InsightInput, months: string[]): Insights {
  const inWindow = new Set(months)
  const rows = new Map<string, Record<string, InsightRow>>()
  const replySamples = new Map<string, Record<string, number[]>>()
  const known = new Set(input.people.map((p) => String(p.id)))

  const row = (person: string | null, month: string | null) => {
    if (!person || !month || !inWindow.has(month) || !known.has(person)) return null
    let byMonth = rows.get(person)
    if (!byMonth) rows.set(person, (byMonth = {}))
    return (byMonth[month] ??= emptyRow())
  }

  // The lead's later stages, for the conversion figures.
  const quotedLeads = new Set(input.quotes.map((q) => idOf(q.lead)).filter(Boolean) as string[])
  const wonLeads = new Set(input.deals.filter((d) => d.acceptedAt && WON_DEALS.includes(String(d.dealStatus ?? 'accepted'))).map((d) => idOf(d.lead)).filter(Boolean) as string[])

  for (const lead of input.leads) {
    const owner = idOf(lead.owner)
    const logged = row(owner, monthOf(lead.countsOn ?? lead.loggedAt))
    const activity = lead.activity ?? []
    if (logged) {
      logged.researched += 1
      const won = lead.status === 'won' || wonLeads.has(String(lead.id))
      const quoted = won || quotedLeads.has(String(lead.id)) || QUOTED_STATUSES.includes(String(lead.status))
      const replied = quoted || activity.some(isReply)
      const messaged = replied || activity.some((r) => r.type === 'first-message')
      logged.funnel.logged += 1
      if (messaged) logged.funnel.messaged += 1
      if (replied) logged.funnel.replied += 1
      if (quoted) logged.funnel.quoted += 1
      if (won) logged.funnel.won += 1
    }

    for (const r of activity) {
      const target = row(idOf(r.by), monthOf(r.recordedAt))
      if (!target) continue
      if (r.type === 'first-message') target.messaged += 1
      else if (r.type === 'follow-up') target.followUps += 1
      else if (r.type === 'reply') target.replies += 1
    }

    // Days to a first reply, for whoever sent the first message.
    const first = activity.filter((r) => r.type === 'first-message' && (r.at || r.recordedAt)).sort((a, b) => String(a.at ?? a.recordedAt).localeCompare(String(b.at ?? b.recordedAt)))[0]
    if (first) {
      const sentAt = new Date(String(first.at ?? first.recordedAt)).getTime()
      const reply = activity
        .filter((r) => isReply(r) && (r.at || r.recordedAt))
        .map((r) => new Date(String(r.at ?? r.recordedAt)).getTime())
        .filter((t) => t >= sentAt)
        .sort((a, b) => a - b)[0]
      const by = idOf(first.by)
      const month = monthOf(first.at ?? first.recordedAt)
      if (reply !== undefined && row(by, month) && by && month) {
        let samples = replySamples.get(by)
        if (!samples) replySamples.set(by, (samples = {}))
        ;(samples[month] ??= []).push((reply - sentAt) / 86_400_000)
      }
    }
  }

  for (const q of input.quotes) {
    const target = row(idOf(q.requestedBy), monthOf(q.createdAt))
    if (target) target.quotes += 1
  }
  for (const d of input.deals) {
    if (d.dealStatus === 'declined') continue
    const target = row(idOf(d.creditTo), monthOf(d.acceptedAt))
    if (target) target.deals += 1
  }
  for (const p of input.payments) {
    const target = row(idOf(p.creditTo), monthOf(p.clearedAt))
    if (!target) continue
    const amount = Number(p.amountGHSMinor) || 0
    if (p.creditType === 'handed') target.revenueHandedMinor += amount
    else target.revenueSourcedMinor += amount
  }
  for (const r of input.reports) {
    const target = row(idOf(r.user), monthOf(r.date))
    if (!target) continue
    target.reportsSent += 1
    if (r.onTime) target.reportsOnTime += 1
  }

  const team: Record<string, InsightRow> = Object.fromEntries(months.map((m) => [m, emptyRow()]))
  const teamSamples: Record<string, number[]> = {}
  const people: InsightPerson[] = []
  for (const p of input.people) {
    const id = String(p.id)
    const byMonth = rows.get(id) ?? {}
    const samples = replySamples.get(id) ?? {}
    const active = ['active', 'on-leave', 'on-notice'].includes(String(p.status ?? 'active'))
    if (!active && !Object.keys(byMonth).length) continue
    const filled: Record<string, InsightRow> = {}
    for (const m of months) {
      const r = byMonth[m] ?? emptyRow()
      r.replyDays = median(samples[m] ?? [])
      ;(teamSamples[m] ??= []).push(...(samples[m] ?? []))
      filled[m] = r
      const t = team[m]
      for (const k of ['researched', 'messaged', 'followUps', 'replies', 'quotes', 'deals', 'revenueSourcedMinor', 'revenueHandedMinor', 'reportsSent', 'reportsOnTime'] as const) t[k] += r[k]
      for (const k of ['logged', 'messaged', 'replied', 'quoted', 'won'] as const) t.funnel[k] += r.funnel[k]
    }
    people.push({ id: p.id, name: p.name || p.email || `Team member ${p.id}`, status: p.status ?? null, months: filled })
  }
  for (const m of months) team[m].replyDays = median(teamSamples[m] ?? [])
  people.sort((a, b) => a.name.localeCompare(b.name))
  return { months, people, team }
}
