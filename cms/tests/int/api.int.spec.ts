// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, describe, it, beforeAll, expect, vi } from 'vitest'
import { createLocalReq, type PayloadRequest } from 'payload'
import { clientCodeEmail, clientDeskEndpoints } from '../../src/lib/clientDesk'
import { invoiceDeskEndpoints } from '../../src/lib/invoiceDesk'
import { draftQuote, quoteDeskEndpoints } from '../../src/lib/quoteDesk'
import { sendAgreementForSigning } from '../../src/lib/agreementSigning'
import { newsletterDeskEndpoints } from '../../src/lib/newsletterDesk'
import { runClientOnboarding } from '../../src/lib/onboarding'
import { pickTemplate } from '../../src/lib/onboardingKit'
import { addStarters, STARTER_GUIDES, STARTER_TEMPLATES } from '../../src/lib/onboardingStarters'
import { renderAgreementPdf } from '../../../src/lib/agreementPdf'
import { QuoteRequests, dealService } from '../../src/collections/QuoteRequests'

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

/*
  The onboarding agreement, signed online (lib/agreementSigning.ts), on the
  local test database: onboarding queues it instead of emailing a PDF, and the
  job makes a signing request from the stored agreement, client first then
  the founder, linked to the client, and sends it once. Email is stubbed and
  the website's onboarding route is stood in for.
*/
describe('the agreement, signed online, on a real CMS', () => {
  const st = Date.now()
  const mails: { to?: unknown; subject?: unknown }[] = []
  let realSend: Payload['sendEmail']
  const ids: Record<string, any> = {}
  const pdf = async (business: string) =>
    renderAgreementPdf(business, [
      { kind: 'title', text: 'Service Agreement' },
      { kind: 'paragraph', text: `This agreement is between Quadem Digital Enterprise and ${business}.` },
      { kind: 'heading', text: '1. SIGNATURES' },
      { kind: 'space' },
      { kind: 'signatures' },
    ])
  const upload = async (business: string, documentType: string, client: number | string) => {
    const bytes = await pdf(business)
    return payload.create({
      collection: 'onboarding-documents',
      data: { client, documentType, origin: 'automation', automationKey: `test/${st}/${documentType}/${client}` } as never,
      file: { data: bytes, mimetype: 'application/pdf', name: `test-${st}-${documentType}-${client}.pdf`, size: bytes.byteLength },
    })
  }

  afterAll(() => {
    if (realSend) payload.sendEmail = realSend
    vi.unstubAllGlobals()
  })

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    /* drizzle-kit, loaded only to build the local test database, adds an
       enumerable Array.prototype.random, and the PDF reader the signing
       detector uses refuses to run with one. The live CMS never loads
       drizzle-kit, so this is the test database's problem alone. */
    const random = Object.getOwnPropertyDescriptor(Array.prototype, 'random')
    if (random?.enumerable) Object.defineProperty(Array.prototype, 'random', { ...random, enumerable: false })
    realSend = payload.sendEmail
    payload.sendEmail = vi.fn(async (m: { to?: unknown; subject?: unknown }) => {
      mails.push(m)
      return {}
    }) as never
    // The founder: the admin with the sending address, as on the live CMS.
    const email = (process.env.CMS_FROM_ADDRESS || 'ernest@quademdigital.com').toLowerCase()
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
    ids.founder = found.docs[0] ?? (await payload.create({ collection: 'users', data: { email, password: `pw-${st}`, name: 'Ernest Avorwlanu', role: 'admin' } as never }))
  }, 120_000)

  it('makes the signing request from the stored agreement and sends it, once', async () => {
    const client = await payload.create({ collection: 'clients', data: { clientName: `Sign Bakery ${st}`, contactName: 'Ama Owusu', clientEmail: `sign-bakery-${st}@example.test`, slug: `sign-bakery-${st}`, pipelineStatus: 'active', service: 'web-design' } as never })
    const doc = await upload(`Sign Bakery ${st}`, 'sla', client.id)
    const req = await createLocalReq({}, payload)
    const r = await sendAgreementForSigning(req, client.id, doc.id)
    expect(r).toMatchObject({ ok: true })
    const request = (await payload.findByID({ collection: 'signature-requests', id: r.requestId!, depth: 0, overrideAccess: true })) as any
    expect(request).toMatchObject({ title: `Service Agreement, Sign Bakery ${st}`, status: 'out', signInOrder: true, client: client.id })
    expect(request.signers.map((x: any) => [x.name, x.role])).toEqual([['Ama Owusu', 'Client'], [ids.founder.name || 'Ernest Avorwlanu', 'Service Provider']])
    expect(request.parties.every((p: any) => p.signerId)).toBe(true)
    const sessions = await payload.find({ collection: 'signing-sessions', where: { request: { equals: request.id } }, sort: 'order', overrideAccess: true })
    expect(sessions.docs.map((x: any) => x.status)).toEqual(['sent', 'waiting'])
    expect(mails.some((m) => m.to === `sign-bakery-${st}@example.test`)).toBe(true)

    const count = mails.length
    const again = await sendAgreementForSigning(req, client.id, doc.id)
    expect(again).toMatchObject({ ok: true, already: true, requestId: request.id })
    expect(mails).toHaveLength(count)
  }, 30_000) // renders and reads a real agreement PDF

  it('a lost client is not sent one', async () => {
    const client = await payload.create({ collection: 'clients', data: { clientName: `Sign Lost ${st}`, clientEmail: `sign-lost-${st}@example.test`, slug: `sign-lost-${st}`, pipelineStatus: 'lost', service: 'branding' } as never })
    const doc = await upload(`Sign Lost ${st}`, 'sla', client.id)
    const r = await sendAgreementForSigning(await createLocalReq({}, payload), client.id, doc.id)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/lost/)
  })

  it('onboarding queues the agreement to sign online, two hours on, instead of emailing the PDF', async () => {
    const client = await payload.create({
      collection: 'clients',
      data: { clientName: `Sign Won ${st}`, contactName: 'Kofi Mensah', clientEmail: `sign-won-${st}@example.test`, slug: `sign-won-${st}`, pipelineStatus: 'won', service: 'web-design', price: 6000, startDate: new Date().toISOString() } as never,
    })
    const fresh = (await payload.findByID({ collection: 'clients', id: client.id, depth: 0 })) as any
    expect(fresh.onboardingState.status).toBe('pending')
    const docs = { fileContract: await upload(`Sign Won ${st}`, 'sla', client.id), fileWelcome: await upload(`Sign Won ${st}`, 'guide', client.id), fileSetup: await upload(`Sign Won ${st}`, 'setup', client.id) }
    const calls: string[] = []
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const b = JSON.parse(init.body)
      calls.push(b.step)
      const result = b.step.startsWith('file') ? { ok: true, documentId: (docs as any)[b.step].id } : { ok: true, providerId: `p-${b.step}`, acceptedAt: new Date().toISOString(), scheduledAt: new Date().toISOString() }
      if (b.step === 'welcome') expect(b.client.signOnline).toBe(true)
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const out = await runClientOnboarding({ input: { clientId: String(client.id), requestId: fresh.onboardingState.requestId }, req: await createLocalReq({}, payload) })
    vi.unstubAllGlobals()
    expect(out).toEqual({ output: { ok: true } })
    // The website was asked for everything but the agreement email.
    expect(calls).toEqual(['fileContract', 'fileWelcome', 'fileSetup', 'welcome', 'setup', 'checkin', 'notify'])
    const done = (await payload.findByID({ collection: 'clients', id: client.id, depth: 0 })) as any
    expect(done.onboardingState.status).toBe('complete')
    expect(done.onboardingState.steps.contract.result.method).toBe('sign-online')
    const jobs = await payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'sendAgreementForSigning' } }, sort: '-createdAt', limit: 1, overrideAccess: true })
    const job = jobs.docs[0] as any
    expect(job.input).toMatchObject({ clientId: String(client.id), documentId: String(docs.fileContract.id) })
    const hours = (Date.parse(job.waitUntil) - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(1.9)
    expect(hours).toBeLessThan(2.1)
  })
})

/* How many people each newsletter audience reaches, on the local test database. */
describe('newsletter audiences, on a real CMS', () => {
  it('counts confirmed subscribers once each, by the website’s rule', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const st = Date.now()
    const sub = (k: string, status: string, interests: string[]) =>
      payload.create({ collection: 'subscribers', data: { email: `nl-${k}-${st}@example.test`, status, interests } as never, overrideAccess: true })
    const before = async () => {
      const admin = await payload.create({ collection: 'users', data: { email: `nl-admin-${st}-${Math.random()}@example.test`, password: `pw-${st}`, name: 'Nl Admin', role: 'admin' } as never })
      const req = (await createLocalReq({ user: { ...(admin as object), collection: 'users' } as never }, payload)) as PayloadRequest
      const res = await newsletterDeskEndpoints.find((e) => e.path === '/audience')!.handler(req)
      return (await res.json()) as { counts: Record<string, number>; byStatus: Record<string, number> }
    }
    const start = await before()
    await sub('a', 'subscribed', ['web-design'])
    await sub('b', 'subscribed', [])
    await sub('c', 'subscribed', ['seo'])
    await sub('d', 'pending', ['web-design'])
    await sub('e', 'unsubscribed', [])
    const after = await before()
    expect(after.counts.all - start.counts.all).toBe(3)
    expect(after.counts['web-design'] - start.counts['web-design']).toBe(2)
    expect(after.counts.seo - start.counts.seo).toBe(2)
    expect(after.counts.video - start.counts.video).toBe(1)
    expect((after.byStatus.pending ?? 0) - (start.byStatus.pending ?? 0)).toBe(1)
    const team = await payload.create({ collection: 'users', data: { email: `nl-team-${st}@example.test`, password: `pw-${st}`, name: 'Nl Team', role: 'team', status: 'active' } as never })
    const req = (await createLocalReq({ user: { ...(team as object), collection: 'users' } as never }, payload)) as PayloadRequest
    expect((await newsletterDeskEndpoints.find((e) => e.path === '/audience')!.handler(req)).status).toBe(403)
  }, 60_000)
})

/*
  The starter journeys and guides arrive as drafts, and a draft is never used
  by itself: only once the founder marks it ready does a new client get it.
*/
describe('starter journeys and guides, on a real CMS', () => {
  const st = Date.now()
  let admin: { id: number | string }
  const guide = async (title: string) => (await payload.find({ collection: 'onboarding-guides', where: { title: { equals: title } }, limit: 1 })).docs[0] as any
  const template = async (name: string) => (await payload.find({ collection: 'journey-templates', where: { name: { equals: name } }, limit: 1 })).docs[0] as any
  const client = (k: string, data: Record<string, unknown>) =>
    payload.create({ collection: 'clients', data: { clientName: `Ob ${k} ${st}`, clientEmail: `ob-${k}-${st}@example.test`, slug: `ob-${k}-${st}`, ...data } as never }) as Promise<any>
  const guideOf = async (id: number | string) => ((await payload.findByID({ collection: 'clients', id, depth: 0 })) as any).onboardingGuide ?? null

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    admin = await payload.create({ collection: 'users', data: { email: `ob-admin-${st}@example.test`, password: `pw-${st}`, name: 'Ob admin', role: 'admin', status: 'active' } as never })
    // A database kept from an earlier run starts clean.
    await payload.delete({ collection: 'journey-templates', where: { name: { in: STARTER_TEMPLATES.map((t) => t.name) } } })
    await payload.delete({ collection: 'onboarding-guides', where: { title: { in: STARTER_GUIDES.map((g) => g.title) } } })
  }, 120_000)

  it('adds every starter as a draft, and running it again adds nothing', async () => {
    expect(await addStarters(payload)).toEqual({ templates: STARTER_TEMPLATES.length, guides: STARTER_GUIDES.length })
    const t = await template('Website build')
    expect(t).toMatchObject({ service: 'web-design', ready: false, isDefault: false })
    expect(t.steps).toHaveLength(STARTER_TEMPLATES[0].steps.length)
    const g = await guide('Your website project')
    expect(g).toMatchObject({ service: 'web-design', ready: false })
    expect(g.content.root.children.length).toBeGreaterThan(5)
    expect((await guide('Working with Quadem Digital')).isDefault).toBe(true)
    expect(await addStarters(payload)).toEqual({ templates: 0, guides: 0 })
  })

  it('a later service adds only its own starters: a renamed one never comes back', async () => {
    const web = await template('Website build')
    await payload.update({ collection: 'journey-templates', id: web.id, data: { name: 'Website build 2026' } as never })
    await payload.delete({ collection: 'journey-templates', where: { name: { equals: 'Custom project' } } })
    await payload.delete({ collection: 'onboarding-guides', where: { title: { equals: 'Your custom project' } } })
    expect(await addStarters(payload, undefined, ['custom'])).toEqual({ templates: 1, guides: 1 })
    expect(await template('Website build')).toBeUndefined()
    expect(await template('Custom project')).toMatchObject({ service: 'custom', ready: false })
    await payload.update({ collection: 'journey-templates', id: web.id, data: { name: 'Website build' } as never })
  })

  it('a draft guide is never attached; a ready one is, the moment a client is Won', async () => {
    const early = await client('early', { pipelineStatus: 'won', service: 'web-design' })
    expect(await guideOf(early.id)).toBeNull()

    const web = await guide('Your website project')
    await payload.update({ collection: 'onboarding-guides', id: web.id, data: { ready: true } as never })
    const won = await client('won', { pipelineStatus: 'won', service: 'web-design' })
    expect(await guideOf(won.id)).toBe(web.id)

    // Won later, from a deal in progress.
    const later = await client('later', { pipelineStatus: 'proposal', service: 'web-design' })
    expect(await guideOf(later.id)).toBeNull()
    await payload.update({ collection: 'clients', id: later.id, data: { pipelineStatus: 'won' } as never })
    expect(await guideOf(later.id)).toBe(web.id)

    // Taken off by the founder, it stays off.
    await payload.update({ collection: 'clients', id: later.id, data: { onboardingGuide: null } as never })
    await payload.update({ collection: 'clients', id: later.id, data: { projectName: 'Renamed' } as never })
    expect(await guideOf(later.id)).toBeNull()

    // One chosen by hand is kept.
    const general = await guide('Working with Quadem Digital')
    const chosen = await client('chosen', { pipelineStatus: 'won', service: 'web-design', onboardingGuide: general.id })
    expect(await guideOf(chosen.id)).toBe(general.id)

    // A service with no ready guide of its own gets the ready fallback.
    const before = await client('brand-before', { pipelineStatus: 'won', service: 'branding' })
    expect(await guideOf(before.id)).toBeNull()
    await payload.update({ collection: 'onboarding-guides', id: general.id, data: { ready: true } as never })
    const brand = await client('brand', { pipelineStatus: 'won', service: 'branding' })
    expect(await guideOf(brand.id)).toBe(general.id)
  })

  it('a draft journey is not picked for a new client; one chosen by hand is', async () => {
    // Other tests' ready web-design templates would compete; set them aside.
    await payload.update({ collection: 'journey-templates', where: { and: [{ service: { equals: 'web-design' } }, { name: { not_equals: 'Website build' } }] }, data: { ready: false } as never })
    expect(await pickTemplate(payload, 'web-design')).toBeNull()
    const c = await client('steps', { pipelineStatus: 'won', service: 'web-design', startDate: '2026-11-02T00:00:00.000Z' })
    const run = async (body: Record<string, unknown>) => {
      const req = (await createLocalReq({ user: { ...(admin as object), collection: 'users' } as never }, payload)) as PayloadRequest
      req.routeParams = { id: String(c.id) }
      req.json = async () => body
      const res = await clientDeskEndpoints.find((e) => e.path === '/:id/journey-from-template')!.handler(req)
      return { status: res.status, data: (await res.json()) as Record<string, any> }
    }
    expect((await run({})).status).toBe(404)

    const web = await template('Website build')
    await payload.update({ collection: 'journey-templates', id: web.id, data: { ready: true } as never })
    expect((await pickTemplate(payload, 'web-design'))?.id).toBe(web.id)
    const added = await run({})
    expect(added.data).toMatchObject({ ok: true, created: web.steps.length, template: 'Website build' })
    const steps = await payload.find({ collection: 'client-journey-steps', where: { client: { equals: c.id } }, sort: 'order', limit: 50 })
    expect(steps.docs[0]).toMatchObject({ title: 'Kick-off call', owner: 'quadem', status: 'todo' })
    expect(String((steps.docs[0] as any).dueDate).slice(0, 10)).toBe('2026-11-02')
    expect(String((steps.docs.at(-1) as any).dueDate).slice(0, 10)).toBe('2026-11-30')
    expect(steps.docs.filter((x: any) => x.clientVisible === false)).toHaveLength(1)

    // A draft chosen by hand is the founder's call.
    const brand = await template('Brand identity')
    const more = await run({ template: String(brand.id), append: true })
    expect(more.data).toMatchObject({ ok: true, template: 'Brand identity' })
  })
})

/*
  A lead can want any service, not only a website: the team member says which,
  and the deal Ernest creates from the priced quote carries it.
*/
describe('quote requests for any service, on a real CMS', () => {
  it('one service becomes the deal’s service, several become Several services', () => {
    expect(dealService(['social-media'])).toBe('social-media')
    expect(dealService(['branding', 'video-production'])).toBe('multiple')
    expect(dealService(['branding', 'branding'])).toBe('branding')
    expect(dealService([])).toBeUndefined()
    expect(dealService(null)).toBeUndefined()
  })

  it('a team member must say which service; the deal is drafted with it', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const stamp = Date.now()
    const as = (u: unknown) => ({ ...(u as object), collection: 'users' }) as never
    const admin = await payload.create({ collection: 'users', data: { email: `qr-admin-${stamp}@example.test`, password: `pw-${stamp}-a`, name: 'Quote admin', role: 'admin' } as never })
    const person = await payload.create({ collection: 'users', data: { email: `qr-team-${stamp}@example.test`, password: `pw-${stamp}-t`, name: 'Quote team', role: 'team', status: 'active' } as never })
    // A business that qualifies for something other than a website.
    const lead = (await payload.create({
      collection: 'leads',
      data: { title: `Quote lead ${stamp}`, businessName: `Quote lead ${stamp}`, city: 'Accra', country: 'GH', email: `qr-lead-${stamp}@example.test`, qualification: 'weak-social' } as never,
      user: as(person),
      overrideAccess: false,
    })) as any
    expect(lead.qualification).toBe('weak-social')

    const ask = (data: Record<string, unknown>) =>
      payload.create({ collection: 'quote-requests', data: { lead: lead.id, featuresRequested: 'Posts three times a week and two reels a month', ...data } as never, user: as(person), overrideAccess: false }) as Promise<any>
    await expect(ask({})).rejects.toThrow(/which service/)
    const one = await ask({ services: ['social-media'], whatTheyHave: 'An Instagram page with 300 followers' })
    const several = await ask({ services: ['branding', 'video-production'] })
    expect(one).toMatchObject({ services: ['social-media'], whatTheyHave: 'An Instagram page with 300 followers' })

    const handler = (QuoteRequests.endpoints || []).find((e) => e.path === '/:id/deal')!.handler
    const dealFor = async (id: number | string) => {
      await payload.update({ collection: 'quote-requests', id, data: { status: 'priced', quotedAmountMinor: 300000, quotedCurrency: 'GHS' } as never, user: as(admin), overrideAccess: false })
      const req = (await createLocalReq({ user: as(admin) }, payload)) as PayloadRequest
      req.routeParams = { id: String(id) }
      const res = await handler(req)
      const body = (await res.json()) as { deal: number }
      return (await payload.findByID({ collection: 'proposals', id: body.deal, depth: 0 })) as any
    }
    expect((await dealFor(one.id)).service).toBe('social-media')
    expect((await dealFor(several.id)).service).toBe('multiple')
  }, 120_000)
})
