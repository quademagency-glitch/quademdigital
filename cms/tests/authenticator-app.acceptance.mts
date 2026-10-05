/*
  Authenticator-app sign-in (spec 14.11) on an isolated sample Postgres
  database, the way tests/phone-security.acceptance.mts and
  tests/trusted-devices.acceptance.mts run:
    DATABASE_URL=postgres://postgres@127.0.0.1:<port>/quadem_team_completion NODE_ENV=production tsx tests/authenticator-app.acceptance.mts
*/
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createLocalReq, getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import configPromise from '../src/payload.config'
import { securityDB } from '../src/lib/securityDatabase'
import { TRUST_COOKIE } from '../src/lib/trustedDevices'
import { authenticatorEndpoints, fromBase32, hotp, stepAt } from '../src/lib/authenticatorApp'

const connection = new URL(process.env.DATABASE_URL || '')
if (connection.hostname !== '127.0.0.1' || connection.pathname !== '/quadem_team_completion') throw Error('Isolated sample database required')
const emails: { text?: string; to?: unknown }[] = []
const config = await configPromise
config.email = () => ({ name: 'sample-capture', defaultFromAddress: 'qa@example.test', defaultFromName: 'QA', sendEmail: async (message) => { emails.push(message); return { id: randomUUID() } } })
const payload = await getPayload({ config })
const db = securityDB(await createLocalReq({}, payload))
const password = 'Sample-Authenticator-2026!'
const stamp = Date.now()
const member = await payload.create({ collection: 'users', data: { name: 'QA App member', email: `app-member-${stamp}@example.test`, password, role: 'team', status: 'active' } as never })
const admin = await payload.create({ collection: 'users', data: { name: 'QA App founder', email: `app-founder-${stamp}@example.test`, password: 'LocalReview-2026-Only!', role: 'admin' } as never })
const passed: string[] = []
async function test(name: string, fn: () => unknown | Promise<unknown>) { await fn(); passed.push(name); console.log('PASS', name) }

const endpoint = (path: string) => authenticatorEndpoints.find((e) => e.path === path)!
const call = async (path: string, user: unknown, data: Record<string, unknown> = {}, routeParams: Record<string, string> = {}) => {
  const req = await createLocalReq({ user: { ...(user as object), collection: 'users' } as never, req: { data, routeParams } as never }, payload)
  const res = await endpoint(path).handler(req)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const login = async (extras: Record<string, unknown> = {}, cookie = '', context: Record<string, unknown> = {}) => {
  const responseHeaders = new Headers()
  const result = await payload.login({ collection: 'users', data: { email: member.email, password }, req: { data: extras, context, responseHeaders, headers: new Headers({ cookie: cookie ? `${TRUST_COOKIE}=${cookie}` : '', 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1' }) } as never })
  return { ...result, responseHeaders }
}
const refused = async (p: Promise<unknown>) => { try { await p; return null } catch (e) { return e as { status: number; message: string; data?: { securityChallenge?: string; method?: string } } } }
const raw = async () => (await payload.db.findOne({ collection: 'users', where: { id: { equals: member.id } } })) as Record<string, unknown>
const clearWrong = () => db.execute(sql`DELETE FROM security_challenges WHERE bucket LIKE ${`app-fails:${member.id}:%`}`)

let secret = ''
let recovery: string[] = []
let lastStep = 0

await test('Setting up needs the password, and nothing changes until a code from the app confirms it', async () => {
  assert.equal((await call('/security/app/start', member, { password: 'wrong' })).status, 400)
  const start = await call('/security/app/start', member, { password })
  assert.equal(start.status, 200)
  secret = String(start.body.secret)
  assert.match(String(start.body.uri), /^otpauth:\/\/totp\/Quadem%3A/)
  assert.equal((await raw()).twoStepMethod, 'email')
  assert.equal((await call('/security/app/confirm', member, { code: '000000' })).status, 400)
  await clearWrong()
  lastStep = stepAt(Date.now())
  const confirm = await call('/security/app/confirm', member, { code: hotp(fromBase32(secret), lastStep) })
  assert.equal(confirm.status, 200)
  recovery = confirm.body.recoveryCodes as string[]
  assert.equal(recovery.length, 8)
  const u = await raw()
  assert.equal(u.twoStepMethod, 'app')
  assert.equal(u.twoStep, true)
  assert.ok(!String(u.totpSecret).includes(secret), 'the secret is sealed')
})

await test('Signing in asks for the app code, not an email', async () => {
  const before = emails.length
  const e = await refused(login())
  assert.equal(e?.status, 428)
  assert.equal(e?.data?.method, 'app')
  assert.match(String(e?.data?.securityChallenge), /^[a-f0-9]{64}$/)
  assert.equal(emails.length, before, 'no email code is sent to an app user')
})

await test('The current code signs in; the same code cannot be used again', async () => {
  const code = hotp(fromBase32(secret), lastStep + 1)
  assert.ok((await login({ securityCode: code })).token)
  const replay = await refused(login({ securityCode: code }))
  assert.equal(replay?.status, 428)
})

await test('Five wrong codes stop further tries for fifteen minutes, even a right one', async () => {
  await clearWrong()
  for (let i = 0; i < 5; i++) assert.equal((await refused(login({ securityCode: '000000' })))?.status, 428)
  const blocked = await refused(login({ securityCode: hotp(fromBase32(secret), lastStep - 1) }))
  assert.equal(blocked?.status, 429)
  await clearWrong()
})

await test('A recovery code signs in once and tells the person', async () => {
  const notices = Number((await db.execute(sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${member.id}`)).rows[0].n)
  assert.ok((await login({ securityCode: recovery[0] })).token)
  assert.equal((await refused(login({ securityCode: recovery[0] })))?.status, 428)
  assert.equal((await call('/security/app', member)).body.recoveryLeft, 7)
  assert.equal(Number((await db.execute(sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${member.id}`)).rows[0].n), notices + 1)
  await clearWrong()
})

await test('Changing the two-step preference still asks for an email code, and the app records do not use up the email limit', async () => {
  const before = emails.length
  const e = await refused(login({}, '', { requireEmailCode: true }))
  assert.equal(e?.status, 428)
  assert.notEqual(e?.data?.method, 'app')
  assert.equal(emails.length, before + 1)
})

await test('An app code can trust this device; a trusted device then skips the code', async () => {
  await db.execute(sql`DELETE FROM security_challenges WHERE bucket LIKE ${`app-step:${member.id}:%`}`)
  const first = await login({ securityCode: hotp(fromBase32(secret), stepAt(Date.now())), trustDevice: true })
  const cookie = /qd_trusted_device=([a-f0-9]{64})/.exec(first.responseHeaders.get('set-cookie') ?? '')?.[1]
  assert.ok(cookie, 'a trust cookie is set')
  assert.ok((await login({}, cookie)).token)
})

await test('Nobody reads the secret through the API, not the person and not Ernest', async () => {
  const self = (await payload.findByID({ collection: 'users', id: member.id, overrideAccess: false, user: { ...member, collection: 'users' } as never })) as Record<string, unknown>
  assert.equal(self.twoStepMethod, 'app')
  assert.equal(self.totpSecret, undefined)
  assert.equal(self.totpPending, undefined)
  const asAdmin = (await payload.findByID({ collection: 'users', id: member.id, overrideAccess: false, user: { ...admin, collection: 'users' } as never })) as Record<string, unknown>
  assert.equal(asAdmin.totpSecret, undefined)
  await assert.rejects(payload.update({ collection: 'users', id: member.id, data: { twoStepMethod: 'email' } as never, overrideAccess: false, user: { ...member, collection: 'users' } as never }).then((d) => {
    if ((d as { twoStepMethod?: string }).twoStepMethod === 'email') throw new Error('changed')
    throw new Error('ignored')
  }), /ignored/)
})

await test('Ernest can reset a lost phone: email codes again, and trusted devices removed', async () => {
  assert.equal((await call('/:id/security/app/reset', member, {}, { id: String(member.id) })).status, 403)
  const r = await call('/:id/security/app/reset', admin, {}, { id: String(member.id) })
  assert.equal(r.status, 200)
  assert.equal((await raw()).twoStepMethod, 'email')
  assert.equal(Number((await db.execute(sql`SELECT count(*)::int AS n FROM trusted_devices WHERE user_id = ${member.id}`)).rows[0].n), 0)
  const e = await refused(login())
  assert.equal(e?.status, 428)
  assert.notEqual(e?.data?.method, 'app')
})

await test('Back to email with the password, by the person', async () => {
  const start = await call('/security/app/start', member, { password })
  secret = String(start.body.secret)
  await db.execute(sql`DELETE FROM security_challenges WHERE bucket LIKE ${`app-step:${member.id}:%`}`)
  assert.equal((await call('/security/app/confirm', member, { code: hotp(fromBase32(secret), stepAt(Date.now())) })).status, 200)
  await db.execute(sql`DELETE FROM security_challenges WHERE bucket LIKE ${`password-check:${member.id}:%`}`)
  assert.equal((await call('/security/app/off', member, { password: 'wrong' })).status, 400)
  assert.equal((await call('/security/app/off', member, { password })).status, 200)
  assert.equal((await raw()).twoStepMethod, 'email')
  assert.equal(Number((await db.execute(sql`SELECT count(*)::int AS n FROM security_challenges WHERE bucket LIKE ${`recovery:${member.id}:%`}`)).rows[0].n), 0)
})

for (const u of [member, admin]) await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
console.log(`\n${passed.length} passed`)
process.exit(0)
