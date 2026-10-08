import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { adminIds, notify } from './notify'

/*
  When something the CMS does on its own fails, Ernest hears (CMS review,
  8 October 2026): a bell notice and an email, once a day for each problem, so
  a failure that repeats every five minutes is one message, not hundreds.
  Before this most of them reached only the server log, which nobody reads.

  `area` names the problem and makes it once a day: 'agreement-end:12' is one
  person's, 'digests' is everyone's. It never throws.
*/
export async function reportProblem(on: PayloadRequest | Payload, area: string, what: string, err?: unknown) {
  try {
    const req = 'payload' in on && 'context' in on ? (on as PayloadRequest) : ((await createLocalReq({}, on as Payload)) as PayloadRequest)
    const detail = err instanceof Error ? err.message : err ? String(err) : ''
    req.payload.logger.error({ err, area }, what)
    await notify(req, {
      to: await adminIds(req).catch(() => []),
      kind: 'system-problem',
      title: what,
      body: [detail.slice(0, 400), 'You hear about this once a day while it keeps happening.'].filter(Boolean).join('\n\n'),
      link: '/notifications',
      key: `problem:${area}:${new Date().toISOString().slice(0, 10)}`,
      important: true,
    })
  } catch {
    // Telling Ernest must never break the work that failed.
  }
}
