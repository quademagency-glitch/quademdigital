import { randomBytes } from 'node:crypto'
import type {
  CollectionAfterChangeHook,
  CollectionAfterLoginHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeLoginHook,
  Endpoint,
  PayloadRequest,
} from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../access/roles'
import { currencyForCountry } from '../fields/terms'
import { audit, dayText } from './audit'
import { CLOSED_LEAD, earnUntil, exitChecklist, leavingChange } from './leaving'
import { adminIds, notify } from './notify'
import { WELCOME_LINK_DAYS, welcomeEmail } from './teamEmails'

/**
 * How team accounts come and go: the status log, the first sign-in, ending,
 * and adding someone with a welcome email.
 */

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Keeps the status honest.
 *
 * A new team account starts Invited, and its currency follows its country when
 * nobody chose one. Every change of status is written to `statusLog` with the
 * date it took effect, the reason and who made it, so the person page can show
 * when someone went on leave and why, long after the fields have moved on.
 */
export const teamBeforeChange: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  const role = data.role ?? originalDoc?.role
  if (role !== 'team') return data

  if (operation === 'create') {
    if (!data.status) data.status = 'invited'
    if (!data.statusSince) data.statusSince = today()
  }
  if (!data.currency && !originalDoc?.currency) {
    const fromCountry = currencyForCountry(data.country ?? originalDoc?.country)
    if (fromCountry) data.currency = fromCountry
  }
  if (data.country) data.country = String(data.country).trim().toUpperCase()

  const before = originalDoc?.status
  const sameDay = (a: unknown, b: unknown) => String(a ?? '').slice(0, 10) === String(b ?? '').slice(0, 10)
  const leaving = leavingChange({
    before,
    asked: data.status ?? null,
    endedAt: 'endedAt' in data ? (data.endedAt ?? null) : undefined,
    originalEndedAt: originalDoc?.endedAt,
    statusSince: data.statusSince,
    today: today(),
  })
  if (leaving.error) throw new APIError(leaving.error, 400)
  if (leaving.status) data.status = leaving.status
  if (leaving.endedAt !== undefined) data.endedAt = leaving.endedAt
  if (leaving.statusSince) data.statusSince = leaving.statusSince
  if (leaving.openChecklist) {
    const have = data.exitChecklist ?? originalDoc?.exitChecklist
    if (!Array.isArray(have) || !have.length) data.exitChecklist = exitChecklist(Boolean(data.salaryStartDate ?? originalDoc?.salaryStartDate))
  }
  if (leaving.clearChecklist) data.exitChecklist = []
  if (leaving.rehire && originalDoc) {
    const past = Array.isArray(data.pastAgreements) ? data.pastAgreements : Array.isArray(originalDoc.pastAgreements) ? originalDoc.pastAgreements : []
    data.pastAgreements = [
      ...past,
      { startDate: originalDoc.startDate ?? null, endedAt: originalDoc.endedAt ?? null, reason: originalDoc.statusReason ?? null, agreementRef: originalDoc.agreementRef ?? null },
    ]
  }

  const after = data.status
  if (after && after !== before) {
    // A status change dated with the old status's date would put it in the past.
    if (!leaving.statusSince && (!data.statusSince || (originalDoc && sameDay(data.statusSince, originalDoc.statusSince)))) data.statusSince = today()
    const log = Array.isArray(data.statusLog) ? data.statusLog : Array.isArray(originalDoc?.statusLog) ? originalDoc.statusLog : []
    data.statusLog = [
      ...log,
      {
        status: after,
        from: data.statusSince || today(),
        reason: data.statusReason || (operation === 'create' ? 'Account made' : null),
        by: req.user?.id ?? null,
        at: new Date().toISOString(),
      },
    ]
  }
  return data
}

/**
 * Deleting an account takes its terms and daily reports with it.
 *
 * `member_terms.user_id` (and `daily_reports.user_id`) is NOT NULL with `ON DELETE SET NULL`, the shape that
 * made deleting a pitch with files fail on 2026-09-08: the database refuses to
 * orphan the row and the delete comes back as "Something went wrong". Removed
 * at the database level, past the rule that keeps terms in force, because the
 * person is going too.
 *
 * Nobody real should be deleted: ending an agreement keeps the records. This
 * is for accounts that should never have existed, such as the QA test member
 * at sign-off.
 */
export const teamBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of ['member-terms', 'daily-reports', 'notifications', 'payouts', 'expense-claims'] as const) {
    await req.payload.db.deleteMany({ collection, where: { user: { equals: id } }, req })
  }
  for (const collection of ['time-off', 'monthly-reviews', 'warnings', 'appraisals', 'goals', 'training-progress'] as const) {
    await req.payload.db.deleteMany({ collection, where: { member: { equals: id } }, req })
  }
}

const STATUS_WORDS: Record<string, string> = { invited: 'Invited', active: 'Active', 'on-leave': 'On leave', 'on-notice': 'On notice', ended: 'Ended' }

/** Status changes, ended agreements and changes of role go in the audit log. */
export const teamAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update' || !previousDoc) return doc
  const who = doc.name || doc.email
  if (doc.role !== previousDoc.role) {
    await audit(req, {
      action: 'role.changed',
      summary: `${who}: account type ${previousDoc.role} → ${doc.role}`,
      person: doc.id,
      subjectType: 'users',
      subjectId: doc.id,
      changes: [{ field: 'Account type', from: previousDoc.role, to: doc.role }],
    })
  }
  const was = previousDoc.status
  const now = doc.status
  if (now && now !== was) {
    const ended = now === 'ended'
    const [action, summary] = ended
      ? ['agreement.ended', `${who}'s agreement ended${doc.endedAt ? ` on ${dayText(doc.endedAt)}` : ''}`]
      : now === 'on-notice'
        ? ['agreement.ending', `${who} is on notice: the agreement ends on ${dayText(doc.endedAt)}`]
        : was === 'ended'
          ? ['agreement.rehired', `${who} is back: re-hired from ${doc.startDate ? dayText(doc.startDate) : 'today'}`]
          : was === 'on-notice'
            ? ['agreement.end-cancelled', `${who}'s notice was called off`]
            : ['status.changed', `${who}: ${STATUS_WORDS[was] ?? 'no status'} → ${STATUS_WORDS[now] ?? now}`]
    await audit(req, {
      action,
      summary,
      person: doc.id,
      subjectType: 'users',
      subjectId: doc.id,
      reason: doc.statusReason,
      changes: [
        { field: 'Status', from: STATUS_WORDS[was] ?? '-', to: STATUS_WORDS[now] ?? now },
        ...(String(doc.endedAt ?? '') !== String(previousDoc.endedAt ?? '')
          ? [{ field: 'Agreement ends', from: previousDoc.endedAt ? dayText(previousDoc.endedAt) : '-', to: doc.endedAt ? dayText(doc.endedAt) : '-' }]
          : []),
      ],
    })
  } else if (now === 'on-notice' && String(doc.endedAt ?? '').slice(0, 10) !== String(previousDoc.endedAt ?? '').slice(0, 10)) {
    await audit(req, {
      action: 'agreement.ending',
      summary: `${who}'s agreement now ends on ${dayText(doc.endedAt)}`,
      person: doc.id,
      subjectType: 'users',
      subjectId: doc.id,
      changes: [{ field: 'Agreement ends', from: previousDoc.endedAt ? dayText(previousDoc.endedAt) : '-', to: dayText(doc.endedAt) }],
    })
  }
  if (doc.role === 'team' && now === 'ended' && was !== 'ended') await finishAgreement(req, doc)
  return doc
}

/**
 * Ends every sign-in this account has, on every device, the way Payload's own
 * "log out of all sessions" does: the token in each browser stops working at
 * the next request.
 */
export async function endAllSessions(req: PayloadRequest, id: number | string) {
  const user = await req.payload.db.findOne<{ id: number | string } & Record<string, unknown>>({ collection: 'users', where: { id: { equals: id } }, req })
  if (!user) return
  user.sessions = []
  // Removing sign-ins is not an edit, so the record keeps its last-changed time.
  user.updatedAt = null
  await req.payload.db.updateOne({ collection: 'users', id, data: user, req, returning: false })
}

/**
 * What happens on the day an agreement ends (spec 14.1), however the status got
 * there: sign-in stops everywhere, open leads they worked and open tasks given
 * to them go back to Ernest, and Ernest is told. Who found each lead does not
 * change, because that is what credits a deal for 60 days after the end
 * (Agreement §11). Records stay.
 */
export async function finishAgreement(req: PayloadRequest, person: { id: number; name?: string | null; email?: string | null; endedAt?: string | null }) {
  const who = person.name || person.email || 'A team member'
  const ernest = hasRole(req.user, 'admin') ? (req.user as { id: number }).id : (await adminIds(req))[0]
  await endAllSessions(req, person.id)
  if (!ernest) return

  const at = new Date().toISOString()
  const leads = await req.payload.find({
    collection: 'leads',
    where: { and: [{ assignedTo: { equals: person.id } }, { status: { not_in: CLOSED_LEAD } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const lead of leads.docs) {
    const rows = Array.isArray(lead.activity) ? lead.activity : []
    await req.payload.update({
      collection: 'leads',
      id: lead.id,
      data: {
        assignedTo: ernest,
        assignedAt: at,
        activity: [...rows, { at, kind: 'note', type: 'other', note: `Back with Ernest: ${who}'s agreement ended` }],
      } as never,
      context: { handover: true, system: true },
      overrideAccess: true,
      req,
    })
  }

  const tasks = await req.payload.find({
    collection: 'tasks',
    where: { and: [{ assignedTo: { equals: person.id } }, { status: { equals: 'open' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const task of tasks.docs) {
    await req.payload.update({
      collection: 'tasks',
      id: task.id,
      data: { assignedTo: ernest, details: [`Was ${who}'s until their agreement ended.`, task.details].filter(Boolean).join('\n\n') },
      overrideAccess: true,
      req,
    })
  }

  await notify(req, {
    to: await adminIds(req),
    kind: 'agreement-ended',
    title: `${who}'s agreement has ended`,
    body: [
      'They can no longer sign in, on any device.',
      leads.totalDocs ? `${leads.totalDocs} open lead${leads.totalDocs === 1 ? '' : 's'} came back to you; they are still credited as the finder.` : null,
      tasks.totalDocs ? `${tasks.totalDocs} open task${tasks.totalDocs === 1 ? '' : 's'} came back to you.` : null,
      person.endedAt ? `A lead they found can still earn them commission if its deal is accepted and first paid by ${dayText(earnUntil(person.endedAt))}.` : null,
      'The exit checklist and their final pay are on their page.',
    ]
      .filter(Boolean)
      .join('\n\n'),
    link: `/people/${person.id}`,
    action: 'Open their page',
  })
}

/** The scheduled job: an agreement on notice ends on its date. */
export async function endDueAgreements(req: PayloadRequest) {
  const due = await req.payload.find({
    collection: 'users',
    where: { and: [{ role: { equals: 'team' } }, { status: { equals: 'on-notice' } }, { endedAt: { less_than_equal: `${today()}T23:59:59.999Z` } }] },
    limit: 50,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const person of due.docs) {
    await req.payload.update({
      collection: 'users',
      id: person.id,
      data: { status: 'ended' },
      overrideAccess: true,
      req,
    })
  }
  return due.totalDocs
}

/** An ended agreement ends the sign-in. Records stay, read-only. */
export const teamBeforeLogin: CollectionBeforeLoginHook = ({ user }) => {
  if (user?.role === 'team' && user?.status === 'ended') {
    throw new APIError('This account has ended. If that is a mistake, speak to Ernest.', 403)
  }
  return user
}

const activate = async (req: Parameters<CollectionAfterLoginHook>[0]['req'], user: { id: number | string; status?: string | null; role?: string | null }) => {
  if (user.role !== 'team' || user.status !== 'invited') return
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { status: 'active', statusSince: today(), statusReason: 'First sign-in' },
    overrideAccess: true,
    req,
  })
}

/** The first sign-in turns Invited into Active. */
export const teamAfterLogin: CollectionAfterLoginHook = async ({ req, user }) => {
  await activate(req, user as never).catch((err) => req.payload.logger.error({ err }, 'Could not mark a team member active'))
  return user
}

export const teamEndpoints: Endpoint[] = [
  {
    /*
      Sign out on every device (spec 14.11). Ernest can do it for anyone; a
      person can do it for themselves. Their next request on any device is
      refused and they sign in again; an ended agreement does this on its own.
    */
    path: '/:id/sign-out-everywhere',
    method: 'post',
    handler: async (req) => {
      if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
      const id = Number(req.routeParams?.id)
      const self = String(id) === String(req.user.id)
      if (!id || (!self && !hasRole(req.user, 'admin'))) return Response.json({ error: 'Only Ernest can sign someone else out.' }, { status: 403 })
      await endAllSessions(req, id)
      if (!self) {
        await audit(req, { action: 'signins.ended', summary: 'Signed out on every device', person: id, subjectType: 'users', subjectId: id })
      }
      return Response.json({ ok: true })
    },
  },
  {
    /*
      Setting a password from the welcome link signs the person in without
      passing through login, so the portal calls this straight after to turn
      Invited into Active. It only ever changes the caller's own account, and
      only that one step.
    */
    path: '/activate',
    method: 'post',
    handler: async (req) => {
      if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
      await activate(req, req.user as never)
      return Response.json({ ok: true })
    },
  },
  {
    /*
      Add a team member (spec 14.1). Creates the account, their first terms if
      given, and sends the welcome email with a link to set a password in the
      team portal.

      The link works for a week rather than an hour: people get a welcome email
      on a Friday and open it on Monday.

      Posting the same email again for someone still Invited sends a fresh
      link instead of failing, which is the "resend invite" button.

      The answer carries the link itself, for the admin only, so Ernest can send
      it on WhatsApp if the email lands in spam.
    */
    path: '/invite',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) {
        return Response.json({ error: 'Only an admin can add a team member.' }, { status: req.user ? 403 : 401 })
      }
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: 'That email address does not look right.' }, { status: 400 })
      }

      const { payload } = req
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      let user = existing.docs[0] as Record<string, any> | undefined
      const resend = Boolean(user)
      if (user && !(user.role === 'team' && user.status === 'invited')) {
        return Response.json({ error: 'There is already an account with that email.' }, { status: 409 })
      }

      if (!user) {
        const profile: Record<string, unknown> = {}
        for (const key of ['name', 'phone', 'jobRole', 'jobTitle', 'country', 'currency', 'startDate', 'trialEndsAt', 'manager', 'agreementRef', 'city', 'greytag', 'payoutMethod', 'isManager']) {
          if (body[key] !== undefined && body[key] !== '') profile[key] = body[key]
        }
        try {
          user = (await payload.create({
            collection: 'users',
            data: {
              ...profile,
              email,
              role: 'team',
              status: 'invited',
              // Nobody knows this password. The person sets their own from the link.
              password: randomBytes(32).toString('base64url'),
            } as never,
            req,
          })) as unknown as Record<string, any>
        } catch (err) {
          const message = err instanceof Error ? err.message : 'The account could not be made.'
          return Response.json({ error: message }, { status: 400 })
        }

        await audit(req, {
          action: 'person.added',
          summary: `${user!.name || email} added to the team`,
          person: user!.id,
          subjectType: 'users',
          subjectId: user!.id,
          changes: [
            { field: 'Email', from: '-', to: email },
            ...(user!.startDate ? [{ field: 'Start date', from: '-', to: dayText(user!.startDate) }] : []),
          ],
        })

        if (body.terms && typeof body.terms === 'object') {
          try {
            await payload.create({
              collection: 'member-terms',
              data: {
                ...body.terms,
                user: user!.id,
                effectiveFrom: body.terms.effectiveFrom || body.startDate || today(),
                reason: body.terms.reason || 'Joined',
              } as never,
              req,
            })
          } catch (err) {
            payload.logger.error({ err }, 'Team member made, but their terms were not saved')
            return Response.json(
              { id: user!.id, error: 'The account was made but the terms were not saved. Add them on the person page.' },
              { status: 207 },
            )
          }
        }
      }

      // Payload's own token, so the portal's reset form sets the password. The
      // longer life applies to this link only: the users collection sets no
      // expiration of its own, so an ordinary reset still lasts an hour.
      const token = await payload.forgotPassword({
        collection: 'users',
        data: { email },
        disableEmail: true,
        expiration: WELCOME_LINK_DAYS * 86_400_000,
        req,
      })
      if (!token) {
        return Response.json({ error: 'The account exists but no welcome link could be made.' }, { status: 500 })
      }

      const message = welcomeEmail({ name: user!.name, email, token })
      let emailSent = true
      try {
        await payload.sendEmail({ to: email, subject: message.subject, html: message.html, text: message.text })
      } catch (err) {
        emailSent = false
        payload.logger.error({ err }, 'Welcome email failed')
      }

      return Response.json({ id: user!.id, email, resent: resend, emailSent, welcomeUrl: message.url }, { status: resend ? 200 : 201 })
    },
  },
]
