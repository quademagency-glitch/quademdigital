import { randomBytes } from 'node:crypto'
import type {
  CollectionAfterLoginHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeLoginHook,
  Endpoint,
} from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../access/roles'
import { currencyForCountry } from '../fields/terms'
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
  const after = data.status
  if (after && after !== before) {
    if (after === 'ended' && !data.endedAt && !originalDoc?.endedAt) data.endedAt = data.statusSince || today()
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
  for (const collection of ['member-terms', 'daily-reports'] as const) {
    await req.payload.db.deleteMany({ collection, where: { user: { equals: id } }, req })
  }
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
        for (const key of ['name', 'phone', 'jobRole', 'jobTitle', 'country', 'currency', 'startDate', 'trialEndsAt', 'manager', 'agreementRef', 'city', 'greytag', 'isManager']) {
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
