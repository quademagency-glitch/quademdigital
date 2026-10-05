import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createLocalReq, getPayload, logoutOperation } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import configPromise from '../src/payload.config'
import { securityDB } from '../src/lib/securityDatabase'
import { deviceEndpoints } from '../src/lib/deviceSecurity'
import { teamEndpoints } from '../src/lib/teamAccounts'
import { TRUST_COOKIE, TRUST_SECONDS, trustedTokenHash } from '../src/lib/trustedDevices'
import { up } from '../src/migrations/20261005_110617_trusted_devices'

const connection = new URL(process.env.DATABASE_URL || '')
if (connection.hostname !== '127.0.0.1' || connection.pathname !== '/quadem_team_completion') throw Error('Isolated sample database required')
const emails: { text?: string; to?: unknown }[] = []
const config = await configPromise
config.email = () => ({ name: 'sample-capture', defaultFromAddress: 'qa@example.test', defaultFromName: 'QA', sendEmail: async (message) => { emails.push(message); return { id: randomUUID() } } })
const payload = await getPayload({ config })
const db = securityDB(await createLocalReq({}, payload))
if (!(await db.execute(sql`SELECT to_regclass('public.trusted_devices') AS name`)).rows[0].name) await up({ db, payload } as never)
const password = 'Sample-Trusted-Device-2026!'
const makeUser = (name: string) => payload.create({ collection: 'users', data: { name: `QA Trust ${name}`, email: `trust-${name}-${Date.now()}@example.test`, password, role: 'admin' } })
const owner = await makeUser('owner')
const other = await makeUser('other')
const passed: string[] = []
async function test(name: string, fn: () => unknown | Promise<unknown>) { await fn(); passed.push(name); console.log('PASS', name) }
const login = async (user = owner, extras: Record<string, unknown> = {}, cookie = '', pass = password) => {
  const responseHeaders = new Headers()
  const result = await payload.login({ collection: 'users', data: { email: user.email, password: pass }, req: { data: extras, context: {}, responseHeaders, headers: new Headers({ cookie: cookie ? `${TRUST_COOKIE}=${cookie}` : '', 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1' }) } })
  return { ...result, responseHeaders }
}
const challenge = async (user = owner, cookie = '', pass = password) => {
  // These cases test device trust, not resend timing (covered separately).
  // Remove only this newly created sample account's previous code bucket.
  await db.execute(sql`DELETE FROM security_challenges WHERE user_id = ${user.id}`)
  try { await login(user, { trustDevice: true }, cookie, pass); assert.fail('Expected email code') }
  catch (error) { assert.equal((error as { status: number }).status, 428); return (error as { data: { securityChallenge: string } }).data.securityChallenge }
}
const code = (user = owner) => String(emails.filter((email) => JSON.stringify(email.to).includes(user.email)).at(-1)?.text).match(/code is (\d{6})/)![1]
const authReq = async (token: string, data?: unknown, all = false) => {
  const headers = new Headers({ authorization: `JWT ${token}` })
  const { user } = await payload.auth({ headers })
  assert.ok(user)
  return createLocalReq({ user, req: { headers, data, searchParams: new URLSearchParams(all ? 'allSessions=true' : '') } }, payload)
}
const count = async () => Number((await db.execute(sql`SELECT count(*)::int AS n FROM trusted_devices WHERE user_id = ${owner.id}`)).rows[0].n)
const clearChallenges = () => db.execute(sql`DELETE FROM security_challenges WHERE user_id = ${owner.id}`)
let cookie = '', session = '', secondSession = '', trustedId = 0

await test('Requesting trust without a verified code creates no trusted record or session', async () => {
  await challenge(); assert.equal(await count(), 0)
  assert.equal(Number((await db.execute(sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${owner.id}`)).rows[0].n), 0)
})
await test('Wrong code cannot create trust', async () => {
  const id = await challenge(); const wrong = code() === '000000' ? '111111' : '000000'
  await assert.rejects(login(owner, { securityChallenge: id, securityCode: wrong, trustDevice: true }), (e: { status: number }) => e.status === 428)
  assert.equal(await count(), 0)
})
async function enroll(pass = password) {
  await clearChallenges()
  const id = await challenge(owner, '', pass)
  const result = await login(owner, { securityChallenge: id, securityCode: code(), trustDevice: true }, '', pass)
  const header = result.responseHeaders.get('set-cookie') || ''
  assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=Lax/)
  assert.match(header, new RegExp(`Max-Age=${TRUST_SECONDS}`))
  cookie = header.match(/qd_trusted_device=([a-f0-9]{64})/)![1]
  session = result.token!
  const row = (await db.execute(sql`SELECT id, token_hash FROM trusted_devices WHERE user_id = ${owner.id}`)).rows[0]
  trustedId = Number(row.id)
  assert.equal(row.token_hash, trustedTokenHash(payload.secret, cookie)); assert.notEqual(row.token_hash, cookie)
  assert.equal('trustedDeviceToken' in result, false)
}
await test('Correct code creates a 30-day HttpOnly Secure cookie and stores only its hash', () => enroll())
await test('A trusted browser still needs its password and skips only the email code', async () => {
  const before = emails.length
  secondSession = (await login(owner, {}, cookie)).token!
  assert.ok(secondSession); assert.equal(emails.length, before)
  await assert.rejects(login(owner, {}, cookie, 'Wrong-password'), (e: { status: number }) => e.status === 401)
  assert.equal(emails.length, before)
})
await test('Trust is bound to its account and tampering falls back to an email code', async () => {
  await challenge(other, cookie)
  await challenge(owner, (cookie[0] === 'a' ? 'b' : 'a') + cookie.slice(1))
})
await test('Expired trust requires an email code and returning sign-in does not extend expiry', async () => {
  const before = (await db.execute(sql`SELECT expires_at FROM trusted_devices WHERE id = ${trustedId}`)).rows[0].expires_at
  const result = await login(owner, {}, cookie)
  assert.equal(result.responseHeaders.get('set-cookie'), null)
  const after = (await db.execute(sql`SELECT expires_at FROM trusted_devices WHERE id = ${trustedId}`)).rows[0].expires_at
  assert.equal(String(after), String(before))
  await db.execute(sql`UPDATE trusted_devices SET expires_at = now() - interval '1 second' WHERE id = ${trustedId}`)
  await challenge(owner, cookie)
  await db.execute(sql`UPDATE trusted_devices SET expires_at = ${String(before)} WHERE id = ${trustedId}`)
})
await test('Trusted-device listing omits secrets and is scoped to the signed-in owner', async () => {
  const response = await deviceEndpoints.find((e) => e.path === '/devices')!.handler(await authReq(session))
  const data = await response.json()
  assert.equal(data.trustedDevices.length, 1); assert.equal(data.trustedDevices[0].current, true)
  assert.deepEqual(Object.keys(data.trustedDevices[0]).sort(), ['createdAt','current','expiresAt','id','label','lastUsedAt'].sort())
  await assert.rejects(payload.find({ collection: 'trusted-devices', user: owner, overrideAccess: false }))
})
await test('Another account cannot revoke a trusted device', async () => {
  const id = await challenge(other); const otherToken = (await login(other, { securityChallenge: id, securityCode: code(other) })).token!
  const response = await deviceEndpoints.find((e) => e.path === '/trusted-devices/revoke')!.handler(await authReq(otherToken, { id: trustedId }))
  assert.equal(response.status, 200); assert.equal(await count(), 1)
})
await test('Removing trust ends every session associated with that device', async () => {
  const response = await deviceEndpoints.find((e) => e.path === '/trusted-devices/revoke')!.handler(await authReq(session, { id: trustedId }))
  assert.equal((await response.json()).current, true); assert.equal(await count(), 0)
  for (const token of [session, secondSession]) assert.equal((await payload.auth({ headers: new Headers({ authorization: `JWT ${token}` }) })).user, null)
  await challenge(owner, cookie)
})
await test('Ordinary sign-out preserves trust; sign-out everywhere revokes it', async () => {
  await enroll()
  await logoutOperation({ collection: payload.collections.users, req: await authReq(session), allSessions: false })
  assert.equal(await count(), 1)
  session = (await login(owner, {}, cookie)).token!
  await logoutOperation({ collection: payload.collections.users, req: await authReq(session, undefined, true), allSessions: true })
  assert.equal(await count(), 0); await challenge(owner, cookie)
})
await test('Password changes invalidate device trust', async () => {
  await enroll()
  const changed = password + '-changed'
  await payload.update({ collection: 'users', id: owner.id, data: { password: changed } })
  assert.equal(await count(), 0)
  await challenge(owner, cookie, changed)
  await payload.update({ collection: 'users', id: owner.id, data: { password } })
})
await test('Password recovery also invalidates device trust and returns no session', async () => {
  await enroll()
  const resetToken = await payload.forgotPassword({ collection: 'users', data: { email: owner.email }, disableEmail: true })
  const result = await payload.resetPassword({ collection: 'users', data: { token: resetToken!, password } })
  assert.equal(result.token, undefined); assert.equal(await count(), 0)
  await challenge(owner, cookie)
})
await test('Changing the account email clears existing device trust', async () => {
  await enroll()
  await payload.update({ collection: 'users', id: owner.id, data: { email: `changed-${owner.email}` } })
  assert.equal(await count(), 0)
  await payload.update({ collection: 'users', id: owner.id, data: { email: owner.email } })
})
await test('Changing the security role clears existing device trust', async () => {
  await enroll()
  await payload.update({ collection: 'users', id: owner.id, data: { role: 'editor' } })
  assert.equal(await count(), 0)
  await payload.update({ collection: 'users', id: owner.id, data: { role: 'admin' } })
})
await test('Remembered trust cannot replace a fresh code when changing two-step settings', async () => {
  await payload.update({ collection: 'users', id: owner.id, data: { role: 'team', status: 'active', twoStep: true } })
  await enroll()
  const req = await authReq(session, { enabled: false, password })
  req.headers.set('cookie', `${TRUST_COOKIE}=${cookie}`)
  await clearChallenges()
  await assert.rejects(deviceEndpoints.find((e) => e.path === '/security')!.handler(req), (e: { status: number }) => e.status === 428)
  await payload.update({ collection: 'users', id: owner.id, data: { role: 'admin' } })
})
await test('Administrator sign-out-everywhere also revokes device trust', async () => {
  await enroll()
  const req = await authReq(session)
  req.routeParams = { id: String(owner.id) }
  const result = await teamEndpoints.find((e) => e.path === '/:id/sign-out-everywhere')!.handler(req)
  assert.equal(result.status, 200); assert.equal(await count(), 0)
  await challenge(owner, cookie)
})
await test('First-login activation happens before device trust is saved', async () => {
  await payload.update({ collection: 'users', id: owner.id, data: { role: 'team', status: 'invited', twoStep: true } })
  await enroll()
  const before = emails.length
  assert.ok((await login(owner, {}, cookie)).token)
  assert.equal(emails.length, before)
  await payload.update({ collection: 'users', id: owner.id, data: { role: 'admin' } })
})

await clearChallenges()
const newcomer = await payload.create({ collection: 'users', data: { name: 'QA Trust newcomer', email: `trust-newcomer-${Date.now()}@example.test`, password, role: 'team', status: 'invited', twoStep: true } })
await writeFile('/tmp/quadem-team-completion-evidence/trusted-device-fixture.json', JSON.stringify({ email: owner.email, password, id: owner.id, other: other.email, newcomer: { email: newcomer.email, id: newcomer.id, password } }, null, 2), { mode: 0o600 })
await writeFile('/tmp/quadem-team-completion-evidence/trusted-device-api-checks.json', JSON.stringify({ passed, count: passed.length }, null, 2))
await payload.destroy()
process.exit(0)
