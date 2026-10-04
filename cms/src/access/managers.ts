import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'
import { hasRole } from './roles'

/**
 * Managers (spec 14.1). A team member marked Manager sees and manages the people
 * whose "Reports to" is them: their daily reports, tasks, time off, training
 * sign-off, monthly reviews and expense claims. Never terms, money, personal
 * files or anyone else's people. Ernest (admin) sees everything anyway.
 *
 * Who someone manages is read once per request and kept on req.context.
 */

type Person = { id: number | string; role?: string | null; isManager?: boolean | null } | null | undefined

export const isManager = (user: Person) => hasRole(user, 'team') && Boolean(user?.isManager)

const KEY = '__managedIds'

/** The ids of the people this person manages, now: on the team and not ended. */
export async function managedIds(req: PayloadRequest): Promise<(number | string)[]> {
  const user = req.user as Person
  if (!user || !isManager(user)) return []
  const ctx = req.context as Record<string, unknown>
  const cached = ctx[KEY] as { by: string; ids: (number | string)[] } | undefined
  if (cached && cached.by === String(user.id)) return cached.ids
  const found = await req.payload.find({
    collection: 'users',
    where: { and: [{ manager: { equals: user.id } }, { role: { equals: 'team' } }, { status: { not_equals: 'ended' } }] },
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const ids = found.docs.map((d) => d.id)
  ctx[KEY] = { by: String(user.id), ids }
  return ids
}

/** Does the signed-in person manage this member? */
export async function manages(req: PayloadRequest, memberId: unknown): Promise<boolean> {
  if (memberId === null || memberId === undefined) return false
  const id = typeof memberId === 'object' ? (memberId as { id?: unknown }).id : memberId
  return (await managedIds(req)).some((m) => String(m) === String(id))
}

/**
 * Admin: everything. A team member: the records whose `field` is them, and for
 * a manager also their people's. `more` adds other records a team member sees.
 */
export const adminMineOrManaged =
  (field: string, more?: (user: { id: number | string }) => Where[]): Access =>
  async ({ req }) => {
    const user = req.user as Person
    if (hasRole(user, 'admin')) return true
    if (!user || !hasRole(user, 'team')) return false
    const people = await managedIds(req)
    const or: Where[] = [{ [field]: { equals: user.id } }, ...(more ? more(user) : [])]
    if (people.length) or.push({ [field]: { in: people } })
    return { or }
  }

/** Field access: admin, the person the record is about (`field`), or their manager. */
export const ownerManagerOrAdmin =
  (field: string): FieldAccess =>
  async ({ req, doc }) => {
    const user = req.user as Person
    if (hasRole(user, 'admin')) return true
    if (!user || !doc) return false
    const owner = (doc as Record<string, unknown>)[field]
    const ownerId = owner && typeof owner === 'object' ? (owner as { id?: unknown }).id : owner
    if (String(ownerId) === String(user.id)) return true
    return manages(req, ownerId)
  }

/** Field access: admin, or the person the record is about. Never their manager: money and private things. */
export const ownerOrAdminField =
  (field: string): FieldAccess =>
  ({ req, doc }) => {
    const user = req.user as Person
    if (hasRole(user, 'admin')) return true
    if (!user || !doc) return false
    const owner = (doc as Record<string, unknown>)[field]
    const ownerId = owner && typeof owner === 'object' ? (owner as { id?: unknown }).id : owner
    return String(ownerId) === String(user.id)
  }

/** Who hears about a team member's request: the admins, and their manager if they have one. */
export async function reviewersOf(req: PayloadRequest, memberId: unknown, admins: (number | string)[]): Promise<(number | string)[]> {
  const id = memberId && typeof memberId === 'object' ? (memberId as { id?: unknown }).id : memberId
  if (id === null || id === undefined) return admins
  const member = await req.payload.findByID({ collection: 'users', id: id as number, depth: 1, overrideAccess: true, req }).catch(() => null)
  const manager = member?.manager && typeof member.manager === 'object' ? (member.manager as { id: number; role?: string; isManager?: boolean; status?: string }) : null
  if (!manager || manager.role !== 'team' || !manager.isManager || manager.status === 'ended') return admins
  return [...new Set([...admins.map(String), String(manager.id)])].map((x) => (Number.isNaN(Number(x)) ? x : Number(x)))
}
