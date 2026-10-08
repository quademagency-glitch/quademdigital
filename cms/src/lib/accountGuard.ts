import { createHash } from 'node:crypto'
import type { CollectionBeforeOperationHook } from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../access/roles'
import { checkOwnPassword } from './authenticatorApp'

/*
  Sign-in details and keys are Ernest's to give (CMS review, 8 October 2026).

  - An API key signs in with no password, no two-step sign-in and no session,
    and Payload's key fields take any value from anyone who may edit the
    account, which is every person for their own. Only an admin sets one, so a
    stolen session cannot be turned into a key that outlives the agreement.
  - The email someone signs in with changes only by Ernest, so a stolen session
    cannot move an account to the thief's address and reset the password there.
  - Changing your own password needs the current one, checked the way the
    authenticator settings check it: five tries in fifteen minutes. Ernest's
    own change in the CMS admin sends none and is let through: an admin can
    already do anything, and the portal sends it for everyone.

  Code inside the CMS (a local call with no signed-in person) is not limited.
*/
const KEY_FIELDS = ['apiKey', 'enableAPIKey', 'apiKeyIndex'] as const

type Person = { id: number | string; role?: string | null; email?: string | null }

export const accountGuard: CollectionBeforeOperationHook = async ({ operation, args, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  const data = args.data as Record<string, unknown> | undefined
  if (!data || typeof data !== 'object') return args
  const current = data.currentPassword
  delete data.currentPassword
  const user = req.user as Person | null
  if (!user) return args
  const admin = hasRole(user as never, 'admin')
  if (!admin) for (const k of KEY_FIELDS) delete data[k]

  const id = (args as { id?: unknown }).id
  const target = id !== undefined && id !== null ? String(id) : null
  const self = target !== null && target === String(user.id)

  if (!admin && data.email !== undefined) {
    const now = String(user.email ?? '').trim().toLowerCase()
    if (!self || String(data.email ?? '').trim().toLowerCase() !== now) throw new APIError('Only Ernest changes the email you sign in with.', 403, null, true)
    delete data.email
  }

  if (data.password !== undefined && data.password !== null && data.password !== '') {
    if (!self) {
      if (!admin) throw new APIError('You can change only your own password.', 403, null, true)
      return args
    }
    if (current === undefined || current === null || current === '') {
      if (admin) return args
      throw new APIError('Type your current password to change it.', 400, null, true)
    }
    if (!(await checkOwnPassword(req, user.id, current))) throw new APIError('Your current password is not right.', 400, null, true)
  }
  return args
}

/*
  Password-reset emails: three an hour for any one address (CMS review,
  8 October 2026). Anyone can ask for one with only an email, and Ernest's is
  public. Counted by a hash of the address in the operations table and kept a
  day; the refusal reads the same whether or not the account exists.
*/
const RESETS_AN_HOUR = 3

export const resetLimit: CollectionBeforeOperationHook = async ({ operation, args, req }) => {
  if (operation !== 'forgotPassword') return args
  const email = String((args.data as { email?: unknown } | undefined)?.email ?? '').trim().toLowerCase()
  if (!email) return args
  const key = `reset:${createHash('sha256').update(email).digest('hex').slice(0, 24)}:${new Date().toISOString().slice(0, 13)}`
  const found = await req.payload.find({ collection: 'operations-health', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
  const row = found.docs[0] as { id: number; value?: { count?: number } | null } | undefined
  const count = Number(row?.value?.count ?? 0)
  if (count >= RESETS_AN_HOUR) throw new APIError('Too many reset emails for this address. Try again in an hour.', 429, null, true)
  if (row) await req.payload.update({ collection: 'operations-health', id: row.id, data: { value: { count: count + 1 } }, overrideAccess: true, req })
  else await req.payload.create({ collection: 'operations-health', data: { key, value: { count: 1 } }, overrideAccess: true, req }).catch(() => undefined)
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  await req.payload.delete({ collection: 'operations-health', where: { and: [{ key: { like: 'reset:' } }, { createdAt: { less_than: dayAgo } }] }, overrideAccess: true, req }).catch(() => undefined)
  return args
}
