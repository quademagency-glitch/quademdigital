import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
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

/**
 * The npm script deletes `._*` AppleDouble files before this runs, but macOS
 * writes a fresh one beside the migration the line above just created, and
 * Payload builds index.ts from the directory listing, so the sidecar goes in
 * as if it were a migration: `import * as migration_._<name> from './._<name>'`.
 * The Docker build skips `._` files, so that import fails and the CMS never
 * deploys. Both e_signing runs on 2026-10-04 did it. Strip it here.
 */
const dir = path.resolve('src/migrations')
for (const file of fs.readdirSync(dir)) {
  if (file.startsWith('._')) fs.rmSync(path.join(dir, file), { force: true })
}
const indexPath = path.join(dir, 'index.ts')
const listed = fs.readFileSync(indexPath, 'utf8')
const cleaned = listed
  .replace(/^import \* as migration_\._\S+ from '\.\/\._[^']*';\n/gm, '')
  .replace(/\n  \{\n    up: migration_\._\S+,\n    down: migration_\._\S+,\n    name: '\._[^']*',?\n  \},?/g, '')
if (cleaned !== listed) {
  fs.writeFileSync(indexPath, cleaned)
  console.log('Removed a macOS ._ file that Payload had listed as a migration in index.ts.')
}
process.exit(0)
