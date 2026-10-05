import type { PayloadRequest } from 'payload'
import { emailFor } from './messages'
import { noticeEmail } from './teamEmails'

/**
 * One call for every notice (spec 5.13 and section 7): a row in the person's
 * bell, and an email that opens the same page in the team portal.
 *
 * `key` makes a notice happen once. The scheduled reminders run every few
 * minutes and would otherwise repeat; a key such as
 * `report-due:2026-10-05:7` is unique in the table, so a second attempt finds
 * it and does nothing.
 *
 * It never throws. A notice that fails to send must not undo the save that
 * caused it, so failures go to the log.
 */
export type Notice = {
  to: (number | string | null | undefined)[]
  kind: string
  title: string
  body?: string
  link: string
  key?: string
  email?: boolean
  /** Emailed whatever the person chose: a written warning, a notice everyone must confirm. */
  important?: boolean
  action?: string
}

export async function notify(req: PayloadRequest, n: Notice) {
  const ids = [...new Set(n.to.filter((x) => x !== null && x !== undefined).map(String))]
  for (const id of ids) {
    try {
      const key = n.key ? `${n.key}:${id}` : null
      if (key) {
        const seen = await req.payload.find({ collection: 'notifications', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
        if (seen.docs.length) continue
      }
      const user = await req.payload.findByID({ collection: 'users', id: Number(id), depth: 0, overrideAccess: true, req }).catch(() => null)
      // Straight away, in the day's digest, or in the portal only: their own choice (spec 14.8).
      const how = emailFor((user as { notifyBy?: string } | null)?.notifyBy, n)
      await req.payload.create({
        collection: 'notifications',
        data: { user: Number(id), kind: n.kind, title: n.title, body: n.body ?? null, link: n.link, key, digest: how === 'digest' },
        overrideAccess: true,
        req,
      })
      if (how !== 'now') continue
      if (!user?.email || user.status === 'ended') continue
      const mail = noticeEmail({ name: user.name, title: n.title, body: n.body, path: n.link, action: n.action })
      await req.payload.sendEmail({ to: user.email, subject: mail.subject, html: mail.html })
    } catch (err) {
      req.payload.logger.error({ err, kind: n.kind }, 'A notice could not be sent')
    }
  }
}

/** Every admin, for notices that go to Ernest. */
export async function adminIds(req: PayloadRequest): Promise<number[]> {
  const res = await req.payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 20, depth: 0, overrideAccess: true, req })
  return res.docs.map((u) => Number(u.id))
}

/** Team members still on the team. */
export async function teamIds(
  req: PayloadRequest,
  statuses = ['active', 'invited', 'on-leave', 'on-notice'],
): Promise<{ id: number; name?: string | null; jobRole?: unknown; country?: string | null; managerId?: number | null }[]> {
  const res = await req.payload.find({
    collection: 'users',
    where: { and: [{ role: { equals: 'team' } }, { status: { in: statuses } }] },
    limit: 200,
    depth: 1,
    overrideAccess: true,
    req,
  })
  return res.docs.map((u) => {
    // Their manager, if they have one who is a team member marked Manager (spec 14.1); admins hear anyway.
    const m = u.manager && typeof u.manager === 'object' ? (u.manager as { id: number; role?: string | null; isManager?: boolean | null; status?: string | null }) : null
    const managerId = m && m.role === 'team' && m.isManager && m.status !== 'ended' ? Number(m.id) : null
    return { id: Number(u.id), name: u.name, jobRole: u.jobRole, country: u.country, managerId }
  })
}
