import { describe, expect, it, vi } from 'vitest'
import type { Field } from 'payload'
import { Users } from '../../src/collections/Users'
import { teamProfileFields } from '../../src/fields/teamProfile'

// Who can see what on a team account (spec 14.1, 14.5): a colleague sees the
// card, the person, their manager and Ernest see the rest, and an API key is
// never shown to anyone but its owner and an admin.

type U = { id: number; role: string; isManager?: boolean; manager?: number | null; status?: string }
const ACCOUNTS: U[] = [
  { id: 1, role: 'admin' },
  { id: 10, role: 'team', isManager: true, status: 'active' },
  { id: 11, role: 'team', manager: 10, status: 'active' },
  { id: 12, role: 'team', status: 'active' },
  { id: 20, role: 'site' },
]
const as = (id: number) => ACCOUNTS.find((a) => a.id === id)!
const reqAs = (user: U | null) =>
  ({
    user,
    context: {},
    payload: {
      find: vi.fn(async ({ where }: { where: { and: Record<string, { equals?: unknown }>[] } }) => ({
        docs: ACCOUNTS.filter((a) => a.manager === where.and[0].manager.equals && a.role === 'team' && a.status !== 'ended'),
      })),
    },
  }) as never

// Rows and collapsibles only lay fields out; the named fields sit inside them.
const flat = (fields: Field[]): Field[] => fields.flatMap((f) => (f.type === 'row' || f.type === 'collapsible' ? flat((f as { fields: Field[] }).fields) : [f]))
const field = (name: string) => flat(teamProfileFields()).find((f) => 'name' in f && f.name === name) as { access?: { read?: (a: unknown) => unknown } }
const canRead = async (name: string, reader: number, owner: number) => Boolean(await field(name).access?.read?.({ req: reqAs(as(reader)), doc: { id: owner } }))

describe('a colleague sees the card, not the rest', () => {
  it('a team member can list their team colleagues, never admin or website accounts', async () => {
    const read = Users.access!.read as (a: unknown) => unknown
    expect(await read({ req: reqAs(as(12)) })).toEqual({ or: [{ id: { equals: 12 } }, { role: { equals: 'team' } }] })
    expect(await read({ req: reqAs(as(20)) })).toEqual({ id: { equals: 20 } })
    expect(await read({ req: reqAs(as(1)) })).toBe(true)
    expect(await read({ req: reqAs(null) })).toBe(false)
  })

  it('phone, city, dates, status and currency: the person, their manager and Ernest only', async () => {
    for (const name of ['phone', 'city', 'status', 'startDate', 'trialEndsAt', 'endedAt', 'currency', 'country']) {
      expect(await canRead(name, 11, 11)).toBe(true) // themselves
      expect(await canRead(name, 10, 11)).toBe(true) // their manager
      expect(await canRead(name, 1, 11)).toBe(true) // Ernest
      expect(await canRead(name, 12, 11)).toBe(false) // a colleague
    }
  })

  it('a colleague cannot search by those fields either; a manager can', async () => {
    const read = field('status').access!.read!
    expect(await read({ req: reqAs(as(12)) })).toBe(false)
    expect(await read({ req: reqAs(as(10)) })).toBe(true)
  })

  it('pay and private things stay with the person and Ernest, not even their manager', async () => {
    for (const name of ['greytag', 'payoutMethod', 'salaryStartDate', 'agreementRef', 'emergencyContact']) {
      expect(await canRead(name, 11, 11)).toBe(true)
      expect(await canRead(name, 1, 11)).toBe(true)
      expect(await canRead(name, 10, 11)).toBe(false)
      expect(await canRead(name, 12, 11)).toBe(false)
    }
  })
})

describe('an API key never leaves its owner', () => {
  const strip = Users.hooks!.afterRead![0] as (a: unknown) => Record<string, unknown>
  const doc = () => ({ id: 11, name: 'Someone', apiKey: 'secret', enableAPIKey: true, apiKeyIndex: 'idx' })

  it('a colleague, a manager or a website account reading the account gets no key', () => {
    for (const reader of [12, 10, 20]) {
      const out = strip({ doc: doc(), req: { user: as(reader) } })
      expect(out.apiKey).toBeUndefined()
      expect(out.enableAPIKey).toBeUndefined()
      expect(out.name).toBe('Someone')
    }
  })

  it('the owner and an admin still see it', () => {
    expect(strip({ doc: doc(), req: { user: as(11) } }).apiKey).toBe('secret')
    expect(strip({ doc: doc(), req: { user: as(1) } }).apiKey).toBe('secret')
  })
})
