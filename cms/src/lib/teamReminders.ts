import type { PayloadRequest, TaskConfig } from 'payload'
import { adminIds, notify, teamIds } from './notify'
import { dayBounds } from './reportCounts'
import { addWorkingDays } from './workingDays'

/**
 * The timed notices in spec section 7, run by the jobs queue every five
 * minutes on the CMS server. Each one has a window and a key per person per
 * day (lib/notify.ts), so it goes out once in its window however many times
 * the job runs, and a restart in the middle cannot send it twice.
 *
 * Accra is GMT all year, so its clock is UTC. Weekends are skipped. Someone on
 * leave gets nothing.
 */

const isWorkingDay = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6
const minutes = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes()
const between = (d: Date, from: string, to: string) => {
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  return minutes(d) >= fh * 60 + fm && minutes(d) < th * 60 + tm
}
const hasDailyReport = (jobRole: unknown) =>
  Boolean(jobRole && typeof jobRole === 'object' && ((jobRole as { reportCounts?: unknown[] }).reportCounts ?? []).length)

export async function runReminders(req: PayloadRequest, now = new Date()) {
  if (!isWorkingDay(now)) return { sent: 'weekend' }
  const day = now.toISOString().slice(0, 10)
  const { start, end } = dayBounds(now)
  const working = await teamIds(req, ['active', 'on-notice'])

  // 07:00 Accra: follow-ups due today and overdue.
  if (between(now, '07:00', '09:00')) {
    for (const person of working) {
      const due = await req.payload.find({
        collection: 'leads',
        where: { and: [{ assignedTo: { equals: person.id } }, { nextFollowUp: { less_than_equal: end.toISOString() } }, { status: { in: ['contacted', 'replied'] } }] },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (!due.docs.length) continue
      const late = due.docs.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp) < start)
      const lines = due.docs.slice(0, 15).map((l) => `${l.title ?? `Lead ${l.id}`}${late.includes(l) ? ' (late)' : ''}`)
      await notify(req, {
        to: [person.id],
        kind: 'follow-ups',
        title: `${due.docs.length} follow-up${due.docs.length === 1 ? '' : 's'} today${late.length ? `, ${late.length} late` : ''}`,
        body: lines.join('\n'),
        link: '/leads?show=due',
        key: `follow-ups:${day}`,
        action: 'Open your leads',
      })
    }
  }

  // 08:00 Accra: tasks due the next working day.
  if (between(now, '08:00', '10:00')) {
    const next = dayBounds(addWorkingDays(start, 1))
    const tasks = await req.payload.find({
      collection: 'tasks',
      where: { and: [{ status: { equals: 'open' } }, { dueAt: { greater_than_equal: next.start.toISOString() } }, { dueAt: { less_than_equal: next.end.toISOString() } }] },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    })
    for (const t of tasks.docs) {
      const to = t.assignedTo && typeof t.assignedTo === 'object' ? t.assignedTo.id : t.assignedTo
      await notify(req, { to: [to as number], kind: 'task-due', title: `Due tomorrow: ${t.title}`, link: `/tasks/${t.id}`, key: `task-due:${t.id}:${day}`, action: 'Open the task' })
    }
  }

  const reportsToday = async () =>
    (
      await req.payload.find({
        collection: 'daily-reports',
        where: { date: { equals: start.toISOString() } },
        limit: 200,
        depth: 0,
        overrideAccess: true,
        req,
      })
    ).docs.map((r) => String(r.user && typeof r.user === 'object' ? r.user.id : r.user))

  // 17:00 Accra: the report is due by 18:00.
  if (between(now, '17:00', '18:00')) {
    const sent = await reportsToday()
    for (const person of working.filter((p) => hasDailyReport(p.jobRole) && !sent.includes(String(p.id)))) {
      await notify(req, {
        to: [person.id],
        kind: 'report-due',
        title: 'Your daily report is due by 18:00 Accra (19:00 Lagos)',
        body: 'Your counts are already filled in from your leads. Add who replied and anything in your way, then send it.',
        link: '/report',
        key: `report-due:${day}`,
        action: 'Open your report',
      })
    }
  }

  // 18:05 Accra: tell Ernest whose report is missing.
  if (between(now, '18:05', '21:00')) {
    const sent = await reportsToday()
    const missing = working.filter((p) => hasDailyReport(p.jobRole) && !sent.includes(String(p.id)))
    if (missing.length) {
      await notify(req, {
        to: await adminIds(req),
        kind: 'report-missing',
        title: `${missing.length === 1 ? 'A daily report is' : `${missing.length} daily reports are`} missing`,
        body: missing.map((p) => p.name || `Team member ${p.id}`).join('\n'),
        link: '/',
        key: `report-missing:${day}`,
        action: 'Open Team',
      })
    }
  }
  return { sent: 'ok' }
}

export const teamRemindersTask: TaskConfig<any> = {
  slug: 'teamReminders',
  retries: 0,
  schedule: [{ cron: '*/5 * * * *', queue: 'default' }],
  outputSchema: [{ name: 'ok', type: 'checkbox' }],
  handler: async ({ req }) => {
    await runReminders(req)
    return { output: { ok: true } }
  },
}
