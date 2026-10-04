import { describe, expect, it, vi } from 'vitest'
import { adminMineOrManaged, isManager, managedIds, manages, ownerManagerOrAdmin, ownerOrAdminField, reviewersOf } from '../../src/access/managers'

// A stand-in for the request: who is signed in, and the accounts the CMS holds.
type U = { id: number; role: string; isManager?: boolean; manager?: number | null; status?: string }
const ACCOUNTS: U[] = [
  { id: 1, role: 'admin' },
  { id: 10, role: 'team', isManager: true, status: 'active' },
  { id: 11, role: 'team', manager: 10, status: 'active' },
  { id: 12, role: 'team', manager: 10, status: 'ended' },
  { id: 13, role: 'team', manager: 1, status: 'active' },
  { id: 14, role: 'team', status: 'active' },
]
const reqAs = (user: U | null) => {
  const find = vi.fn(async ({ where }: { where: { and: Record<string, { equals?: unknown; not_equals?: unknown }>[] } }) => {
    const [m, role, status] = where.and
    return { docs: ACCOUNTS.filter((a) => a.manager === m.manager.equals && a.role === role.role.equals && a.status !== status.status.not_equals) }
  })
  const findByID = vi.fn(async ({ id }: { id: number }) => {
    const a = ACCOUNTS.find((x) => x.id === id)
    return a ? { ...a, manager: a.manager ? ACCOUNTS.find((x) => x.id === a.manager) : null } : null
  })
  return { user, context: {}, payload: { find, findByID } } as never as Parameters<typeof managedIds>[0] & { payload: { find: typeof find } }
}
const as = (id: number) => ACCOUNTS.find((a) => a.id === id)!

describe('managers (spec 14.1)', () => {
  it('a manager is a team member marked Manager; an admin or an unmarked member is not', () => {
    expect(isManager(as(10))).toBe(true)
    expect(isManager(as(11))).toBe(false)
    expect(isManager(as(1))).toBe(false)
  })

  it('manages the people who report to them, never ended agreements, never anyone else', async () => {
    const req = reqAs(as(10))
    expect(await managedIds(req)).toEqual([11])
    expect(await manages(req, 11)).toBe(true)
    expect(await manages(req, { id: 11 })).toBe(true)
    expect(await manages(req, 12)).toBe(false)
    expect(await manages(req, 13)).toBe(false)
    expect(await manages(req, 14)).toBe(false)
  })

  it('looks the people up once per request', async () => {
    const req = reqAs(as(10))
    await managedIds(req)
    await managedIds(req)
    await manages(req, 11)
    expect(req.payload.find).toHaveBeenCalledTimes(1)
  })

  it('someone who is not a manager manages nobody and costs no lookup', async () => {
    const req = reqAs(as(11))
    expect(await managedIds(req)).toEqual([])
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it('access: Ernest sees all, a member their own, a manager their own and their people', async () => {
    const rule = adminMineOrManaged('member')
    expect(await rule({ req: reqAs(as(1)) } as never)).toBe(true)
    expect(await rule({ req: reqAs(null) } as never)).toBe(false)
    expect(await rule({ req: reqAs(as(11)) } as never)).toEqual({ or: [{ member: { equals: 11 } }] })
    expect(await rule({ req: reqAs(as(10)) } as never)).toEqual({ or: [{ member: { equals: 10 } }, { member: { in: [11] } }] })
  })

  it('access can add what the whole team sees, such as approved time off', async () => {
    const rule = adminMineOrManaged('member', () => [{ status: { equals: 'approved' } }])
    expect(await rule({ req: reqAs(as(14)) } as never)).toEqual({ or: [{ member: { equals: 14 } }, { status: { equals: 'approved' } }] })
  })

  it('why someone is away: the person, their manager and Ernest; nobody else', async () => {
    const field = ownerManagerOrAdmin('member')
    const doc = { member: 11 }
    expect(await field({ req: reqAs(as(11)), doc } as never)).toBe(true)
    expect(await field({ req: reqAs(as(10)), doc } as never)).toBe(true)
    expect(await field({ req: reqAs(as(1)), doc } as never)).toBe(true)
    expect(await field({ req: reqAs(as(14)), doc } as never)).toBe(false)
  })

  it('money and private things: the person and Ernest, never their manager', async () => {
    const field = ownerOrAdminField('member')
    const doc = { member: { id: 11 } }
    expect(await field({ req: reqAs(as(11)), doc } as never)).toBe(true)
    expect(await field({ req: reqAs(as(1)), doc } as never)).toBe(true)
    expect(await field({ req: reqAs(as(10)), doc } as never)).toBe(false)
  })

  it('a request reaches the admins and the person’s own manager, once each', async () => {
    expect(await reviewersOf(reqAs(as(11)), 11, [1])).toEqual([1, 10])
    // Reports to Ernest himself: just the admins.
    expect(await reviewersOf(reqAs(as(13)), 13, [1])).toEqual([1])
    // No manager at all.
    expect(await reviewersOf(reqAs(as(14)), 14, [1])).toEqual([1])
  })
})
