import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'
import { Clients } from '../../src/collections/Clients'
import { creditClientFromLead, TEAM_CLIENT_FIELDS } from '../../src/lib/clientCredit'

/** Every named data field in the collection, with the read rule it ends up with. */
const named = (fields: Field[], out: { name: string; read?: (args: any) => unknown }[] = []) => {
  for (const f of fields as any[]) {
    if (f.type === 'ui') continue
    if (f.name) out.push({ name: f.name, read: f.access?.read })
    else if (f.type === 'tabs') for (const t of f.tabs) named(t.fields, out)
    else if (Array.isArray(f.fields)) named(f.fields, out)
  }
  return out
}
const as = (role: string) => ({ req: { user: { id: 7, role } } })
const fields = named(Clients.fields)
const field = (name: string) => fields.find((f) => f.name === name)!

describe('My clients: what a team member reads on a client (spec 3.2)', () => {
  it('finds the client fields at all, through rows, tabs and collapsibles', () => {
    for (const name of ['clientName', 'accessCode', 'creditTo', 'emailNotes', 'customizations', 'timeline']) expect(field(name)).toBeTruthy()
  })

  it('reads only the clients credited to them', () => {
    const read = Clients.access!.read as any
    expect(read(as('team'))).toEqual({ creditTo: { equals: 7 } })
    expect(read(as('admin'))).toBe(true)
    expect(read(as('site'))).toBe(true)
    expect(read(as('editor'))).toBe(false)
    expect(read({ req: { user: null } })).toBe(false)
  })

  it('leaves the spec fields, and the credit the filter needs, readable to the team', () => {
    for (const name of TEAM_CLIENT_FIELDS) expect(field(name).read, name).toBeUndefined()
  })

  it('hides everything else from the team, and from nobody else', async () => {
    const hidden = fields.filter((f) => !TEAM_CLIENT_FIELDS.has(f.name))
    expect(hidden.map((f) => f.name)).toEqual(expect.arrayContaining(['accessCode', 'slug', 'clientEmail', 'phone', 'notes', 'emailNotes', 'onboardingState', 'activity', 'sourceLead', 'customizations']))
    for (const f of hidden) {
      expect(f.read, f.name).toBeTypeOf('function')
      expect(await f.read!(as('team')), f.name).toBe(false)
      expect(await f.read!(as('editor')), f.name).toBe(false)
      expect(await f.read!(as('admin')), f.name).toBe(true)
      expect(await f.read!(as('site')), f.name).toBe(true)
    }
  })
})

describe('a client is credited to whoever worked its lead', () => {
  const lead = (assignedTo: unknown, owner: unknown = 1) => ({ id: 50, assignedTo, owner })
  const run = (args: { data: any; originalDoc?: any; operation?: 'create' | 'update'; found?: any }) => {
    let asked = 0
    const req = { payload: { findByID: async () => (asked++, args.found) } }
    return creditClientFromLead({ data: args.data, originalDoc: args.originalDoc, operation: args.operation ?? 'create', req } as any).then((data: any) => ({ data, asked }))
  }
  const charles = { id: 7, role: 'team' }

  it('handed over: the lead is Ernest\'s, Charles works it', async () => {
    const { data } = await run({ data: { sourceLead: 50 }, found: lead(charles, 1) })
    expect(data).toMatchObject({ creditTo: 7, creditType: 'handed' })
  })

  it('sourced: Charles found the lead and works it', async () => {
    const { data } = await run({ data: { sourceLead: 50 }, found: lead(charles, 7) })
    expect(data).toMatchObject({ creditTo: 7, creditType: 'sourced' })
  })

  it('Ernest\'s own and unassigned leads credit nobody', async () => {
    for (const assignedTo of [null, { id: 1, role: 'admin' }]) {
      const { data } = await run({ data: { sourceLead: 50 }, found: lead(assignedTo) })
      expect(data.creditTo).toBeUndefined()
    }
  })

  it('never replaces a credit someone chose, and does not look the lead up', async () => {
    const { data, asked } = await run({ data: { sourceLead: 50, creditTo: 9, creditType: 'sourced' }, found: lead(charles) })
    expect(data).toMatchObject({ creditTo: 9, creditType: 'sourced' })
    expect(asked).toBe(0)
  })

  it('a credit deliberately cleared stays cleared, unless the lead changes', async () => {
    const originalDoc = { sourceLead: 50, creditTo: 7 }
    expect((await run({ operation: 'update', originalDoc, data: { creditTo: null }, found: lead(charles) })).data.creditTo).toBeNull()
    expect((await run({ operation: 'update', originalDoc, data: { creditTo: null, sourceLead: 51 }, found: lead(charles) })).data.creditTo).toBe(7)
  })

  it('fills in a credit that was never set when the client is next saved', async () => {
    const { data } = await run({ operation: 'update', originalDoc: { sourceLead: 50, creditTo: null }, data: { price: 100 }, found: lead(charles) })
    expect(data.creditTo).toBe(7)
  })

  it('a client with no lead is left alone', async () => {
    const { data, asked } = await run({ data: { clientName: 'Walk-in' } })
    expect(data.creditTo).toBeUndefined()
    expect(asked).toBe(0)
  })
})
