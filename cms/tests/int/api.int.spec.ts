import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, describe, it, beforeAll, expect, vi } from 'vitest'
import { createLocalReq, type PayloadRequest } from 'payload'
import { clientCodeEmail, clientDeskEndpoints } from '../../src/lib/clientDesk'

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

/*
  The founder portal's client actions (lib/clientDesk.ts) on a real CMS, on the
  local test database: who may use them, the code email, a new code, and the
  journey steps copied from a template. Email is stubbed, so nothing is sent.
*/

const deskStamp = Date.now()
const deskIds: Record<string, { id: number | string }> = {}
const deskHandler = (path: string) => clientDeskEndpoints.find((e) => e.path === path)!.handler
const deskCall = async (path: string, as: string | null, id: number | string, body: Record<string, unknown> = {}) => {
  const req = (await createLocalReq({ user: as ? ({ ...(deskIds[as] as object), collection: 'users' } as never) : undefined }, payload)) as PayloadRequest
  req.routeParams = { id: String(id) }
  req.json = async () => body
  const res = await deskHandler(path)(req)
  return { status: res.status, data: (await res.json()) as Record<string, unknown> }
}

describe('client desk, on a real CMS', () => {
  const sent: { to?: unknown; subject?: unknown; text?: unknown }[] = []

  let realSend: Payload['sendEmail']
  afterAll(() => {
    if (realSend) payload.sendEmail = realSend
  })

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    realSend = payload.sendEmail
    payload.sendEmail = vi.fn(async (m: { to?: unknown; subject?: unknown; text?: unknown }) => {
      sent.push(m)
      return {}
    }) as never
    deskIds.admin = await payload.create({ collection: 'users', data: { email: `desk-admin-${deskStamp}@example.test`, password: `pw-${deskStamp}`, name: 'Desk Admin', role: 'admin' } as never })
    deskIds.team = await payload.create({ collection: 'users', data: { email: `desk-team-${deskStamp}@example.test`, password: `pw-${deskStamp}`, name: 'Desk Team', role: 'team', status: 'active' } as never })
    // Active, not Won: Won with full details would queue the onboarding emails.
    const client = (data: Record<string, unknown>) =>
      payload.create({ collection: 'clients', data: { pipelineStatus: 'active', service: 'web-design', startDate: '2026-11-02T00:00:00.000Z', ...data } as never })
    deskIds.client = await client({ clientName: `Desk Bakery ${deskStamp}`, contactName: 'Ama Owusu', clientEmail: `bakery-${deskStamp}@example.test`, slug: `desk-bakery-${deskStamp}` })
    deskIds.noEmail = await client({ clientName: `Desk No Email ${deskStamp}`, slug: `desk-no-email-${deskStamp}` })
    deskIds.template = await payload.create({
      collection: 'journey-templates',
      data: {
        name: `Desk web build ${deskStamp}`,
        service: 'web-design',
        steps: [
          { title: 'Kickoff call', owner: 'quadem', stage: 'onboarding', dueOffsetDays: 0 },
          { title: 'Send your logo', owner: 'client', stage: 'onboarding', dueOffsetDays: 3, clientVisible: true },
          { title: 'Design review', owner: 'quadem', stage: 'design', dueOffsetDays: 10, clientVisible: false },
        ],
      } as never,
    })
  }, 120_000)

  it('only the founder may use them', async () => {
    expect((await deskCall('/:id/send-code', 'team', deskIds.client.id)).status).toBe(403)
    expect((await deskCall('/:id/new-code', null, deskIds.client.id)).status).toBe(401)
    expect((await deskCall('/:id/journey-from-template', 'team', deskIds.client.id)).status).toBe(403)
    expect((await deskCall('/:id/send-code', 'admin', 'not-a-number')).status).toBe(404)
    expect(sent).toHaveLength(0)
  })

  it('emails the current code, greeting the contact by first name', async () => {
    const before = (await payload.findByID({ collection: 'clients', id: deskIds.client.id, depth: 0 })) as { accessCode: string }
    const res = await deskCall('/:id/send-code', 'admin', deskIds.client.id)
    expect(res).toMatchObject({ status: 200, data: { ok: true, to: `bakery-${deskStamp}@example.test` } })
    expect(sent.at(-1)).toMatchObject({ to: `bakery-${deskStamp}@example.test`, subject: 'Your Quadem client portal code' })
    expect(String(sent.at(-1)?.text)).toContain(before.accessCode)
    expect(String(sent.at(-1)?.text)).toContain('Hello Ama,')
    // No email address: refused, nothing sent.
    const count = sent.length
    expect((await deskCall('/:id/send-code', 'admin', deskIds.noEmail.id)).status).toBe(400)
    expect(sent).toHaveLength(count)
    const log = await payload.find({ collection: 'audit-log', where: { and: [{ action: { equals: 'client.code-sent' } }, { subjectId: { equals: String(deskIds.client.id) } }] } })
    expect(log.totalDocs).toBe(1)
  })

  it('a new code replaces the old one, emailed only when asked', async () => {
    const read = async (id: number | string) => ((await payload.findByID({ collection: 'clients', id, depth: 0 })) as { accessCode: string }).accessCode
    const old = await read(deskIds.client.id)
    const count = sent.length
    const quiet = await deskCall('/:id/new-code', 'admin', deskIds.client.id)
    expect(quiet).toMatchObject({ status: 200, data: { ok: true, emailed: false } })
    const fresh = await read(deskIds.client.id)
    expect(fresh).not.toBe(old)
    expect(fresh).toMatch(/^[A-Za-z0-9]{14}$/)
    expect(sent).toHaveLength(count)
    const loud = await deskCall('/:id/new-code', 'admin', deskIds.client.id, { send: true })
    expect(loud).toMatchObject({ status: 200, data: { emailed: true } })
    expect(String(sent.at(-1)?.text)).toContain(await read(deskIds.client.id))
    // Asked to email a client with no address: refused before the code changes.
    const noEmailCode = await read(deskIds.noEmail.id)
    expect((await deskCall('/:id/new-code', 'admin', deskIds.noEmail.id, { send: true })).status).toBe(400)
    expect(await read(deskIds.noEmail.id)).toBe(noEmailCode)
  })

  it('copies a template’s steps, dated from the start date, and will not double them by accident', async () => {
    const res = await deskCall('/:id/journey-from-template', 'admin', deskIds.client.id, { template: deskIds.template.id })
    expect(res).toMatchObject({ status: 200, data: { ok: true, created: 3 } })
    const steps = await payload.find({ collection: 'client-journey-steps', where: { client: { equals: deskIds.client.id } }, sort: 'order', depth: 0 })
    expect(steps.docs.map((s) => [s.title, s.status, String(s.dueDate).slice(0, 10), s.order, s.clientVisible])).toEqual([
      ['Kickoff call', 'todo', '2026-11-02', 0, true],
      ['Send your logo', 'todo', '2026-11-05', 1, true],
      ['Design review', 'todo', '2026-11-12', 2, false],
    ])
    const again = await deskCall('/:id/journey-from-template', 'admin', deskIds.client.id, { template: deskIds.template.id })
    expect(again).toMatchObject({ status: 409, data: { existing: 3 } })
    const more = await deskCall('/:id/journey-from-template', 'admin', deskIds.client.id, { template: deskIds.template.id, append: true })
    expect(more).toMatchObject({ status: 200, data: { created: 3 } })
    const all = await payload.find({ collection: 'client-journey-steps', where: { client: { equals: deskIds.client.id } }, sort: 'order', depth: 0 })
    expect(all.docs.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect((await deskCall('/:id/journey-from-template', 'admin', deskIds.noEmail.id, { template: 'x' })).status).toBe(404)
  })

  it('the email reads as plain text too, and escapes the business name', () => {
    const m = clientCodeEmail({ name: 'Kofi Mensah', business: 'Kofi & <Sons>', code: 'ABCdef12345678' })
    expect(m.html).toContain('Kofi &amp; &lt;Sons&gt;')
    expect(m.text).toContain('Your code: ABCdef12345678')
    expect(m.text).toContain('https://quademdigital.com/portal/')
    expect(m.html + m.text).not.toContain('—')
  })
})
