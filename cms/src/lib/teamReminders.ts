import type { PayloadRequest, TaskConfig } from 'payload'
import { adminIds, notify, teamIds } from './notify'
import { dayBounds } from './reportCounts'
import { addWorkingDays } from './workingDays'
import { moneySettings, termsOn } from './moneyContext'
import { offOn, reportsNeeded } from './offDays'
import { ensureMonthlyReviews, settleMissedMonths } from './reviews'
import { meetingReminders } from '../collections/Meetings'
import { endDueAgreements } from './teamAccounts'
import { digestEmail } from './teamEmails'
import { lagosTime, plusMinutes, workRules } from './workRules'
import { INBOUND_SOURCES } from './enquiries'

/**
 * The timed notices in spec section 7, run by the jobs queue every five
 * minutes on the CMS server. Each one has a window and a key per person per
 * day (lib/notify.ts), so it goes out once in its window however many times
 * the job runs, and a restart in the middle cannot send it twice.
 *
 * Accra is GMT all year, so its clock is UTC. Weekends are skipped. Someone on
 * leave, on approved time off or on their country's public holiday gets nothing
 * and is not counted as missing.
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

/**
 * Money notices (section 7), any day of the week: an overdue commission, and
 * the day before the data allowance window opens, who is eligible so far.
 */
async function moneyReminders(req: PayloadRequest, now: Date) {
  if (!between(now, '09:00', '11:00')) return
  const day = now.toISOString().slice(0, 10)
  const overdue = await req.payload.find({
    collection: 'client-payments',
    where: { and: [{ commissionGHSMinor: { greater_than: 0 } }, { payout: { exists: false } }, { commissionDueAt: { less_than: now.toISOString() } }] },
    limit: 200,
    depth: 1,
    overrideAccess: true,
    req,
  })
  for (const p of overdue.docs) {
    const who = p.creditTo && typeof p.creditTo === 'object' ? p.creditTo.name || p.creditTo.email : 'a team member'
    await notify(req, {
      to: await adminIds(req),
      kind: 'commission-overdue',
      title: `Commission overdue: GH₵${(Number(p.commissionGHSMinor) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })} to ${who}`,
      body: `${p.title}. It was due ${String(p.commissionDueAt).slice(0, 10)} (seven days after the money cleared, Agreement §6).`,
      link: '/payments',
      key: `commission-overdue:${p.id}`,
      action: 'Pay it',
    })
  }

  const settings = await moneySettings(req)
  if (now.getUTCDate() !== settings.allowanceWindowStart - 1) return
  const people = await teamIds(req, ['active', 'on-leave', 'on-notice'])
  const lines: string[] = []
  for (const person of people) {
    const last = await req.payload.find({
      collection: 'payouts',
      where: { and: [{ user: { equals: person.id } }, { type: { equals: 'allowance' } }] },
      sort: '-paidAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const since = last.docs[0]?.paidAt
    const reports = since
      ? (await req.payload.count({ collection: 'daily-reports', where: { and: [{ user: { equals: person.id } }, { submittedAt: { greater_than: since } }] }, overrideAccess: true, req }))
          .totalDocs
      : 0
    const terms = await termsOn(req, person.id, day)
    const { needed } = await reportsNeeded(req, person, Number(terms?.dataAllowance?.reportsNeeded ?? 18), since, day)
    const who = person.name || `Team member ${person.id}`
    lines.push(since ? `${who}: ${reports} of ${needed} daily reports since the last allowance${reports >= needed ? ', due' : ''}` : `${who}: first allowance, due whatever the reports`)
  }
  if (!lines.length) return
  await notify(req, {
    to: await adminIds(req),
    kind: 'allowance-window',
    title: `The data allowance window opens tomorrow (${settings.allowanceWindowStart} to ${settings.allowanceWindowEnd})`,
    body: lines.join('\n'),
    link: '/payments',
    key: `allowance-window:${day.slice(0, 7)}`,
    action: 'Open Payments',
  })
}

/**
 * 07:30 Accra, every day: one email to each person who chose a daily digest,
 * listing what came in since the last one (spec 14.8). Sent rows are marked,
 * so the next run within the window finds nothing.
 */
export async function sendDigests(req: PayloadRequest, now: Date) {
  if (!between(now, '07:30', '09:00')) return
  const waiting = await req.payload.find({ collection: 'notifications', where: { digest: { equals: true } }, sort: 'createdAt', limit: 1000, depth: 0, overrideAccess: true, req })
  const byUser = new Map<string, typeof waiting.docs>()
  for (const n of waiting.docs) {
    const u = String(n.user && typeof n.user === 'object' ? n.user.id : n.user)
    byUser.set(u, [...(byUser.get(u) ?? []), n])
  }
  for (const [userId, items] of byUser) {
    const user = await req.payload.findByID({ collection: 'users', id: Number(userId), depth: 0, overrideAccess: true, req }).catch(() => null)
    if (user?.email && user.status !== 'ended') {
      // Only what is still unread is worth an email; read ones are cleared without one.
      const unread = items.filter((n) => !n.readAt)
      if (unread.length) {
        const mail = digestEmail({ name: user.name, items: unread.map((n) => ({ title: n.title, body: n.body, link: n.link || '/' })) })
        await req.payload.sendEmail({ to: user.email, subject: mail.subject, html: mail.html })
      }
    }
    for (const n of items) await req.payload.db.updateOne({ collection: 'notifications', id: n.id, data: { digest: false }, req, returning: false })
  }
}

export async function runReminders(req: PayloadRequest, now = new Date()) {
  // First, so nobody whose agreement ends today is reminded of anything.
  await endDueAgreements(req).catch((err) => req.payload.logger.error({ err }, 'Ending agreements failed'))
  await moneyReminders(req, now).catch((err) => req.payload.logger.error({ err }, 'Money reminders failed'))
  await sendDigests(req, now).catch((err) => req.payload.logger.error({ err }, 'Daily digests failed'))
  await ensureMonthlyReviews(req, now).catch((err) => req.payload.logger.error({ err }, 'Monthly reviews failed'))
  await settleMissedMonths(req, now).catch((err) => req.payload.logger.error({ err }, 'Missed months failed'))
  await meetingReminders(req, now).catch((err) => req.payload.logger.error({ err }, 'Meeting reminders failed'))
  if (!isWorkingDay(now)) return { sent: 'weekend' }
  const day = now.toISOString().slice(0, 10)
  const { start, end } = dayBounds(now)
  // Nobody on approved time off or a public holiday of their own country is reminded or counted.
  const working = []
  for (const person of await teamIds(req, ['active', 'on-notice'])) {
    if (!(await offOn(req, person, day))) working.push(person)
  }

  const rules = await workRules(req)
  // 07:00 Accra: follow-ups due today and overdue.
  if (rules.reminders.followUps && between(now, '07:00', '09:00')) {
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

  // 07:00 Accra, for Ernest too: his own follow-ups (leads with him or with nobody, which is where
  // website enquiries sit) and the enquiries nobody has answered yet.
  if (rules.reminders.followUps && between(now, '07:00', '09:00')) {
    const admins = await adminIds(req)
    if (admins.length) {
      const due = await req.payload.find({
        collection: 'leads',
        where: {
          and: [
            { or: [{ assignedTo: { in: admins } }, { assignedTo: { exists: false } }] },
            { nextFollowUp: { less_than_equal: end.toISOString() } },
            { status: { in: ['contacted', 'replied'] } },
          ],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const waiting = await req.payload.find({
        collection: 'leads',
        where: { and: [{ status: { equals: 'new' } }, { owner: { exists: false } }, { assignedTo: { exists: false } }, { source: { in: [...INBOUND_SOURCES] } }] },
        limit: 0,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (due.docs.length || waiting.totalDocs) {
        const late = due.docs.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp) < start)
        const parts = [
          waiting.totalDocs ? `${waiting.totalDocs} enquir${waiting.totalDocs === 1 ? 'y' : 'ies'} waiting` : null,
          due.docs.length ? `${due.docs.length} follow-up${due.docs.length === 1 ? '' : 's'} today${late.length ? `, ${late.length} late` : ''}` : null,
        ].filter(Boolean)
        await notify(req, {
          to: admins,
          kind: 'follow-ups',
          title: parts.join(' · '),
          body: due.docs
            .slice(0, 15)
            .map((l) => `${l.title ?? `Lead ${l.id}`}${late.includes(l) ? ' (late)' : ''}`)
            .join('\n'),
          link: waiting.totalDocs ? '/enquiries' : '/leads?show=due',
          key: `founder-follow-ups:${day}`,
          action: waiting.totalDocs ? 'Open enquiries' : 'Open leads',
        })
      }
    }
  }

  // 08:00 Accra: tasks due the next working day.
  if (rules.reminders.tasksDue && between(now, '08:00', '10:00')) {
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
    // Deliverables on client projects, the same way (spec 14.5).
    const due = await req.payload.find({
      collection: 'deliverables',
      where: { and: [{ status: { not_equals: 'done' } }, { owner: { exists: true } }, { dueAt: { greater_than_equal: next.start.toISOString() } }, { dueAt: { less_than_equal: next.end.toISOString() } }] },
      limit: 200,
      depth: 1,
      overrideAccess: true,
      req,
    })
    for (const d of due.docs) {
      const to = d.owner && typeof d.owner === 'object' ? d.owner.id : d.owner
      const project = d.project && typeof d.project === 'object' ? d.project : null
      await notify(req, {
        to: [to as number],
        kind: 'deliverable-due',
        title: `Due tomorrow: ${d.title}`,
        body: project?.title ? `On ${project.title}.` : undefined,
        link: `/projects/${project?.id ?? d.project}`,
        key: `deliverable-due:${d.id}:${day}`,
        action: 'Open the project',
      })
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

  // An hour before the deadline (18:00 Accra unless Ernest changes it): the report is due.
  const deadline = rules.reportDeadline
  if (rules.reminders.reportDue && between(now, plusMinutes(deadline, -60), deadline)) {
    const sent = await reportsToday()
    for (const person of working.filter((p) => hasDailyReport(p.jobRole) && !sent.includes(String(p.id)))) {
      await notify(req, {
        to: [person.id],
        kind: 'report-due',
        title: `Your daily report is due by ${deadline} Accra (${lagosTime(deadline)} Lagos)`,
        body: 'Your counts are already filled in from your leads. Add who replied and anything in your way, then send it.',
        link: '/report',
        key: `report-due:${day}`,
        action: 'Open your report',
      })
    }
  }

  // Five minutes after the deadline: tell Ernest whose report is missing.
  if (rules.reminders.reportMissing && between(now, plusMinutes(deadline, 5), plusMinutes(deadline, 180))) {
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
      // Each manager hears about their own people only.
      const byManager = new Map<number, string[]>()
      for (const p of missing) if (p.managerId) byManager.set(p.managerId, [...(byManager.get(p.managerId) ?? []), p.name || `Team member ${p.id}`])
      for (const [managerId, names] of byManager) {
        await notify(req, {
          to: [managerId],
          kind: 'report-missing',
          title: `${names.length === 1 ? 'A daily report is' : `${names.length} daily reports are`} missing from your people`,
          body: names.join('\n'),
          link: '/people',
          key: `report-missing:${day}:${managerId}`,
          action: 'Open your people',
        })
      }
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
