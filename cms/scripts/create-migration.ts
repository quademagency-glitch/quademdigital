import 'dotenv/config'
import payload from 'payload'
import config from '../src/payload.config'

/**
 * Equivalent to `payload migrate:create`, run via a top-level tsx process
 * instead of payload's bin.js. Payload's CLI loads TS config through a nested
 * `tsx/esm/api` import, and drizzle-kit's `require('drizzle-kit/api')` inside
 * that nested loader context fails to resolve `node:crypto` on Node 24.
 * Running this file directly with `tsx` avoids the nested loader and sidesteps it.
 *
 * Never connects to the database: only diffs the in-code schema against the
 * latest local migration snapshot.
 */
process.env.PAYLOAD_MIGRATING = 'true'

await payload.init({
  config,
  disableDBConnect: true,
  disableOnInit: true,
})

const migrationName = process.argv[2]
if (!migrationName) {
  console.error('Usage: pnpm migrate:create <migration_name>')
  process.exit(1)
}

const adapter = payload.db as unknown as {
  createMigration: (args: { payload: typeof payload; migrationName: string }) => Promise<void>
}
await adapter.createMigration({ payload, migrationName })
process.exit(0)
