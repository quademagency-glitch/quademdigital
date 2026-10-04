import type { TaskConfig } from 'payload'
import { runSigningJobs } from './flow'

/** Every five minutes: expire old requests, chase signers, finish stalled ones. */
export const signingTask: TaskConfig<any> = {
  slug: 'signingRounds',
  retries: 0,
  schedule: [{ cron: '*/5 * * * *', queue: 'default' }],
  outputSchema: [{ name: 'ok', type: 'checkbox' }],
  handler: async ({ req }) => {
    await runSigningJobs(req.payload)
    return { output: { ok: true } }
  },
}
