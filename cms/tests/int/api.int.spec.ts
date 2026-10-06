import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, describe, it, beforeAll, expect, vi } from 'vitest'
import { createLocalReq, type PayloadRequest } from 'payload'
import { clientCodeEmail, clientDeskEndpoints } from '../../src/lib/clientDesk'
import { invoiceDeskEndpoints } from '../../src/lib/invoiceDesk'
import { draftQuote, quoteDeskEndpoints } from '../../src/lib/quoteDesk'

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

/*
  Invoices from the founder portal (lib/invoiceDesk.ts), on the local test
  database: a draft filled in from the client, invisible to the website's
  account until it is sent, then issued and emailed. Email is stubbed.
*/
describe('invoices from the portal, on a real CMS', () => {
  const st = Date.now()
  const who: Record<string, { id: number | string }> = {}
  const mails: { to?: unknown; subject?: unknown; text?: unknown }[] = []
  let realSend: Payload['sendEmail']
  const run = async (path: string, as: string, body: Record<string, unknown> = {}, id?: number | string) => {
    const req = (await createLocalReq({ user: { ...(who[as] as object), collection: 'users' } as never }, payload)) as PayloadRequest
    req.routeParams = id === undefined ? {} : { id: String(id) }
    req.json = async () => body
    const res = await invoiceDeskEndpoints.find((e) => e.path === path)!.handler(req)
    return { status: res.status, data: (await res.json()) as Record<string, any> }
  }
  const siteSees = async (id: number | string) =>
    (await payload.find({ collection: 'invoices', where: { id: { equals: id } }, user: { ...(who.site as object), collection: 'users' } as never, overrideAccess: false })).totalDocs

  afterAll(() => {
    if (realSend) payload.sendEmail = realSend
  })

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    realSend = payload.sendEmail
    payload.sendEmail = vi.fn(async (m: { to?: unknown; subject?: unknown; text?: unknown }) => {
      mails.push(m)
      return {}
    }) as never
    const user = (k: string, role: string) =>
      payload.create({ collection: 'users', data: { email: `inv-${k}-${st}@example.test`, password: `pw-${st}`, name: `Inv ${k}`, role, status: 'active' } as never })
    who.admin = await user('admin', 'admin')
    who.site = await user('site', 'site')
    who.team = await user('team', 'team')
    const client = (data: Record<string, unknown>) =>
      payload.create({ collection: 'clients', data: { pipelineStatus: 'active', service: 'web-design', ...data } as never })
    who.client = await client({ clientName: `Inv Bakery ${st}`, contactName: 'Ama Owusu', clientEmail: `inv-bakery-${st}@example.test`, slug: `inv-bakery-${st}`, package: 'Business website', price: 6000, currency: 'GHS', customizations: { depositPercent: 50 } })
    who.noEmail = await client({ clientName: `Inv No Email ${st}`, slug: `inv-no-email-${st}`, price: 100, currency: 'GHS' })
  }, 120_000)

  it('only the founder drafts or sends', async () => {
    expect((await run('/draft', 'team', { client: who.client.id })).status).toBe(403)
    expect((await run('/draft', 'site', { client: who.client.id })).status).toBe(403)
    expect((await run('/draft', 'admin', { client: 'x' })).status).toBe(400)
  })

  it('drafts from the client, hidden from the website until sent, then issued and emailed', async () => {
    const draft = await run('/draft', 'admin', { client: who.client.id })
    expect(draft.status).toBe(201)
    const doc = draft.data.doc
    expect(doc).toMatchObject({ currency: 'GHS', depositPercent: 50, amountMinor: 600000, depositMinor: 300000, status: 'pending' })
    expect(doc.items.map((i: any) => [i.description, i.quantity, i.rate])).toEqual([['Business website', 1, 6000]])
    expect(doc.issuedAt ?? null).toBeNull()
    expect(doc.draftNote).toMatch(/agreed fee/)
    expect(doc.invoiceId).toMatch(/^QD-\d{4}-\d{4}$/)
    expect(await siteSees(doc.id)).toBe(0)

    const sent = await run('/:id/send', 'admin', {}, doc.id)
    expect(sent).toMatchObject({ status: 200, data: { ok: true, issued: true, emailed: true, to: `inv-bakery-${st}@example.test` } })
    expect(mails.at(-1)).toMatchObject({ to: `inv-bakery-${st}@example.test`, subject: `Invoice ${doc.invoiceId} from Quadem Digital` })
    expect(String(mails.at(-1)?.text)).toContain('Amount due: GH₵6,000')
    const after = (await payload.findByID({ collection: 'invoices', id: doc.id, depth: 0 })) as any
    expect(after.issuedAt).toBeTruthy()
    expect(after.lastSentAt).toBeTruthy()
    expect(after.draftNote ?? null).toBeNull()
    expect(await siteSees(doc.id)).toBe(1)

    const again = await run('/:id/send', 'admin', {}, doc.id)
    expect(again.data).toMatchObject({ issued: false, emailed: true })
    expect(String(mails.at(-1)?.text)).toContain('Here again is invoice')
    const log = await payload.find({ collection: 'audit-log', where: { and: [{ subjectType: { equals: 'invoices' } }, { subjectId: { equals: String(doc.id) } }] } })
    expect(log.docs.map((d) => d.action).sort()).toEqual(['invoice.drafted', 'invoice.issued', 'invoice.resent'])
  })

  it('the next draft for the same client copies the last invoice', async () => {
    const next = await run('/draft', 'admin', { client: who.client.id })
    expect(next.data.from).toMatch(/^Copied from QD-/)
    expect(next.data.doc.depositPercent).toBe(0)
  })

  it('a client with no email address: drafted, but not sent', async () => {
    const draft = await run('/draft', 'admin', { client: who.noEmail.id })
    const count = mails.length
    const sent = await run('/:id/send', 'admin', {}, draft.data.doc.id)
    expect(sent.status).toBe(400)
    expect(sent.data.error).toMatch(/email address/)
    expect(mails).toHaveLength(count)
    expect(await siteSees(draft.data.doc.id)).toBe(0)
  })
})

/*
  Quotations (lib/quoteDesk.ts), on the local test database: drafted from the
  price list and from notes (with a stand-in model), sent, opened and accepted
  through the website's account, which sets the client up with a draft
  invoice; declined; and quoted to an existing client without a second one.
*/
describe('quotations, on a real CMS', () => {
  const st = Date.now()
  const who: Record<string, { id: number | string }> = {}
  const mails: { to?: unknown; subject?: unknown; text?: unknown }[] = []
  let realSend: Payload['sendEmail']
  const asUser = (k: string) => ({ ...(who[k] as object), collection: 'users' }) as never
  const run = async (path: string, as: string, body: Record<string, unknown> = {}, id?: number | string) => {
    const req = (await createLocalReq({ user: asUser(as) }, payload)) as PayloadRequest
    req.routeParams = id === undefined ? {} : { id: String(id) }
    req.json = async () => body
    const res = await quoteDeskEndpoints.find((e) => e.path === path)!.handler(req)
    return { status: res.status, data: (await res.json()) as Record<string, any> }
  }
  const proposal = async (id: number | string) => (await payload.findByID({ collection: 'proposals', id, depth: 0 })) as any

  afterAll(() => {
    if (realSend) payload.sendEmail = realSend
  })

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    realSend = payload.sendEmail
    payload.sendEmail = vi.fn(async (m: { to?: unknown; subject?: unknown; text?: unknown }) => {
      mails.push(m)
      return {}
    }) as never
    const user = (k: string, role: string) =>
      payload.create({ collection: 'users', data: { email: `qt-${k}-${st}@example.test`, password: `pw-${st}`, name: `Qt ${k}`, role, status: 'active' } as never })
    who.admin = await user('admin', 'admin')
    who.site = await user('site', 'site')
    who.team = await user('team', 'team')
    who.client = await payload.create({ collection: 'clients', data: { clientName: `Qt Existing ${st}`, clientEmail: `qt-existing-${st}@example.test`, slug: `qt-existing-${st}`, pipelineStatus: 'active', service: 'social-media', country: 'GH', currency: 'GHS' } as never })
  }, 120_000)

  it('only the founder drafts; only the website opens a link', async () => {
    expect((await run('/quote-draft', 'team', { currency: 'GHS', contact: { clientName: 'x' }, notes: 'y' })).status).toBe(403)
    expect((await run('/quote-link/open', 'team', { token: 'x'.repeat(24) })).status).toBe(403)
    expect((await run('/quote-draft', 'admin', { currency: 'GHS', contact: { clientName: 'x' } })).status).toBe(400)
  })

  it('from the price list: drafted, sent, opened, accepted, and the client set up with a draft invoice', async () => {
    const d = await run('/quote-draft', 'admin', {
      currency: 'GHS',
      service: 'web-design',
      contact: { clientName: `Qt Bakery ${st}`, contactName: 'Ama Owusu', clientEmail: `qt-bakery-${st}@example.test`, country: 'GH' },
      lines: [{ description: 'Starter website', quantity: 1, rate: 4500 }, { description: 'Domain, first year', quantity: 1, rate: 0 }],
    })
    expect(d.status).toBe(201)
    const q = d.data.doc
    expect(q).toMatchObject({ dealStatus: 'draft', total: 4500, currency: 'GHS', service: 'web-design', pricing: 'custom' })
    expect(q.quoteNumber).toMatch(/^QT-\d{4}-\d{4}$/)
    expect(q.quoteToken).toMatch(/^[A-Za-z0-9_-]{32}$/)

    // A draft's link does not open.
    expect((await run('/quote-link/open', 'site', { token: q.quoteToken })).status).toBe(404)

    const sent = await run('/:id/quote-send', 'admin', {}, q.id)
    expect(sent.data).toMatchObject({ ok: true, first: true, emailed: true, to: `qt-bakery-${st}@example.test` })
    expect(mails.at(-1)).toMatchObject({ subject: `Quotation ${q.quoteNumber} from Quadem Digital` })
    expect(String(mails.at(-1)?.text)).toContain(`/quote/${q.quoteToken}/`)
    const afterSend = await proposal(q.id)
    expect(afterSend.dealStatus).toBe('sent')
    expect(Date.parse(afterSend.validUntil) - Date.now()).toBeGreaterThan(29 * 86_400_000)

    const open = await run('/quote-link/open', 'site', { token: q.quoteToken, record: true })
    expect(open.data).toMatchObject({ number: q.quoteNumber, state: 'open', total: 4500 })
    expect(open.data).not.toHaveProperty('discussionNotes')
    expect((await proposal(q.id)).quoteViewCount).toBe(1)

    expect((await run('/quote-link/accept', 'site', { token: q.quoteToken, name: 'A', agree: true })).status).toBe(400)
    expect((await run('/quote-link/accept', 'site', { token: q.quoteToken, name: 'Ama Owusu' })).status).toBe(400)
    const yes = await run('/quote-link/accept', 'site', { token: q.quoteToken, name: 'Ama Owusu', agree: true, ip: '203.0.113.9', ua: 'Test browser' })
    expect(yes).toMatchObject({ status: 200, data: { ok: true } })
    const done = await proposal(q.id)
    expect(done).toMatchObject({ dealStatus: 'accepted', acceptedName: 'Ama Owusu', acceptedVia: 'online', status: 'provisioned' })
    expect(done.acceptedFrom).toContain('203.0.113.9')
    const client = (await payload.findByID({ collection: 'clients', id: done.client, depth: 0 })) as any
    expect(client).toMatchObject({ clientName: `Qt Bakery ${st}`, pipelineStatus: 'won', service: 'web-design' })
    const invoice = (await payload.findByID({ collection: 'invoices', id: done.invoice, depth: 0 })) as any
    expect(invoice.issuedAt ?? null).toBeNull()
    expect(invoice.items.map((i: any) => [i.description, i.rate])).toEqual([['Starter website', 4500], ['Domain, first year', 0]])
    const told = await payload.find({ collection: 'notifications', where: { key: { equals: `quote-accepted:${q.id}:${who.admin.id}` } } })
    expect(told.totalDocs).toBe(1)

    // Accepting twice does nothing more.
    expect((await run('/quote-link/accept', 'site', { token: q.quoteToken, name: 'Ama Owusu', agree: true })).data).toMatchObject({ ok: true, already: true })
    const clients = await payload.find({ collection: 'clients', where: { clientName: { equals: `Qt Bakery ${st}` } } })
    expect(clients.totalDocs).toBe(1)
  })

  it('from notes, with a stand-in model; then declined online with a reason', async () => {
    const req = (await createLocalReq({ user: asUser('admin') }, payload)) as PayloadRequest
    const { doc, note } = await draftQuote(
      req,
      {
        currency: 'GHS',
        contact: { clientName: `Qt Salon ${st}`, clientEmail: `qt-salon-${st}@example.test` },
        notes: 'Wants a booking site and posts every week.',
        catalogue: [{ id: 999999, name: 'Not on file', priceMinor: 100 }],
      },
      async () => JSON.stringify({ lines: [{ description: 'Booking website', quantity: 1, rate: 6000 }], service: 'web-design', recurring: false, depositPercent: 50, summary: 'A booking website.', deliverables: ['Booking page'], why: 'Nothing on the list fits.', questions: ['Do they take deposits?'] }),
    )
    expect(doc).toMatchObject({ total: 6000, service: 'web-design', depositPercent: 50, summary: 'A booking website.', pricing: 'custom' })
    expect(note).toContain('Nothing on the list fits.')
    expect(note).toContain('estimate')
    expect(note).toContain('Do they take deposits?')
    expect((doc as any).discussionNotes).toBe('Wants a booking site and posts every week.')

    await run('/:id/quote-send', 'admin', {}, doc.id)
    const no = await run('/quote-link/decline', 'site', { token: (doc as any).quoteToken, reason: 'Too dear for now' })
    expect(no.data).toMatchObject({ ok: true })
    expect(await proposal(doc.id)).toMatchObject({ dealStatus: 'declined', declineReason: 'Too dear for now' })
    expect((await run('/quote-link/accept', 'site', { token: (doc as any).quoteToken, name: 'Too Late', agree: true })).status).toBe(409)
  })

  it('to an existing client, accepted by hand: billed again, no second client', async () => {
    const d = await run('/quote-draft', 'admin', { currency: 'GHS', client: who.client.id, lines: [{ description: 'Extra month of posts', quantity: 1, rate: 1500 }] })
    expect(d.data.doc).toMatchObject({ clientName: `Qt Existing ${st}`, service: 'social-media' })
    const yes = await run('/:id/quote-accept', 'admin', { name: 'Said yes on WhatsApp' }, d.data.doc.id)
    expect(yes.data.ok).toBe(true)
    const done = await proposal(d.data.doc.id)
    expect(String(done.client)).toBe(String(who.client.id))
    expect(done.acceptedVia).toBe('by-hand')
    const same = await payload.find({ collection: 'clients', where: { clientName: { equals: `Qt Existing ${st}` } } })
    expect(same.totalDocs).toBe(1)
    const inv = (await payload.findByID({ collection: 'invoices', id: done.invoice, depth: 0 })) as any
    expect(String(inv.client)).toBe(String(who.client.id))
  })
})
