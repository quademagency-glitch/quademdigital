/*
  Deleting a test account (spec 2.2) on an isolated sample Postgres database:
  the account goes with its daily reports, their saved history, its payouts'
  history and its profile photo. Found by the Phase 4 sign-off on 6 October
  2026, when the report history blocked the QA test member's delete.
    DATABASE_URL=postgres://postgres@127.0.0.1:<port>/quadem_team_completion NODE_ENV=production S3_BUCKET= S3_DOCUMENTS_BUCKET= tsx tests/account-delete.acceptance.mts
*/
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { getPayload } from 'payload'
import configPromise from '../src/payload.config'

const connection = new URL(process.env.DATABASE_URL || '')
if (connection.hostname !== '127.0.0.1' || connection.pathname !== '/quadem_team_completion') throw Error('Isolated sample database required')
if (process.env.S3_BUCKET || process.env.S3_DOCUMENTS_BUCKET) throw Error('Run without the storage buckets, so nothing reaches real storage')
const payload = await getPayload({ config: await configPromise })
const stamp = Date.now()
const person = await payload.create({ collection: 'users', data: { name: 'QA delete check', email: `qa-delete-${stamp}@example.test`, password: 'Sample-Delete-2026!', role: 'team', status: 'ended' } as never, overrideAccess: true })
const id = person.id
const today = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
const report = await payload.create({ collection: 'daily-reports', data: { user: id, date: today, repliesSummary: 'QA' } as never, overrideAccess: true, user: { ...person, collection: 'users' } as never })
await payload.update({ collection: 'daily-reports', id: report.id, data: { blockers: 'QA, second save' } as never, overrideAccess: true, user: { ...person, collection: 'users' } as never })
const webp = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#0b1621' } }).webp().toBuffer()
await payload.create({ collection: 'profile-photos', data: { owner: id } as never, file: { data: webp, mimetype: 'image/webp', name: `qa-${stamp}.webp`, size: webp.length }, overrideAccess: true })
const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
const { sql } = await import('@payloadcms/db-postgres')
await db.drizzle.execute(sql`INSERT INTO device_sessions (sid, user_id, label, expires_at, created_at, updated_at) VALUES (${`qa-${stamp}`}, ${id}, 'Chrome on Mac', now() + interval '30 days', now(), now())`)
await db.drizzle.execute(sql`INSERT INTO offline_submissions (key, user_id, kind, input_hash, created_at, updated_at) VALUES (${`${id}:qa-${stamp}`}, ${id}, 'lead', 'x', now(), now())`)
const leftovers = async () => Number((await db.drizzle.execute(sql`SELECT (SELECT count(*) FROM device_sessions WHERE user_id = ${id}) + (SELECT count(*) FROM offline_submissions WHERE user_id = ${id}) AS n`)).rows[0].n)
assert.equal(await leftovers(), 2)
const versions = async () => (await payload.findVersions({ collection: 'daily-reports', where: { 'version.user': { equals: id } }, overrideAccess: true })).totalDocs
assert.ok((await versions()) >= 1, 'the report has saved history to clear')

await payload.delete({ collection: 'users', id, overrideAccess: true })

assert.equal((await payload.find({ collection: 'users', where: { id: { equals: id } }, overrideAccess: true })).totalDocs, 0)
assert.equal((await payload.find({ collection: 'daily-reports', where: { user: { equals: id } }, overrideAccess: true })).totalDocs, 0)
assert.equal(await versions(), 0)
assert.equal((await payload.find({ collection: 'profile-photos', where: { owner: { equals: id } }, overrideAccess: true })).totalDocs, 0)
assert.equal(await leftovers(), 0)
console.log('PASS an ended test account with a report, its history, a photo and device records deletes cleanly')
process.exit(0)
