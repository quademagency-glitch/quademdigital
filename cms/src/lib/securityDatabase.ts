import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

/** The production security operations require Postgres atomic statements. */
export const securityDB = (req: PayloadRequest) => (req.payload.db as unknown as PostgresAdapter).drizzle
export const sessionID = (req: PayloadRequest): string | undefined => (req.user as { _sid?: string } | null)?._sid

export async function securityTransaction(req: PayloadRequest) {
  const id = String(await req.transactionID)
  const transaction = (req.payload.db as unknown as PostgresAdapter).sessions?.[id]
  if (!transaction) throw new Error('An active database transaction is required.')
  return transaction.db as unknown as ReturnType<typeof securityDB>
}
