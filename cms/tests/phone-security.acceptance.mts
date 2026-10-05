import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { getPayload, createLocalReq, refreshOperation } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import configPromise from '../src/payload.config'
import { up } from '../src/migrations/20261005_085843_team_phone_security'
import { codeHash, deviceEndpoints, needsTwoStep } from '../src/lib/deviceSecurity'
import { saveOfflineDraft } from '../src/lib/offlineSubmissions'
import webpush from 'web-push'
import { validSubscription, pushEndpoints, pushNotice } from '../src/lib/push'
import { operationsHealthTask, operationsHealthEndpoint, operationsErrorEndpoint } from '../src/lib/operationsHealth'
import { securityDB } from '../src/lib/securityDatabase'

const connection = new URL(process.env.DATABASE_URL || '')
if (!['127.0.0.1', 'localhost'].includes(connection.hostname) || !connection.pathname.includes('quadem_team_completion')) throw new Error('This test requires the isolated sample database.')
const emails: { to: unknown; text?: string; html?: string }[] = []
const config = await configPromise
config.email = () => ({ name: 'test-capture', defaultFromAddress: 'test@example.test', defaultFromName: 'Test', sendEmail: async (message) => { emails.push(message as never); return { id: randomUUID() } } })
const payload = await getPayload({ config })
const req = await createLocalReq({}, payload)
const db = securityDB(req)
const exists = await db.execute(sql`SELECT to_regclass('public.security_challenges') AS name`)
if (!exists.rows[0].name) await up({ db, payload, req } as never)
const pass: string[] = []
async function test(name: string, fn: () => unknown | Promise<unknown>) { await fn(); pass.push(name); console.log(`PASS ${name}`) }
const password = 'Sample-Phone-Only-2026!'
const admin = await payload.create({ collection: 'users', data: { name: 'QA Phone founder', email: `phone-founder-${Date.now()}@example.test`, password: 'LocalReview-2026-Only!', role: 'admin' } })
const role = await payload.create({ collection: 'job-roles', data: { name: `QA Phone ${Date.now()}`, modules: { pipeline: true }, reportCounts: [{ label: 'Designs delivered', source: 'typed', target: 2 }] } })
const people = []
for (const name of ['member', 'manager', 'other']) people.push(await payload.create({ collection: 'users', data: { name: `QA Phone ${name}`, email: `phone-${name}-${Date.now()}@example.test`, password, role: 'team', status: 'active', country: 'GH', isManager: name === 'manager', jobRole: role.id } }))
const [member, manager, other] = people
const login = (user: typeof member, extras = {}) => payload.login({ collection: 'users', data: { email: user.email, password }, req: { data: extras, headers: new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1' }) } })
let challenge = ''
let otp = ''
await test('Founder and managers require a code; ordinary members may opt in', () => { assert.ok(needsTwoStep(admin)); assert.ok(needsTwoStep(manager)); assert.equal(Boolean(needsTwoStep(member)), false); assert.ok(needsTwoStep({ role: 'team', twoStep: true })) })
await test('Founder token and stored device session both expire after twelve hours', async () => {
  const founderLogin = (extras = {}) => payload.login({ collection: 'users', data: { email: admin.email, password: 'LocalReview-2026-Only!' }, req: { data: extras } })
  let id = ''
  try { await founderLogin(); assert.fail('Founder bypassed second step') } catch (e) { id = (e as { data: { securityChallenge: string } }).data.securityChallenge }
  const code = String(emails.at(-1)?.text).match(/code is (\d{6})/)![1]
  const result = await founderLogin({ securityChallenge: id, securityCode: code })
  const claims = JSON.parse(Buffer.from(result.token!.split('.')[1], 'base64url').toString())
  assert.ok(claims.exp - claims.iat <= 43200 && claims.exp - claims.iat >= 43190)
  const stored = (await db.execute(sql`SELECT expires_at FROM users_sessions WHERE id = ${claims.sid}`)).rows[0]
  assert.equal(new Date(String(stored.expires_at)).getTime(), claims.exp * 1000)
  const headers = new Headers({ authorization: `JWT ${result.token}` })
  const { user } = await payload.auth({ headers })
  const refreshReq = () => createLocalReq({ user, req: { headers, url: 'http://localhost:3027/api/users/refresh-token' } }, payload)
  const refreshed = await refreshOperation({ collection: payload.collections.users, req: await refreshReq() })
  assert.ok(refreshed.exp <= claims.exp)
  await db.execute(sql`UPDATE users_sessions SET created_at = now() - interval '13 hours' WHERE id = ${claims.sid}`)
  await assert.rejects(refreshOperation({ collection: payload.collections.users, req: await refreshReq() }), (e: { status: number }) => e.status === 401)
})
await test('Wrong password sends no code', async () => {
  const before = emails.length
  await assert.rejects(payload.login({ collection: 'users', data: { email: manager.email, password: 'wrong' } }))
  assert.equal(emails.length, before)
})
await test('Correct password alone yields a challenge and no live session', async () => {
  try { await login(manager); assert.fail('Password alone signed in') } catch (error) { assert.equal((error as { status: number }).status, 428); challenge = (error as { data: { securityChallenge: string } }).data.securityChallenge }
  otp = String(emails.at(-1)?.text).match(/code is (\d{6})/)![1]
  const sessions = await db.execute(sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${manager.id}`)
  assert.equal(sessions.rows[0].n, 0)
})
await test('The stored code is an HMAC, never plaintext', async () => {
  const row = (await db.execute(sql`SELECT code_hash FROM security_challenges WHERE challenge = ${challenge}`)).rows[0]
  assert.notEqual(row.code_hash, otp); assert.equal(row.code_hash, codeHash(payload.secret, challenge, manager.id, otp))
})
await test('Wrong code is rejected and its attempt survives the failed login', async () => {
  await assert.rejects(login(manager, { securityChallenge: challenge, securityCode: otp === '000000' ? '000001' : '000000' }), (e: { status: number }) => e.status === 428)
  assert.equal(Number((await db.execute(sql`SELECT attempts FROM security_challenges WHERE challenge = ${challenge}`)).rows[0].attempts), 1)
})
let managerToken = ''
await test('Correct code signs in once', async () => { managerToken = (await login(manager, { securityChallenge: challenge, securityCode: otp })).token!; assert.ok(managerToken) })
await test('A consumed code cannot be replayed', async () => { await assert.rejects(login(manager, { securityChallenge: challenge, securityCode: otp }), (e: { status: number }) => e.status === 428) })
let memberToken = (await login(member)).token!
const authenticatedReq = async (token: string, data?: unknown) => {
  const headers = new Headers({ authorization: `JWT ${token}` })
  const { user } = await payload.auth({ headers })
  return createLocalReq({ user, req: { headers, data } }, payload)
}
await test('Devices list only the caller and marks their current session', async () => {
  const r = await authenticatedReq(managerToken)
  const res = await deviceEndpoints.find((e) => e.path === '/devices')!.handler(r)
  const data = await res.json(); assert.equal(data.devices.length, 1); assert.equal(data.devices[0].current, true); assert.equal(data.devices[0].label, 'Safari on iPhone or iPad')
})
await test('One user cannot revoke another user’s session', async () => {
  const sid = JSON.parse(Buffer.from(managerToken.split('.')[1], 'base64url').toString()).sid
  await deviceEndpoints.find((e) => e.path === '/devices/revoke')!.handler(await authenticatedReq(memberToken, { id: sid }))
  assert.ok((await payload.auth({ headers: new Headers({ authorization: `JWT ${managerToken}` }) })).user)
})
await test('A revoked device token stops authenticating immediately', async () => {
  const token = (await login(member)).token!
  const sid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sid
  await deviceEndpoints.find((e) => e.path === '/devices/revoke')!.handler(await authenticatedReq(memberToken, { id: sid }))
  assert.equal((await payload.auth({ headers: new Headers({ authorization: `JWT ${token}` }) })).user, null)
})
const draft = { id: randomUUID(), owner: String(member.id), kind: 'lead', day: new Date().toISOString().slice(0, 10), fields: { businessName: [`QA Offline ${Date.now()}`], city: ['Accra'], country: ['GH'], phone: [`+23324${String(Date.now()).slice(-7)}`], source: ['outreach'], qualification: ['no-website'] } }
await test('An offline lead uses the member’s own permissions and saves once under retries', async () => {
  const results = await Promise.all([saveOfflineDraft(await authenticatedReq(memberToken), draft), saveOfflineDraft(await authenticatedReq(memberToken), draft)])
  assert.equal(results[0].id, results[1].id)
  assert.equal((await payload.find({ collection: 'leads', where: { businessName: { equals: draft.fields.businessName[0] } } })).totalDocs, 1)
})
await test('A receipt cannot be reused for different content', async () => {
  await assert.rejects(saveOfflineDraft(await authenticatedReq(memberToken), { ...draft, fields: { ...draft.fields, businessName: ['Changed'] } }), (e: { status: number }) => e.status === 409)
})
await test('Another account cannot send the draft', async () => {
  const token = (await login(other)).token!
  await assert.rejects(saveOfflineDraft(await authenticatedReq(token), { ...draft, id: randomUUID() }), (e: { status: number }) => e.status === 403)
})
await test('Yesterday’s report is never submitted as today', async () => {
  await assert.rejects(saveOfflineDraft(await authenticatedReq(memberToken), { ...draft, id: randomUUID(), kind: 'report', day: '2020-01-01', fields: { blockers: ['Offline yesterday'] } }), (e: { status: number }) => e.status === 409)
})
await test('Offline report keeps server counts and accepts only whole-number typed counts', async () => {
  const report = { ...draft, id: randomUUID(), kind: 'report', fields: { city: ['Accra'], 'typed.label': ['Designs delivered'], 'typed.value': ['1.2'] } }
  await assert.rejects(saveOfflineDraft(await authenticatedReq(memberToken), report), (e: { status: number }) => e.status === 400)
  report.fields['typed.value'] = ['2']
  const saved = await saveOfflineDraft(await authenticatedReq(memberToken), report)
  const record = await payload.findByID({ collection: 'daily-reports', id: saved.id! })
  assert.equal(record.typed?.[0].value, 2); assert.ok(record.submittedAt)
  const editing = { ...report, id: randomUUID(), updatedAt: record.updatedAt, fields: { ...report.fields, id: [String(record.id)], blockers: ['Offline old edit'] } }
  await payload.update({ collection: 'daily-reports', id: record.id, data: { blockers: 'Newer online edit' } })
  await assert.rejects(saveOfflineDraft(await authenticatedReq(memberToken), editing), (e: { status: number }) => e.status === 409)
  assert.equal((await payload.findByID({ collection: 'daily-reports', id: record.id })).blockers, 'Newer online edit')
})
await test('Push subscriptions reject private and arbitrary server addresses', () => {
  const keys = { auth: Buffer.alloc(16).toString('base64url'), p256dh: Buffer.alloc(65).toString('base64url') }
  for (const endpoint of ['http://127.0.0.1/push', 'https://169.254.169.254/latest', 'https://evil.example/push', 'https://fcm.googleapis.com.evil.example/push']) assert.equal(validSubscription({ endpoint, keys }), false)
  assert.equal(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/sample', keys }), true)
})
await test('Email-code attempts are capped atomically and expired codes fail', async () => {
  const opaque = randomUUID(), code = '123456'
  await db.execute(sql`INSERT INTO security_challenges (challenge, bucket, user_id, code_hash, expires_at, attempts, created_at, updated_at) VALUES (${opaque}, ${randomUUID()}, ${manager.id}, ${codeHash(payload.secret, opaque, manager.id, code)}, now() + interval '5 minutes', 0, now(), now())`)
  await Promise.all(Array.from({ length: 8 }, async () => { await assert.rejects(login(manager, { securityChallenge: opaque, securityCode: '999999' })) }))
  assert.equal(Number((await db.execute(sql`SELECT attempts FROM security_challenges WHERE challenge = ${opaque}`)).rows[0].attempts), 5)
  await assert.rejects(login(manager, { securityChallenge: opaque, securityCode: code }))
  await db.execute(sql`UPDATE security_challenges SET attempts=0, expires_at=now()-interval '1 minute' WHERE challenge = ${opaque}`)
  await assert.rejects(login(manager, { securityChallenge: opaque, securityCode: code }))
})
await test('An ordinary member can enable two-step; direct field edits cannot disable it', async () => {
  await deviceEndpoints.find((e) => e.path === '/security')!.handler(await authenticatedReq(memberToken, { enabled: true, password }))
  await payload.update({ collection: 'users', id: member.id, data: { twoStep: false }, user: member, overrideAccess: false })
  const record = await payload.findByID({ collection: 'users', id: member.id })
  assert.equal(record.twoStep, true)
  await assert.rejects(login(member), (e: { status: number }) => e.status === 428)
})
await test('Push delivers only to live sessions and removes expired subscriptions', async () => {
  const keys = webpush.generateVAPIDKeys()
  process.env.WEB_PUSH_PUBLIC_KEY = keys.publicKey; process.env.WEB_PUSH_PRIVATE_KEY = keys.privateKey
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/sample-test-only', keys: { auth: Buffer.alloc(16).toString('base64url'), p256dh: Buffer.alloc(65).toString('base64url') } }
  await pushEndpoints.find((e) => e.method === 'post')!.handler(await authenticatedReq(managerToken, { subscription: sub }))
  const original = webpush.sendNotification
  let sent = 0
  webpush.sendNotification = (async () => { sent++; return { statusCode: 201, body: '', headers: {} } }) as typeof original
  try {
    await pushNotice(req, manager.id, 1); assert.equal(sent, 1)
    webpush.sendNotification = (async () => { throw Object.assign(new Error('Gone'), { statusCode: 410 }) }) as typeof original
    await pushNotice(req, manager.id, 2)
    assert.equal(Number((await db.execute(sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${manager.id}`)).rows[0].n), 0)
    await pushEndpoints.find((e) => e.method === 'post')!.handler(await authenticatedReq(managerToken, { subscription: sub }))
    webpush.sendNotification = (async () => { sent++; return { statusCode: 201, body: '', headers: {} } }) as typeof original
    const sid = JSON.parse(Buffer.from(managerToken.split('.')[1], 'base64url').toString()).sid
    await deviceEndpoints.find((e) => e.path === '/devices/revoke')!.handler(await authenticatedReq(managerToken, { id: sid }))
    await pushNotice(req, manager.id, 2); assert.equal(sent, 1)
  } finally { webpush.sendNotification = original }
})
await test('Private security records cannot be read through the member API', async () => {
  for (const collection of ['security-challenges', 'device-sessions', 'push-subscriptions', 'offline-submissions', 'operations-health'] as const) await assert.rejects(payload.find({ collection, user: member, overrideAccess: false }))
})
await test('Password reset returns no token and revokes existing sessions', async () => {
  const resetToken = await payload.forgotPassword({ collection: 'users', data: { email: member.email }, disableEmail: true })
  const reset = await payload.resetPassword({ collection: 'users', data: { token: resetToken!, password } })
  assert.equal(reset.token, undefined)
  assert.equal((await payload.auth({ headers: new Headers({ authorization: `JWT ${memberToken}` }) })).user, null)
})
await test('Monitoring endpoint refuses missing credentials', async () => {
  const res = await operationsHealthEndpoint.handler(req); assert.equal(res.status, 401)
})
await test('Monitoring records worker heartbeat and reports server errors', async () => {
  process.env.OPS_MONITOR_SECRET = 'local-monitor-secret-at-least-thirty-two-characters'
  const monitored = await createLocalReq({ req: { headers: new Headers({ authorization: `Bearer ${process.env.OPS_MONITOR_SECRET}` }) } }, payload)
  await (operationsHealthTask.handler as Function)({ req })
  let response = await operationsHealthEndpoint.handler(monitored)
  assert.equal((await response.json()).workerRunning, true)
  await operationsErrorEndpoint.handler(monitored)
  response = await operationsHealthEndpoint.handler(monitored)
  assert.equal(response.status, 503); assert.ok((await response.json()).serverErrors > 0)
})
await mkdir('/tmp/quadem-team-completion-evidence', { recursive: true })
await writeFile('/tmp/quadem-team-completion-evidence/api-checks.json', JSON.stringify({ passed: pass, count: pass.length }, null, 2))
await writeFile('/tmp/quadem-team-completion-evidence/fixture.json', JSON.stringify({ member: member.email, manager: manager.email, other: other.email, password, memberId: member.id, managerId: manager.id, otherId: other.id }, null, 2))
await payload.destroy()
process.exit(0)
