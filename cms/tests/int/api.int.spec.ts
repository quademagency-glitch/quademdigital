import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

describe('API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
  })
})

/*
  Who can read which conversation (spec 14.8), and what a colleague sees of
  another account (spec 14.5), on a real CMS with its real access rules. The
  rules reach through a message into its channel's members, so they are
  worth proving on a database rather than by reading them.
*/
describe('messages and colleagues, on a real CMS', () => {
  const stamp = Date.now()
  type Doc = { id: number | string }
  const ids: Record<string, Doc> = {}
  const asUser = (u: Doc) => ({ ...(u as object), collection: 'users' }) as never

  beforeAll(async () => {
    const payloadConfig = await config
    payload = payload ?? (await getPayload({ config: payloadConfig }))
    const role = async (k: string) => (ids[k] = await payload.create({ collection: 'job-roles', data: { name: `Test ${k} ${stamp}` } as never }))
    await role('roleA')
    await role('roleB')
    const person = async (k: string, data: Record<string, unknown>) =>
      (ids[k] = await payload.create({ collection: 'users', data: { email: `${k}-${stamp}@example.test`, password: `pw-${stamp}-${k}`, name: `Test ${k}`, ...data } as never }))
    await person('admin', { role: 'admin' })
    await person('one', { role: 'team', jobRole: ids.roleA.id, phone: '+234 800 000 0001', city: 'Lagos' })
    await person('two', { role: 'team', jobRole: ids.roleA.id })
    await person('three', { role: 'team', jobRole: ids.roleB.id })
    const channel = async (k: string, data: Record<string, unknown>) => (ids[k] = await payload.create({ collection: 'channels', data: { key: `${k}-${stamp}`, ...data } as never }))
    await channel('everyone', { kind: 'everyone', name: 'Everyone' })
    await channel('chanA', { kind: 'role', jobRole: ids.roleA.id, name: 'A' })
    await channel('chanB', { kind: 'role', jobRole: ids.roleB.id, name: 'B' })
    await channel('dmOneTwo', { kind: 'direct', members: [ids.one.id, ids.two.id] })
    await channel('dmTwoThree', { kind: 'direct', members: [ids.two.id, ids.three.id] })
    const fresh = async (k: string) => (await payload.findByID({ collection: 'users', id: ids[k].id, overrideAccess: true })) as Doc
    for (const k of ['one', 'two', 'three']) ids[k] = await fresh(k)
    const say = (by: string, ch: string) => payload.create({ collection: 'messages', data: { channel: ids[ch].id, body: `${by} in ${ch}` } as never, user: asUser(ids[by]), overrideAccess: false })
    await say('one', 'everyone')
    await say('one', 'chanA')
    await say('three', 'chanB')
    await say('one', 'dmOneTwo')
    await say('three', 'dmTwoThree')
  }, 120_000)

  const readable = async (who: string) =>
    (
      await payload.find({ collection: 'messages', where: { body: { like: '%in %' } }, user: asUser(ids[who]), overrideAccess: false, limit: 100 })
    ).docs
      .map((m) => String((m as { body?: string }).body))
      .filter((b) => ['everyone', 'chanA', 'chanB', 'dmOneTwo', 'dmTwoThree'].some((c) => b.endsWith(` in ${c}`)))
      .sort()

  it('a team member reads Everyone, their own role channel and their own conversations only', async () => {
    expect(await readable('one')).toEqual(['one in chanA', 'one in dmOneTwo', 'one in everyone'])
    expect(await readable('three')).toEqual(['one in everyone', 'three in chanB', 'three in dmTwoThree'])
  })

  it('nobody can write into a conversation they are not in', async () => {
    await expect(payload.create({ collection: 'messages', data: { channel: ids.dmOneTwo.id, body: 'sneaking in' } as never, user: asUser(ids.three), overrideAccess: false })).rejects.toThrow()
  })

  it('a colleague sees the card, not the phone or the city, and never an admin account', async () => {
    const seen = await payload.find({ collection: 'users', where: { id: { in: [ids.one.id, ids.admin.id] } }, user: asUser(ids.two), overrideAccess: false })
    expect(seen.docs.map((u) => String(u.id))).toEqual([String(ids.one.id)])
    const one = seen.docs[0] as { name?: string; email?: string; phone?: string; city?: string }
    expect(one.name).toBe('Test one')
    expect(one.email).toContain('one-')
    expect(one.phone).toBeUndefined()
    expect(one.city).toBeUndefined()
    const self = (await payload.findByID({ collection: 'users', id: ids.one.id, user: asUser(ids.one), overrideAccess: false })) as { phone?: string }
    expect(self.phone).toBe('+234 800 000 0001')
  })
})

/*
  Insights (spec 14.9) on a real CMS: the loader reads only the fields it
  needs, including fields inside the lead history, which is worth proving on
  a database rather than by reading it.
*/
describe('insights, on a real CMS', () => {
  it('counts a lead someone logged and messaged this month', async () => {
    const payloadConfig = await config
    payload = payload ?? (await getPayload({ config: payloadConfig }))
    const { createLocalReq } = await import('payload')
    const { loadInsights } = await import('../../src/lib/insightsData')
    const stamp = Date.now()
    const person = await payload.create({ collection: 'users', data: { email: `insights-${stamp}@example.test`, password: `pw-${stamp}`, name: `Insights ${stamp}`, role: 'team', status: 'active' } as never })
    const now = new Date().toISOString()
    await payload.create({
      collection: 'leads',
      data: { title: `Insights lead ${stamp}`, businessName: `Insights lead ${stamp}`, city: 'Accra', country: 'GH', email: `lead-${stamp}@example.test`, activity: [{ type: 'first-message', at: now, kind: 'whatsapp', direction: 'out', note: 'Hello' }] } as never,
      user: { ...(person as object), collection: 'users' } as never,
      overrideAccess: false,
    })
    const req = await createLocalReq({}, payload)
    const out = await loadInsights(req, 2)
    const me = out.people.find((p) => String(p.id) === String(person.id))
    const month = out.months[out.months.length - 1]
    expect(me?.months[month]).toMatchObject({ researched: 1, messaged: 1 })
    expect(me?.months[month].funnel).toMatchObject({ logged: 1, messaged: 1 })
  }, 120_000)
})
