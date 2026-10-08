// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, describe, it, beforeAll, expect, vi } from 'vitest'
import { createLocalReq, type Endpoint, type PayloadRequest } from 'payload'
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
import { Pitches, savePitchFiles } from '../../src/collections/Pitches'
import { leadEndpoints } from '../../src/lib/leadRules'
import { dashboardEndpoint } from '../../src/lib/performanceData'
import { dealEditEndpoint } from '../../src/lib/dealEdit'
import { readTicket, signTicket, stagedUploadEndpoints } from '../../src/lib/stagedUploads'
import { S3Client } from '@aws-sdk/client-s3'
import { pricingEndpoints } from '../../src/lib/pricingRules'
import { DailyReports } from '../../src/collections/DailyReports'

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

  it('corrects an invoice after money came in: never below what was paid, never more on a paid one, and the CMS cannot change the amount behind it', async () => {
    const draft = await run('/draft', 'admin', { client: who.client.id, deal: undefined })
    const id = draft.data.doc.id
    const lines = (...l: [string, number, number][]) => l.map(([description, quantity, rate]) => ({ description, quantity, rate }))
    await payload.update({ collection: 'invoices', id, data: { items: lines(['Business website', 1, 6000]), depositPercent: 50 } as never })
    expect((await run('/:id/correct', 'admin', { reason: 'x', items: lines(['A', 1, 1]) }, id)).data.error).toMatch(/has not been sent/)
    await run('/:id/send', 'admin', {}, id)
    // The deposit comes in, the way the website records a Paystack payment.
    await payload.update({ collection: 'invoices', id, data: { amountPaidMinor: 300000, paystackReference: `dep-${st}`, reminderCount: 2 } as never })

    expect((await run('/:id/correct', 'team', { reason: 'x', items: lines(['A', 1, 1]) }, id)).status).toBe(403)
    expect((await run('/:id/correct', 'admin', { items: lines(['A', 1, 4500]) }, id)).data.error).toMatch(/Say why/)
    const below = await run('/:id/correct', 'admin', { reason: 'Smaller site', items: lines(['Business website', 1, 2500]) }, id)
    expect(below).toMatchObject({ status: 400, data: { error: expect.stringMatching(/less than the GH₵3,000 already paid.*refund on Payments/) } })

    const down = await run('/:id/correct', 'admin', { reason: 'Dropped the blog', items: lines(['Business website', 1, 4000], ['Logo', 1, 500]) }, id)
    expect(down).toMatchObject({ status: 200, data: { ok: true, amountMinor: 450000, status: 'pending', owedMinor: 150000 } })
    let inv = (await payload.findByID({ collection: 'invoices', id, depth: 0 })) as any
    expect(inv).toMatchObject({ amountMinor: 450000, depositMinor: 300000, depositPercent: 50, amountPaidMinor: 300000, reminderCount: 2, paystackReference: `dep-${st}`, currency: 'GHS' })
    expect(inv.issuedAt).toBeTruthy()
    expect(inv.items.map((i: any) => i.description)).toEqual(['Business website', 'Logo'])

    const up = await run('/:id/correct', 'admin', { reason: 'Added a shop', items: lines(['Business website', 1, 6000], ['Shop', 1, 1000]) }, id)
    expect(up.data).toMatchObject({ amountMinor: 700000, status: 'pending', owedMinor: 400000 })

    // The CMS admin cannot change the amount, the deposit or the currency once money is in.
    await expect(payload.update({ collection: 'invoices', id, data: { items: lines(['Business website', 1, 1]) } as never })).rejects.toThrow(/Correct it in the team portal/)
    await expect(payload.update({ collection: 'invoices', id, data: { depositPercent: 20 } as never })).rejects.toThrow(/Correct it in the team portal/)
    await expect(payload.update({ collection: 'invoices', id, data: { currency: 'USD' } as never })).rejects.toThrow(/Correct it in the team portal/)
    // A payment changes no line, so it still saves.
    await payload.update({ collection: 'invoices', id, data: { amountPaidMinor: 700000, status: 'paid', paidAt: new Date().toISOString(), balanceReference: `bal-${st}` } as never })

    const more = await run('/:id/correct', 'admin', { reason: 'Hosting', items: lines(['Business website', 1, 6000], ['Shop', 1, 1500]) }, id)
    expect(more).toMatchObject({ status: 400, data: { error: expect.stringMatching(/paid in full\. Make a new invoice for the extra GH₵500/) } })
    const words = await run('/:id/correct', 'admin', { reason: 'Clearer wording', items: lines(['Business website, five pages', 1, 6000], ['Online shop', 1, 1000]) }, id)
    expect(words.data).toMatchObject({ amountMinor: 700000, status: 'paid', owedMinor: 0 })
    inv = (await payload.findByID({ collection: 'invoices', id, depth: 0 })) as any
    expect(inv).toMatchObject({ status: 'paid', balanceReference: `bal-${st}`, paystackReference: `dep-${st}`, amountPaidMinor: 700000 })
    expect(inv.paidAt).toBeTruthy()

    const log = await payload.find({ collection: 'audit-log', where: { and: [{ action: { equals: 'invoice.corrected' } }, { subjectId: { equals: String(id) } }] }, sort: 'createdAt' })
    expect(log.docs.map((d: any) => d.summary)).toEqual([
      expect.stringMatching(/from GH₵6,000 to GH₵4,500\. Why: Dropped the blog/),
      expect.stringMatching(/from GH₵4,500 to GH₵7,000\. Why: Added a shop/),
      expect.stringMatching(/total unchanged at GH₵7,000\. Why: Clearer wording/),
    ])
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

/*
  Pitches from the portal: a folder arrives in batches because Vercel refuses
  anything over 4.5 MB on the way through. Files are stored on this machine
  (vitest.setup.ts unsets the buckets), never in real storage.
*/
describe('pitches from the portal, on a real CMS', () => {
  const stamp = Date.now()
  const as = (u: unknown) => ({ ...(u as object), collection: 'users' }) as never
  const f = (text: string) => ({ data: Buffer.from(text), size: Buffer.byteLength(text) })
  const ids: Record<string, any> = {}
  const paths = async (pitch: number | string) =>
    ((await payload.find({ collection: 'pitch-assets', where: { pitch: { equals: pitch } }, pagination: false, depth: 0 })).docs as any[]).map((a) => a.path).sort()

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    ids.admin = await payload.create({ collection: 'users', data: { email: `pitch-admin-${stamp}@example.test`, password: `pw-${stamp}-a`, name: 'Pitch admin', role: 'admin' } as never })
    ids.team = await payload.create({ collection: 'users', data: { email: `pitch-team-${stamp}@example.test`, password: `pw-${stamp}-t`, name: 'Pitch team', role: 'team', status: 'active' } as never })
    ids.lead = await payload.create({
      collection: 'leads',
      data: { title: `Pitch lead ${stamp}`, businessName: `Pitch lead ${stamp}`, city: 'Accra', country: 'GH', email: `pitch-lead-${stamp}@example.test` } as never,
      user: as(ids.team),
      overrideAccess: false,
    })
    ids.pitch = await payload.create({
      collection: 'pitches',
      data: { title: `Brand concepts ${stamp}`, slug: `test-brand-${stamp}`, html: '<html><head><link rel="stylesheet" href="css/site.css"></head><body>Logo ideas</body></html>', service: 'branding', lead: ids.lead.id, notes: 'Quoted GH₵ 5,000' } as never,
      user: as(ids.admin),
      overrideAccess: false,
    })
  }, 120_000)

  it('a folder in batches: the first replaces, the rest add, the same path is the new version, other kinds are left out', async () => {
    const req = (await createLocalReq({ user: as(ids.admin) }, payload)) as PayloadRequest
    const id = String(ids.pitch.id)
    expect(await savePitchFiles(req, id, [{ path: 'css/site.css', file: f('body{}') }, { path: 'js/app.js', file: f('1') }], true)).toMatchObject({ files: 2, skipped: [], total: 2 })
    expect(await savePitchFiles(req, id, [{ path: 'js/app.js', file: f('console.log(2)') }, { path: 'data/menu.json', file: f('{}') }, { path: 'tool.exe', file: f('x') }], false)).toMatchObject({
      files: 2,
      skipped: ['tool.exe'],
      total: 3,
    })
    expect(await paths(id)).toEqual(['css/site.css', 'data/menu.json', 'js/app.js'])
    const app = (await payload.find({ collection: 'pitch-assets', where: { and: [{ pitch: { equals: id } }, { path: { equals: 'js/app.js' } }] }, depth: 0 })).docs as any[]
    expect(app).toHaveLength(1)
    expect(app[0].filesize).toBe(14)

    // Over the limit across batches: refused before anything is touched.
    const many = Array.from({ length: 150 }, (_, i) => ({ path: `img/${i}.txt`, file: f('x') }))
    expect(await savePitchFiles(req, id, many, false)).toMatchObject({ error: expect.stringMatching(/153 files\. The limit is 150/) })
    expect(await paths(id)).toHaveLength(3)

    // A self-contained page again: replace with nothing clears the folder.
    expect(await savePitchFiles(req, id, [], true)).toMatchObject({ files: 0, total: 0 })
    expect(await paths(id)).toEqual([])
  }, 120_000)

  it('a team member sees what it pitches and how often it was opened on their lead, never the notes or the page, and cannot add files', async () => {
    const seen = (await payload.findByID({ collection: 'pitches', id: ids.pitch.id, depth: 0, user: as(ids.team), overrideAccess: false })) as any
    expect(seen).toMatchObject({ service: 'branding', slug: `test-brand-${stamp}` })
    expect(seen.notes).toBeUndefined()
    expect(seen.html).toBeUndefined()
    const handler = (Pitches.endpoints || []).find((e) => e.path === '/:id/files')!.handler
    const req = (await createLocalReq({ user: as(ids.team) }, payload)) as PayloadRequest
    req.routeParams = { id: String(ids.pitch.id) }
    expect((await handler(req)).status).toBe(403)
  }, 60_000)

  it('the first open brings the lead forward and says the pitch was opened', async () => {
    await payload.update({ collection: 'pitches', id: ids.pitch.id, data: { firstViewedAt: new Date().toISOString(), viewCount: 1 } as never, user: as(ids.admin), overrideAccess: false })
    const lead = (await payload.findByID({ collection: 'leads', id: ids.lead.id, depth: 0 })) as any
    expect(lead.activity.at(-1)).toMatchObject({ note: 'Pitch opened' })
    const told = await payload.find({ collection: 'notifications', where: { user: { equals: ids.team.id } }, depth: 0 })
    expect((told.docs as any[]).some((n) => /opened their pitch$/.test(n.title))).toBe(true)
  }, 60_000)
})

/*
  The founder works a lead himself, like a team member, without handing it to
  anyone (POST /api/leads/claim). His own leads' follow-ups and pitch openings
  then come to him.
*/
describe('the founder works his own leads, on a real CMS', () => {
  const stamp = Date.now()
  const as = (u: unknown) => ({ ...(u as object), collection: 'users' }) as never
  const ids: Record<string, any> = {}
  const call = async (path: string, who: unknown, body: Record<string, unknown>) => {
    const req = (await createLocalReq({ user: who ? as(who) : undefined }, payload)) as PayloadRequest
    req.json = async () => body
    const res = await leadEndpoints.find((e) => e.path === path)!.handler(req)
    return { status: res.status, data: (await res.json()) as any }
  }
  const lead = async (id: number | string) => (await payload.findByID({ collection: 'leads', id, depth: 0 })) as any
  const enquiry = async (k: string) =>
    (ids[k] = await payload.create({ collection: 'leads', data: { title: `Enquiry ${k} ${stamp}`, businessName: `Enquiry ${k} ${stamp}`, email: `${k}-${stamp}@example.test`, source: 'contact-form' } as never }))

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    ids.admin = await payload.create({ collection: 'users', data: { email: `claim-admin-${stamp}@example.test`, password: `pw-${stamp}-a`, name: 'Claim Founder', role: 'admin' } as never })
    ids.team = await payload.create({ collection: 'users', data: { email: `claim-team-${stamp}@example.test`, password: `pw-${stamp}-t`, name: 'Claim Member', role: 'team', status: 'active' } as never })
    await enquiry('web')
    await enquiry('handed')
    ids.found = await payload.create({
      collection: 'leads',
      data: { title: `Found ${stamp}`, businessName: `Found ${stamp}`, city: 'Accra', country: 'GH', email: `found-${stamp}@example.test` } as never,
      user: as(ids.team),
      overrideAccess: false,
    })
    expect((await call('/handover', ids.admin, { ids: [ids.handed.id], to: ids.team.id })).data.handedOver).toBe(1)
  }, 120_000)

  it('only the founder can', async () => {
    expect((await call('/claim', ids.team, { ids: [ids.web.id] })).status).toBe(403)
    expect((await call('/claim', null, { ids: [ids.web.id] })).status).toBe(401)
  })

  it('an enquiry becomes his to work, and still says it came from the website', async () => {
    const res = await call('/claim', ids.admin, { ids: [ids.web.id] })
    expect(res.data).toMatchObject({ claimed: 1, refused: [] })
    const l = await lead(ids.web.id)
    expect(String(l.assignedTo)).toBe(String(ids.admin.id))
    expect(l.owner ?? null).toBeNull()
    expect(l.activity.at(-1).note).toBe('Claim Founder is working this himself')
    const logged = await payload.find({ collection: 'audit-log', where: { and: [{ action: { equals: 'lead.claimed' } }, { subjectId: { equals: String(ids.web.id) } }] } })
    expect(logged.totalDocs).toBe(1)
    // Again changes nothing.
    expect((await call('/claim', ids.admin, { ids: [ids.web.id] })).data).toMatchObject({ claimed: 0, refused: [] })
  })

  it('never a lead a team member found, nor one a team member is working', async () => {
    const res = await call('/claim', ids.admin, { ids: [ids.found.id, ids.handed.id] })
    expect(res.data.claimed).toBe(0)
    expect(res.data.refused).toEqual([
      { id: ids.found.id, reason: 'found by a team member' },
      { id: ids.handed.id, reason: 'Claim Member is working it: take it back first' },
    ])
  })

  it('his lead can still be handed over, or given back to nobody', async () => {
    await call('/take-back', ids.admin, { ids: [ids.handed.id] })
    expect((await lead(ids.handed.id)).assignedTo ?? null).toBeNull()
    await call('/claim', ids.admin, { ids: [ids.handed.id] })
    const handed = await call('/handover', ids.admin, { ids: [ids.handed.id], to: ids.team.id })
    expect(handed.data.handedOver).toBe(1)
    expect(String((await lead(ids.handed.id)).assignedTo)).toBe(String(ids.team.id))
  })

  it('a pitch on his lead being opened is his to follow up', async () => {
    const pitch = await payload.create({ collection: 'pitches', data: { title: `Claimed pitch ${stamp}`, slug: `claimed-${stamp}`, html: '<p>Hi</p>', lead: ids.web.id } as never })
    await payload.update({ collection: 'pitches', id: pitch.id, data: { firstViewedAt: new Date().toISOString(), viewCount: 1 } as never })
    const told = await payload.find({ collection: 'notifications', where: { user: { equals: ids.admin.id } }, depth: 0 })
    expect((told.docs as any[]).some((n) => /opened their pitch$/.test(n.title))).toBe(true)
  })
})

/*
  Leads from a spreadsheet (POST /api/leads/import), for anyone who adds
  leads: the uploader owns what they upload, the same checks apply, and one
  refused row never undoes the others.
*/
describe('leads from a spreadsheet, on a real CMS', () => {
  const stamp = Date.now()
  const as = (u: unknown) => ({ ...(u as object), collection: 'users' }) as never
  const ids: Record<string, any> = {}
  const call = async (who: unknown, body: Record<string, unknown>) => {
    const req = (await createLocalReq({ user: who ? as(who) : undefined }, payload)) as PayloadRequest
    req.json = async () => body
    const res = await leadEndpoints.find((e) => e.path === '/import')!.handler(req)
    return { status: res.status, data: (await res.json()) as any }
  }
  const row = (n: string, extra: Record<string, unknown> = {}) => ({ businessName: `Import ${n} ${stamp}`, city: 'Kumasi', country: 'gh', whatsapp: `+233 24 ${String(stamp).slice(-3)} ${n.padStart(4, '0')}`, ...extra })
  const byName = async (n: string) => (await payload.find({ collection: 'leads', where: { businessName: { equals: `Import ${n} ${stamp}` } }, depth: 0 })).docs as any[]

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    ids.admin = await payload.create({ collection: 'users', data: { email: `imp-admin-${stamp}@example.test`, password: `pw-${stamp}-a`, name: 'Import Founder', role: 'admin' } as never })
    ids.team = await payload.create({ collection: 'users', data: { email: `imp-team-${stamp}@example.test`, password: `pw-${stamp}-t`, name: 'Import Member', role: 'team', status: 'active' } as never })
    ids.other = await payload.create({ collection: 'users', data: { email: `imp-other-${stamp}@example.test`, password: `pw-${stamp}-o`, name: 'Other Member', role: 'team', status: 'active' } as never })
    // Someone else's lead, for the duplicate check.
    await payload.create({ collection: 'leads', data: { ...row('9001'), country: 'GH' } as never, user: as(ids.other), overrideAccess: false })
  }, 120_000)

  it('only people who add leads can, and a chunk is at most 25', async () => {
    expect((await call(null, { rows: [row('1')] })).status).toBe(401)
    const many = Array.from({ length: 26 }, (_, i) => row(String(100 + i)))
    expect((await call(ids.team, { rows: many })).status).toBe(400)
    expect((await call(ids.team, { rows: many, dryRun: true })).status).toBe(200)
  })

  it('a dry run checks everything and saves nothing', async () => {
    const res = await call(ids.team, { dryRun: true, rows: [row('1'), row('1'), row('2', { whatsapp: '', phone: '', email: '' }), row('3', { niche: 'bakeries' }), row('9001')] })
    expect(res.data.results.map((r: any) => [r.row, r.ok, r.error])).toEqual([
      [1, true, undefined],
      [2, false, 'The same business as row 1.'],
      [3, false, 'Add a phone number, a WhatsApp number or an email, so the lead can be reached.'],
      [4, false, 'That type of business is not one of the choices.'],
      // Another member's lead: said without naming them.
      [5, false, expect.stringMatching(/^Already logged on /)],
    ])
    expect(await byName('1')).toHaveLength(0)
  })

  it('a team member owns and works what they upload, always as their own prospecting, and a refusal does not stop the rest', async () => {
    const res = await call(ids.team, {
      fileName: 'kumasi.xlsx',
      source: 'referral',
      rows: [row('10', { niche: 'food', qualification: 'weak-social', owner: ids.admin.id, assignedTo: ids.admin.id, status: 'won' }), row('9001'), row('11')],
    })
    expect(res.data).toMatchObject({ added: 2, refused: 1 })
    expect(res.data.results[1]).toMatchObject({ row: 2, ok: false })
    for (const n of ['10', '11']) {
      const [l] = await byName(n)
      expect(String(l.owner)).toBe(String(ids.team.id))
      expect(String(l.assignedTo)).toBe(String(ids.team.id))
      expect(l).toMatchObject({ status: 'new', source: 'outreach', country: 'GH' })
    }
    const [ten] = await byName('10')
    expect(ten).toMatchObject({ niche: 'food', qualification: 'weak-social' })
    const logged = await payload.find({ collection: 'audit-log', where: { and: [{ action: { equals: 'leads.imported' } }, { person: { equals: ids.team.id } }] } })
    expect(logged.docs[0]).toMatchObject({ summary: '2 leads added from kumasi.xlsx' })
  })

  it('the founder can say where his came from, and they are his', async () => {
    const res = await call(ids.admin, { source: 'referral', rows: [row('20', { city: '', country: '' })] })
    expect(res.data.added).toBe(1)
    const [l] = await byName('20')
    expect(l).toMatchObject({ source: 'referral' })
    expect(String(l.owner)).toBe(String(ids.admin.id))
    expect(String(l.assignedTo)).toBe(String(ids.admin.id))
  })
})

/* The founder's dashboard (GET /api/dashboard): his alone, read from the real collections. */
describe('the dashboard, on a real CMS', () => {
  it('only the founder sees it, and it reads every section from the records', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const stamp = Date.now()
    const admin = await payload.create({ collection: 'users', data: { email: `dash-admin-${stamp}@example.test`, password: `pw-${stamp}-a`, name: 'Dash Founder', role: 'admin' } as never })
    const team = await payload.create({ collection: 'users', data: { email: `dash-team-${stamp}@example.test`, password: `pw-${stamp}-t`, name: 'Dash Member', role: 'team', status: 'active' } as never })
    const call = async (who: unknown, period = 'month') => {
      const req = (await createLocalReq({ user: who ? ({ ...(who as object), collection: 'users' } as never) : undefined }, payload)) as PayloadRequest
      Object.assign(req, { searchParams: new URLSearchParams({ period }) })
      const res = await dashboardEndpoint.handler(req)
      return { status: res.status, data: (await res.json()) as any }
    }
    expect((await call(null)).status).toBe(401)
    expect((await call(team)).status).toBe(403)
    const res = await call(admin, '12m')
    expect(res.status).toBe(200)
    expect(res.data.period).toMatchObject({ key: '12m', unit: 'month' })
    expect(res.data.period.buckets).toHaveLength(12)
    expect(Object.keys(res.data)).toEqual(['period', 'sales', 'marketing', 'team', 'money'])
    expect(res.data.sales.pipeline).toEqual(expect.objectContaining({ Found: expect.any(Number) }))
    // An unknown period is this month, not an error.
    expect((await call(admin, 'forever')).data.period.key).toBe('month')
  }, 120_000)
})

/*
  Editing a deal from the portal (lib/dealEdit.ts), on the local test
  database: only the founder, the whole record kept, a reason for the money
  once accepted, and an audit row.
*/
describe('editing a deal, on a real CMS', () => {
  it('keeps every field it was not asked to change, and logs why the money changed', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const st = Date.now()
    const admin = await payload.create({ collection: 'users', data: { email: `deal-admin-${st}@example.test`, password: `pw-${st}-a`, name: 'Deal Founder', role: 'admin' } as never })
    const team = await payload.create({ collection: 'users', data: { email: `deal-team-${st}@example.test`, password: `pw-${st}-t`, name: 'Deal Member', role: 'team', status: 'active' } as never })
    const deal = await payload.create({
      collection: 'proposals',
      data: {
        clientName: `Edit Bakery ${st}`,
        service: 'branding',
        currency: 'GHS',
        total: 3000,
        lineItems: [{ description: 'Brand identity', quantity: 1, rate: 3000 }],
        dealStatus: 'active',
        acceptedAt: new Date().toISOString(),
        acceptedVia: 'online',
        quoteNumber: `Q-EDIT-${st}`,
        quoteViewCount: 4,
        depositPercent: 50,
        discussionNotes: 'Keep this',
        journeySteps: [{ title: 'Kick-off', owner: 'quadem', stage: 'onboarding', dueOffsetDays: 0 }],
      } as never,
    })
    const call = async (who: unknown, body: Record<string, unknown>) => {
      const req = (await createLocalReq({ user: who ? ({ ...(who as object), collection: 'users' } as never) : undefined }, payload)) as PayloadRequest
      req.routeParams = { id: String(deal.id) }
      req.json = async () => body
      const res = await dealEditEndpoint.handler(req)
      return { status: res.status, data: (await res.json()) as any }
    }
    expect((await call(null, { data: { summary: 'x' } })).status).toBe(401)
    expect((await call(team, { data: { summary: 'x' } })).status).toBe(403)
    const noWhy = await call(admin, { data: { lineItems: [{ description: 'Brand identity', quantity: 1, rate: 3000 }, { description: 'Business cards', quantity: 1, rate: 500 }] } })
    expect(noWhy).toMatchObject({ status: 400, data: { error: expect.stringMatching(/needs a reason/) } })

    const ok = await call(admin, { data: { summary: 'Logo, colours and cards', lineItems: [{ description: 'Brand identity', quantity: 1, rate: 3000 }, { description: 'Business cards', quantity: 1, rate: 500 }] }, reason: 'They added cards on WhatsApp' })
    expect(ok).toMatchObject({ status: 200, data: { ok: true, changed: ['summary', 'lineItems', 'total'] } })
    const after = (await payload.findByID({ collection: 'proposals', id: deal.id, depth: 0 })) as any
    expect(after).toMatchObject({ total: 3500, summary: 'Logo, colours and cards', dealStatus: 'active', acceptedVia: 'online', quoteNumber: `Q-EDIT-${st}`, quoteViewCount: 4, depositPercent: 50, discussionNotes: 'Keep this', currency: 'GHS' })
    expect(after.acceptedAt).toBeTruthy()
    expect(after.journeySteps.map((s: any) => s.title)).toEqual(['Kick-off'])
    expect(after.lineItems.map((l: any) => l.description)).toEqual(['Brand identity', 'Business cards'])

    expect((await call(admin, { data: { summary: 'Logo, colours and cards' } })).data).toEqual({ ok: true, changed: [] })
    const log = await payload.find({ collection: 'audit-log', where: { and: [{ action: { equals: 'deal.changed' } }, { subjectId: { equals: String(deal.id) } }] } })
    expect(log.docs.map((d: any) => d.summary)).toEqual([expect.stringMatching(/changed the summary, lines, total \(total 3000 GHS to 3500 GHS\)\. Why: They added cards on WhatsApp/)])
  })
})

/*
  An upload that names a stored file instead of sending it is refused
  (lib/uploadGuard.ts). Payload's own request parser builds exactly this
  `file` when a request names a collection and filename; here it is passed
  in directly, which is the same object reaching the same operation.
*/
describe('an upload must carry its file', () => {
  // A real 1x1 PNG: Payload checks what a file actually is, not just its name.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

  it('every upload collection carries the guard', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const uploads = payload.config.collections.filter((c) => c.upload)
    expect(uploads.length).toBeGreaterThan(5)
    for (const c of uploads) expect(c.hooks.beforeOperation.some((h) => h.name === 'refuseFileByName'), c.slug).toBe(true)
  })

  it('refuses a file named from storage, and still takes a real one', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const named = { name: 'agreement.png', data: png, mimetype: 'image/png', size: png.length, clientUploadContext: undefined }
    await expect(payload.create({ collection: 'documents', data: { title: `Guard ${Date.now()}` } as never, file: named as never })).rejects.toThrow(/Send the file itself/)
    const real = await payload.create({ collection: 'documents', data: { title: `Guard real ${Date.now()}` } as never, file: { name: `guard-${Date.now()}.png`, data: png, mimetype: 'image/png', size: png.length } as never })
    expect(real.id).toBeTruthy()
    await payload.delete({ collection: 'documents', id: real.id })
  })
})

/*
  Files too big for the portal's server (lib/stagedUploads.ts): a link that
  takes exactly the chosen file into incoming/<their id>/, then filed as an
  ordinary upload by the person. The bucket is faked: S3Client.send is
  answered here, so nothing reaches storage.
*/
describe('large files, straight to the bucket', () => {
  const env = { ...process.env }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const who: Record<string, any> = {}
  const call = async (path: string, as: unknown, body: Record<string, unknown>) => {
    const req = (await createLocalReq({ user: as ? ({ ...(as as object), collection: 'users' } as never) : undefined }, payload)) as PayloadRequest
    req.json = async () => body
    const res = await stagedUploadEndpoints.find((e) => e.path === path)!.handler(req)
    return { status: res.status, data: (await res.json()) as any }
  }
  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const st = Date.now()
    who.admin = await payload.create({ collection: 'users', data: { email: `big-admin-${st}@example.test`, password: `pw-${st}-a`, name: 'Big Founder', role: 'admin' } as never })
    who.team = await payload.create({ collection: 'users', data: { email: `big-team-${st}@example.test`, password: `pw-${st}-t`, name: 'Big Member', role: 'team', status: 'active' } as never })
    who.other = await payload.create({ collection: 'users', data: { email: `big-other-${st}@example.test`, password: `pw-${st}-o`, name: 'Big Other', role: 'team', status: 'active' } as never })
  }, 120_000)
  afterAll(() => {
    process.env = env
    vi.restoreAllMocks()
  })

  it('a link only for someone who may add files there, of a kind and size it takes', async () => {
    const ask = { collection: 'documents', filename: 'Brand guide.pdf', size: 12_000_000, mimeType: 'application/pdf' }
    expect((await call('/staged-uploads/start', null, ask)).status).toBe(401)
    expect((await call('/staged-uploads/start', who.team, { ...ask, collection: 'media' })).status).toBe(400)
    expect((await call('/staged-uploads/start', who.team, { ...ask, collection: 'signature-requests' })).status).toBe(403)
    expect((await call('/staged-uploads/start', who.team, ask)).status).toBe(503)
    Object.assign(process.env, { S3_DOCUMENTS_BUCKET: 'test-docs', S3_ACCESS_KEY_ID: 'AKIATEST', S3_SECRET_ACCESS_KEY: 'test-secret', S3_REGION: 'us-east-1', S3_ENDPOINT: '' })
    expect((await call('/staged-uploads/start', who.team, { ...ask, size: 30 * 1024 * 1024 })).data.error).toMatch(/30 MB\. The most is 25 MB/)
    expect((await call('/staged-uploads/start', who.team, { ...ask, mimeType: 'application/zip' })).data.error).toMatch(/kind of file/)
    const ok = await call('/staged-uploads/start', who.team, ask)
    expect(ok.status).toBe(200)
    const url = new URL(ok.data.url)
    expect(url.host).toBe('test-docs.s3.amazonaws.com')
    expect(url.pathname).toMatch(new RegExp(`^/incoming/${who.team.id}/[0-9a-f-]{36}/Brand%20guide\\.pdf$`))
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(readTicket(ok.data.ticket, process.env.PAYLOAD_SECRET!)).toMatchObject({ c: 'documents', n: 'Brand guide.pdf', t: 'application/pdf', s: 12_000_000, u: String(who.team.id) })
  })

  it('files it as the person, only from their own holding place, then clears it', async () => {
    Object.assign(process.env, { S3_DOCUMENTS_BUCKET: 'test-docs', S3_ACCESS_KEY_ID: 'AKIATEST', S3_SECRET_ACCESS_KEY: 'test-secret', S3_REGION: 'us-east-1', S3_ENDPOINT: '' })
    const sent: string[] = []
    let arrived = png.length
    vi.spyOn(S3Client.prototype, 'send').mockImplementation((async (cmd: any) => {
      const name = cmd.constructor.name
      sent.push(`${name} ${cmd.input.Key}`)
      if (name === 'HeadObjectCommand') return { ContentLength: arrived }
      if (name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => new Uint8Array(png) } }
      return {}
    }) as never)
    const start = await call('/staged-uploads/start', who.team, { collection: 'documents', filename: 'logo.png', size: png.length, mimeType: 'image/png' })
    const ticket = start.data.ticket

    expect((await call('/staged-uploads/finish', who.team, { ticket: ticket + 'x', data: { title: 'x' } })).status).toBe(400)
    expect((await call('/staged-uploads/finish', who.other, { ticket, data: { title: 'x' } })).status).toBe(403)
    const forged = signTicket({ ...readTicket(ticket, process.env.PAYLOAD_SECRET!)!, k: 'signed/agreement.pdf' }, 'not-the-secret')
    expect((await call('/staged-uploads/finish', who.team, { ticket: forged, data: { title: 'x' } })).status).toBe(400)
    arrived = 5
    expect((await call('/staged-uploads/finish', who.team, { ticket, data: { title: 'x' } })).data.error).toMatch(/not the one chosen/)
    arrived = png.length

    const done = await call('/staged-uploads/finish', who.team, { ticket, data: { title: 'Our logo', kind: 'personal', member: who.team.id } })
    expect(done.status).toBe(201)
    const doc = (await payload.findByID({ collection: 'documents', id: done.data.doc.id, depth: 0 })) as any
    expect(doc).toMatchObject({ title: 'Our logo', mimeType: 'image/png', filesize: png.length })
    const key = readTicket(ticket, process.env.PAYLOAD_SECRET!)!.k
    expect(sent).toEqual(expect.arrayContaining([`HeadObjectCommand ${key}`, `GetObjectCommand ${key}`, `DeleteObjectCommand ${key}`]))
    await payload.delete({ collection: 'documents', id: doc.id })
  })
})

/*
  The price list from the portal (lib/pricingRules.ts): founder only, the whole
  record kept, the texts rewritten, the six homepage bundles kept findable, and
  an audit row for every change.
*/
describe('editing the price list, on a real CMS', () => {
  it('changes a price everywhere it is written, and keeps the homepage bundles findable', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const st = Date.now()
    const admin = await payload.create({ collection: 'users', data: { email: `price-admin-${st}@example.test`, password: `pw-${st}-a`, name: 'Price Founder', role: 'admin' } as never })
    const team = await payload.create({ collection: 'users', data: { email: `price-team-${st}@example.test`, password: `pw-${st}-t`, name: 'Price Member', role: 'team', status: 'active' } as never })
    const call = async (path: string, who: unknown, body: Record<string, unknown>, id?: number | string) => {
      const req = (await createLocalReq({ user: who ? ({ ...(who as object), collection: 'users' } as never) : undefined }, payload)) as PayloadRequest
      req.routeParams = id === undefined ? {} : { id: String(id) }
      req.json = async () => body
      const res = await pricingEndpoints.find((e) => e.path === path)!.handler(req)
      return { status: res.status, data: (await res.json()) as any }
    }
    const bundle = await payload.create({ collection: 'pricingPlans', data: { name: 'Website build', market: 'international', kind: 'bundle', price: 'from $3,000', priceUSD: 3000, priceLabel: 'from $3,000', billingCycle: '', description: 'A site', features: [{ feature: 'Five pages' }], order: 4, calculatorFrom: false } as never })

    expect((await call('/:id/edit', null, { data: { priceUSD: 3200 } }, bundle.id)).status).toBe(401)
    expect((await call('/:id/edit', team, { data: { priceUSD: 3200 } }, bundle.id)).status).toBe(403)
    expect((await call('/:id/edit', admin, { data: { name: 'Website build 2' } }, bundle.id)).data.error).toMatch(/keeps its name/)

    const ok = await call('/:id/edit', admin, { data: { priceUSD: 3200 }, reason: 'New year rates' }, bundle.id)
    expect(ok.status).toBe(200)
    const after = (await payload.findByID({ collection: 'pricingPlans', id: bundle.id, depth: 0 })) as any
    expect(after).toMatchObject({ priceUSD: 3200, price: 'from $3,200', priceLabel: 'from $3,200', description: 'A site', order: 4, kind: 'bundle', market: 'international' })
    expect(after.features.map((f: any) => f.feature)).toEqual(['Five pages'])

    // The CMS admin cannot rename it either.
    await expect(payload.update({ collection: 'pricingPlans', id: bundle.id, data: { name: 'Sites' } as never })).rejects.toThrow(/keeps its name/)

    const added = await call('/add', admin, { data: { name: `Menu design ${st}`, market: 'ghana', priceGHS: 800, features: ['One page', 'Two changes'] } })
    expect(added).toMatchObject({ status: 201, data: { doc: { price: 'GH₵800', kind: 'package', active: true } } })
    expect((await call('/add', admin, { data: { name: 'Website build', market: 'international', kind: 'bundle', priceUSD: 1 } })).data.error).toMatch(/already a homepage bundle/)

    const log = await payload.find({ collection: 'audit-log', where: { action: { in: ['price.changed', 'price.added'] } }, sort: 'createdAt', limit: 10 })
    expect(log.docs.map((d: any) => d.summary)).toEqual(expect.arrayContaining([
      'Website build (everyone else): $3,000 to $3,200. Why: New year rates',
      `Menu design ${st} (Africa) added at GH₵800`,
    ]))
  })
})

/*
  Pictures written from the portal (src/lib/newsletter.ts in the team portal):
  a line becomes Lexical's own upload node pointing at Media. The CMS must
  take that exact node in a guide and a newsletter, and give the picture back
  with its description when read with depth.
*/
describe('pictures in a guide and a newsletter, as the portal writes them', () => {
  it('saves the upload node and reads the picture back', async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const media = await payload.create({ collection: 'media', data: { alt: 'The new menu board' } as never, file: { name: `menu-${Date.now()}.png`, data: png, mimetype: 'image/png', size: png.length } as never })
    // What the portal's writingToLexical makes of "Before / ![...](picture:<id>) / After".
    const body = {
      root: {
        type: 'root', direction: 'ltr', format: '', indent: 0, version: 1,
        children: [
          { type: 'paragraph', direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, children: [{ type: 'text', text: 'Before', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] },
          { type: 'upload', version: 3, format: '', fields: null, id: 'a1b2c3d4e5f6a1b2c3d4e5f6', relationTo: 'media', value: media.id },
          { type: 'paragraph', direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, children: [{ type: 'text', text: 'After', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] },
        ],
      },
    }
    const guide = await payload.create({ collection: 'onboarding-guides', data: { title: `Guide with a picture ${Date.now()}`, content: body } as never })
    const g = (await payload.findByID({ collection: 'onboarding-guides', id: guide.id, depth: 1 })) as any
    const node = g.content.root.children[1]
    expect(node).toMatchObject({ type: 'upload', relationTo: 'media' })
    expect(node.value).toMatchObject({ id: media.id, alt: 'The new menu board' })

    const campaign = await payload.create({ collection: 'emailCampaigns', data: { subject: `With a picture ${Date.now()}`, body, segment: 'test' } as never })
    const c = (await payload.findByID({ collection: 'emailCampaigns', id: campaign.id, depth: 1 })) as any
    expect(c.body.root.children[1].value).toMatchObject({ id: media.id, alt: 'The new menu board' })
  })
})

/*
  Reports you can check: proof set per job role (lib/reportProof.ts), asked
  for when the work is recorded, the work behind a day gathered for checking
  (lib/reportWork.ts), a conversation on a report, a checked mark, and agreed
  days without a report.
*/
describe('reports you can check, on a real CMS', () => {
  const st = Date.now()
  const as = (u: unknown) => ({ ...(u as object), collection: 'users' }) as never
  const ids: Record<string, any> = {}
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const today = new Date().toISOString().slice(0, 10)
  const lead = async (path: string, who: unknown, id: number | string, body: Record<string, unknown>) => {
    const req = (await createLocalReq({ user: who ? as(who) : undefined }, payload)) as PayloadRequest
    req.routeParams = { id: String(id) }
    req.json = async () => body
    const res = await leadEndpoints.find((e) => e.path === path)!.handler(req)
    return { status: res.status, data: (await res.json()) as any }
  }
  const report = async (path: string, who: unknown, opts: { id?: number | string; body?: Record<string, unknown>; search?: Record<string, string> } = {}) => {
    const req = (await createLocalReq({ user: who ? as(who) : undefined }, payload)) as PayloadRequest
    req.routeParams = opts.id === undefined ? {} : { id: String(opts.id) }
    req.json = async () => opts.body ?? {}
    if (opts.search) Object.assign(req, { searchParams: new URLSearchParams(opts.search) })
    const res = await (DailyReports.endpoints as Endpoint[]).find((e) => e.path === path)!.handler(req)
    return { status: res.status, data: (await res.json()) as any }
  }
  const screenshot = (who: unknown, leadId: number | string) =>
    payload.create({ collection: 'documents', data: { title: 'Screenshot', kind: 'record', lead: leadId } as never, file: { name: `shot-${Date.now()}.png`, data: png, mimetype: 'image/png', size: png.length } as never, user: as(who), overrideAccess: false })
  // The last weekday before today, for asking about a day gone by.
  const pastWeekday = (() => {
    const d = new Date(`${today}T00:00:00.000Z`)
    do d.setUTCDate(d.getUTCDate() - 1)
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
    return d.toISOString().slice(0, 10)
  })()

  beforeAll(async () => {
    payload = payload ?? (await getPayload({ config: await config }))
    ids.role = await payload.create({
      collection: 'job-roles',
      data: {
        name: `Proof role ${st}`,
        modules: { pipeline: true },
        reportCounts: [
          { label: 'Researched', source: 'researched', target: 10, proof: 'none' },
          { label: 'First messages', source: 'firstMessages', target: 10, proof: 'words', proofRequired: true, screenshot: 'optional' },
          { label: 'Follow-ups', source: 'followUps', proof: 'words', proofRequired: true, screenshot: 'required' },
          { label: 'Posts published', source: 'typed', target: 3, proof: 'link', proofRequired: true },
        ],
      } as never,
    })
    ids.admin = await payload.create({ collection: 'users', data: { email: `proof-admin-${st}@example.test`, password: `pw-${st}-a`, name: 'Proof Founder', role: 'admin' } as never })
    ids.team = await payload.create({ collection: 'users', data: { email: `proof-team-${st}@example.test`, password: `pw-${st}-t`, name: 'Proof Member', role: 'team', status: 'active', jobRole: ids.role.id } as never })
    ids.other = await payload.create({ collection: 'users', data: { email: `proof-other-${st}@example.test`, password: `pw-${st}-o`, name: 'Other Member', role: 'team', status: 'active' } as never })
    ids.lead = await payload.create({ collection: 'leads', data: { title: `Proof Lead ${st}`, businessName: `Proof Lead ${st}`, city: 'Lagos', country: 'NG', email: `proof-lead-${st}@example.test` } as never, user: as(ids.team), overrideAccess: false })
  }, 120_000)

  it('a contact needs the words, and a screenshot where the role says so', async () => {
    expect((await lead('/:id/log', ids.team, ids.lead.id, { type: 'first-message', kind: 'whatsapp' })).data.error).toMatch(/Paste the message you sent/)
    const ok = await lead('/:id/log', ids.team, ids.lead.id, { type: 'first-message', kind: 'whatsapp', note: 'Hello, I am from Quadem Digital about a website.' })
    expect(ok.status).toBe(200)
    expect((await lead('/:id/log', ids.team, ids.lead.id, { type: 'follow-up', kind: 'whatsapp', note: 'Checking in again' })).data.error).toMatch(/screenshot/)
    const shot = await screenshot(ids.team, ids.lead.id)
    const withShot = await lead('/:id/log', ids.team, ids.lead.id, { type: 'follow-up', kind: 'whatsapp', note: 'Checking in again', proof: shot.id })
    expect(withShot.status).toBe(200)
    const rows = ((await payload.findByID({ collection: 'leads', id: ids.lead.id, depth: 0 })) as any).activity
    expect(rows.at(-1)).toMatchObject({ type: 'follow-up', note: 'Checking in again', proof: shot.id })
    // A file that is not on this lead is not proof of it.
    const elsewhere = await payload.create({ collection: 'leads', data: { title: `Elsewhere ${st}`, businessName: `Elsewhere ${st}`, city: 'Accra', country: 'GH', email: `elsewhere-${st}@example.test` } as never, user: as(ids.team), overrideAccess: false })
    const wrong = await screenshot(ids.team, elsewhere.id)
    expect((await lead('/:id/log', ids.team, ids.lead.id, { type: 'follow-up', kind: 'whatsapp', note: 'Again', proof: wrong.id })).data.error).toMatch(/not there/)
  })

  it('the person who recorded a contact can fill in its missing words, once, and nobody else can', async () => {
    const theirs = await payload.create({ collection: 'leads', data: { title: `Old ${st}`, businessName: `Old ${st}`, city: 'Accra', country: 'GH', email: `old-${st}@example.test` } as never, user: as(ids.other), overrideAccess: false })
    // A role with no proof rules: the old way, saved as "First message sent".
    expect((await lead('/:id/log', ids.other, theirs.id, { type: 'first-message', kind: 'whatsapp' })).status).toBe(200)
    const row = ((await payload.findByID({ collection: 'leads', id: theirs.id, depth: 0 })) as any).activity.at(-1)
    expect(row.note).toBe('First message sent')
    expect((await lead('/:id/proof', ids.admin, theirs.id, { row: row.id, note: 'Hi there' })).status).toBe(403)
    expect((await lead('/:id/proof', ids.other, theirs.id, { row: row.id, note: 'Hello, Quadem Digital here about your website.' })).status).toBe(200)
    expect((await lead('/:id/proof', ids.other, theirs.id, { row: row.id, note: 'Changed my mind' })).status).toBe(409)
    const after = ((await payload.findByID({ collection: 'leads', id: theirs.id, depth: 0 })) as any).activity.at(-1)
    expect(after).toMatchObject({ note: 'Hello, Quadem Digital here about your website.', recordedAt: row.recordedAt })
    expect(String(after.by)).toBe(String(ids.other.id))
  })

  it('typed work with proof is added item by item, and the report counts the items', async () => {
    await expect(payload.create({ collection: 'work-items', data: { count: 'Posts published', text: 'Festive menu' } as never, user: as(ids.team), overrideAccess: false })).rejects.toThrow(/link/)
    await payload.create({ collection: 'work-items', data: { count: 'Posts published', text: 'Festive menu', link: 'https://instagram.com/p/festive' } as never, user: as(ids.team), overrideAccess: false })
    ids.report = await payload.create({ collection: 'daily-reports', data: { city: 'Lagos' } as never, user: as(ids.team), overrideAccess: false })
    const typed = (r: any) => r.typed.find((t: any) => t.label === 'Posts published')?.value
    expect(typed(ids.report)).toBe(1)
    await payload.create({ collection: 'work-items', data: { count: 'Posts published', link: 'https://facebook.com/posts/2' } as never, user: as(ids.team), overrideAccess: false })
    expect(typed(await payload.findByID({ collection: 'daily-reports', id: ids.report.id, depth: 0 }))).toBe(2)
    // Words and screenshots for pipeline counts are proved on the lead, not here.
    expect(ids.report.firstMessagesCount).toBe(1)
  })

  it('the work behind a day is gathered for checking, for the founder or themselves only', async () => {
    expect((await report('/work', ids.other, { search: { user: String(ids.team.id), date: today } })).status).toBe(403)
    const w = await report('/work', ids.admin, { search: { user: String(ids.team.id), date: today } })
    expect(w.status).toBe(200)
    expect(w.data.contacts.map((c: any) => [c.type, c.hasWords, Boolean(c.proof)])).toEqual([['first-message', true, false], ['follow-up', true, true]])
    expect(w.data.leadsAdded.map((l: any) => l.title)).toEqual(expect.arrayContaining([`Proof Lead ${st}`]))
    expect(w.data.items.map((i: any) => i.link).sort()).toEqual(['https://facebook.com/posts/2', 'https://instagram.com/p/festive'])
    expect(w.data.report.id).toBe(ids.report.id)
    expect((await report('/work', ids.team, { search: { user: String(ids.team.id), date: today } })).status).toBe(200)
  })

  it('the founder marks a report checked, without changing anything else in it', async () => {
    expect((await report('/:id/check', ids.team, { id: ids.report.id })).status).toBe(403)
    const before = (await payload.findByID({ collection: 'daily-reports', id: ids.report.id, depth: 0 })) as any
    expect((await report('/:id/check', ids.admin, { id: ids.report.id })).data).toEqual({ ok: true, checked: true })
    const after = (await payload.findByID({ collection: 'daily-reports', id: ids.report.id, depth: 0 })) as any
    expect(after.checkedAt).toBeTruthy()
    expect(String(after.checkedBy)).toBe(String(ids.admin.id))
    expect(after.standard).toEqual(before.standard)
    expect((await report('/:id/check', ids.admin, { id: ids.report.id, body: { checked: false } })).data.checked).toBe(false)
  })

  it('a report has its own conversation, between the founder and its owner', async () => {
    await payload.create({ collection: 'comments', data: { report: ids.report.id, body: 'Can you show me the message you sent?' } as never, user: as(ids.admin), overrideAccess: false })
    const told = await payload.find({ collection: 'notifications', where: { user: { equals: ids.team.id } }, sort: '-createdAt', limit: 1 })
    expect(told.docs[0]).toMatchObject({ title: expect.stringMatching(/asked about your report/), link: `/reports/${ids.report.id}` })
    const theirs = await payload.find({ collection: 'comments', where: { report: { equals: ids.report.id } }, user: as(ids.team), overrideAccess: false })
    expect(theirs.totalDocs).toBe(1)
    const others = await payload.find({ collection: 'comments', where: { report: { equals: ids.report.id } }, user: as(ids.other), overrideAccess: false })
    expect(others.totalDocs).toBe(0)
    await expect(payload.create({ collection: 'comments', data: { report: ids.report.id, body: 'Me too' } as never, user: as(ids.other), overrideAccess: false })).rejects.toThrow()
    await payload.create({ collection: 'comments', data: { report: ids.report.id, body: 'Yes, added it to the lead now.' } as never, user: as(ids.team), overrideAccess: false })
  })

  it('a day without a report: they ask, the founder agrees; or the founder sets it', async () => {
    const asked = await payload.create({ collection: 'report-excusals', data: { date: pastWeekday, reason: 'training', note: 'Setting up my accounts' } as never, user: as(ids.team), overrideAccess: false })
    expect(asked).toMatchObject({ status: 'requested' })
    const toFounder = await payload.find({ collection: 'notifications', where: { user: { equals: ids.admin.id } }, sort: '-createdAt', limit: 1 })
    expect(toFounder.docs[0].title).toMatch(/asks for a day without a report/)
    await expect(payload.create({ collection: 'report-excusals', data: { date: pastWeekday, reason: 'training' } as never, user: as(ids.team), overrideAccess: false })).rejects.toThrow(/already asked/)
    await expect(payload.update({ collection: 'report-excusals', id: asked.id, data: { status: 'approved' } as never, user: as(ids.team), overrideAccess: false })).rejects.toThrow()
    const agreed = await payload.update({ collection: 'report-excusals', id: asked.id, data: { status: 'approved' } as never, user: as(ids.admin), overrideAccess: false })
    expect(agreed).toMatchObject({ status: 'approved', decidedAt: expect.any(String) })
    // Not a day that has a report, not a weekend, not the future, and a reason for "other".
    await expect(payload.create({ collection: 'report-excusals', data: { date: today, reason: 'client' } as never, user: as(ids.team), overrideAccess: false })).rejects.toThrow(/has a report/)
    const sat = new Date(`${today}T00:00:00.000Z`)
    while (sat.getUTCDay() !== 6) sat.setUTCDate(sat.getUTCDate() - 1)
    await expect(payload.create({ collection: 'report-excusals', data: { date: sat.toISOString(), reason: 'client' } as never, user: as(ids.other), overrideAccess: false })).rejects.toThrow(/Weekends/)
    await expect(payload.create({ collection: 'report-excusals', data: { date: '2099-01-05', reason: 'client' } as never, user: as(ids.other), overrideAccess: false })).rejects.toThrow(/not before/)
    await expect(payload.create({ collection: 'report-excusals', data: { date: pastWeekday, reason: 'other' } as never, user: as(ids.other), overrideAccess: false })).rejects.toThrow(/few words/)
    // The founder sets one for someone who cannot: agreed at once.
    const set = await payload.create({ collection: 'report-excusals', data: { user: ids.other.id, date: pastWeekday, reason: 'client', note: 'At the Lekki shoot all day' } as never, user: as(ids.admin), overrideAccess: false })
    expect(set).toMatchObject({ status: 'approved' })
    expect(String((set.decidedBy as any)?.id ?? set.decidedBy)).toBe(String(ids.admin.id))
  })

  it('deleting a person takes their work items and days without a report with them', async () => {
    const gone = await payload.create({ collection: 'users', data: { email: `proof-gone-${st}@example.test`, password: `pw-${st}-g`, name: 'Gone Member', role: 'team', status: 'active', jobRole: ids.role.id } as never })
    await payload.create({ collection: 'work-items', data: { count: 'Posts published', link: 'https://instagram.com/p/gone' } as never, user: as(gone), overrideAccess: false })
    await payload.create({ collection: 'report-excusals', data: { date: pastWeekday, reason: 'training' } as never, user: as(gone), overrideAccess: false })
    await payload.delete({ collection: 'users', id: gone.id })
    const left = await Promise.all([
      payload.count({ collection: 'work-items', where: { user: { equals: gone.id } } }),
      payload.count({ collection: 'report-excusals', where: { user: { equals: gone.id } } }),
    ])
    expect(left.map((c) => c.totalDocs)).toEqual([0, 0])
  }, 60_000)
})
