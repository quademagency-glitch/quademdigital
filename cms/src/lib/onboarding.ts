import { randomUUID } from 'node:crypto'
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook, TaskConfig } from 'payload'

export const ONBOARDING_STEPS = ['fileContract', 'fileWelcome', 'fileSetup', 'welcome', 'contract', 'setup', 'checkin', 'notify'] as const
const LABELS: Record<string, string> = { fileContract: 'Save agreement', fileWelcome: 'Save welcome pack', fileSetup: 'Save setup instructions', welcome: 'Welcome email', contract: 'Agreement email', setup: 'Setup email', checkin: 'Check-in email', notify: 'Owner notification' }
const DOCUMENTS: Record<string, string> = { welcome: 'fileWelcome', contract: 'fileContract', setup: 'fileSetup' }
const IDEMPOTENCY_WINDOW = 23 * 60 * 60 * 1000

export function missingOnboardingDetails(doc: any) {
  const missing = []
  if (!doc.clientName?.trim()) missing.push('business name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.clientEmail || '')) missing.push('valid client email')
  if (!doc.service) missing.push('agreed service')
  if (!(Number(doc.price) > 0)) missing.push('agreed price')
  if (!doc.startDate || !Number.isFinite(Date.parse(doc.startDate))) missing.push('start date')
  return missing
}

export const prepareOnboarding: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const doc = { ...originalDoc, ...data }
  const prior = originalDoc?.onboardingState || {}
  const retry = data.retryOnboarding === true
  data.retryOnboarding = false
  // Delivery state belongs to the worker, never to an ordinary form save.
  // Field fallback has already populated the request from its old document.
  // Remove it here so a normal edit cannot overwrite a worker checkpoint.
  delete data.onboardingState
  delete data.onboardingStatus
  if (doc.pipelineStatus !== 'won' || prior.status === 'complete') return data
  const justWon = originalDoc?.pipelineStatus !== 'won'
  if (!justWon && !retry && prior.status !== 'needs-review') return data
  if (['pending', 'running'].includes(prior.status) && Date.now() - Date.parse(prior.updatedAt || '') < 15 * 60 * 1000) return data
  const missing = missingOnboardingDetails(doc)
  if (missing.length) {
    data.onboardingState = { ...prior, status: 'needs-review', updatedAt: new Date().toISOString() }
    data.onboardingStatus = `Review needed: ${missing.join(', ')}. Save these details to queue onboarding.`
    return data
  }
  data.onboardingState = { ...prior, runId: prior.runId || randomUUID(), requestId: randomUUID(), status: 'pending', steps: prior.steps || {}, updatedAt: new Date().toISOString() }
  data.onboardingStatus = 'Queued. Delivery will start within five minutes.'
  return data
}

export const queueOnboarding: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const state = doc.onboardingState
  if (state?.status !== 'pending' || !state.requestId || state.requestId === previousDoc?.onboardingState?.requestId) return doc
  // Queue inside the client transaction. The worker reads the committed client,
  // so document uploads never race the client record that they reference.
  await req.payload.jobs.queue({ task: 'clientOnboarding', input: { clientId: String(doc.id), requestId: state.requestId }, queue: 'onboarding', req })
  return doc
}

export function onboardingClient(doc: any) {
  return {
    id: String(doc.id), businessName: doc.clientName, contactName: doc.contactName || doc.clientName,
    email: doc.clientEmail, phone: doc.phone || '', accessCode: doc.accessCode,
    portalUrl: 'https://quademdigital.com/portal/', service: doc.service,
    package: doc.package || '', price: doc.price, startDate: doc.startDate,
    notes: doc.notes || '', customizations: doc.customizations || {}, emailNotes: doc.emailNotes || {},
  }
}

export async function runClientOnboarding({ input, req }: any) {
  const payload = req.payload
  const doc = await payload.findByID({ collection: 'clients', id: input.clientId, depth: 0 })
  const state = structuredClone(doc.onboardingState || {})
  if (state.requestId !== input.requestId || state.status === 'complete') return { output: { ok: true } }
  const save = async (status: string, message: string) => {
    state.status = status
    state.updatedAt = new Date().toISOString()
    // Background checkpoints must not reapply defaults or recurse into hooks.
    await payload.db.updateOne({ collection: 'clients', id: doc.id, data: { onboardingState: state, onboardingStatus: message }, returning: false })
  }
  const site = process.env.ASTRO_SITE_URL?.replace(/\/$/, '')
  const secret = process.env.CMS_WEBHOOK_SECRET
  if (!site || !secret) {
    await save('failed', 'Onboarding could not start: website connection is not configured. Correct it and select Retry incomplete onboarding.')
    return { output: { ok: false } }
  }
  state.client ||= onboardingClient(doc)
  state.steps ||= {}
  await save('running', 'Preparing onboarding documents and emails.')
  for (const step of ONBOARDING_STEPS) {
    let entry = state.steps[step]
    if (entry?.status === 'complete') continue
    // An uncertain old send cannot safely be repeated after provider keys expire.
    // Leave it visible for reconciliation rather than risk a duplicate email.
    if (!step.startsWith('file') && entry?.attemptedAt && Date.now() - Date.parse(entry.attemptedAt) >= IDEMPOTENCY_WINDOW) {
      await save('reconcile', `${LABELS[step]} needs delivery reconciliation before retry. Check Resend using the request key in Delivery details.`)
      return { output: { ok: false } }
    }
    entry ||= { key: `onboarding/${doc.id}/${state.runId}/${step}`, attemptedAt: new Date().toISOString() }
    entry.status = 'running'
    state.steps[step] = entry
    await save('running', `${LABELS[step]} in progress.`)
    try {
      const response = await fetch(`${site}/api/client-won/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-quadem-secret': secret },
        body: JSON.stringify({ event: 'client.onboarding.step', client: state.client, step, key: entry.key,
          attemptedAt: entry.attemptedAt, document: state.steps[DOCUMENTS[step]]?.result }),
        signal: AbortSignal.timeout(90000),
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true) throw new Error(result.error || `Website returned ${response.status}`)
      if (step.startsWith('file') ? !result.documentId : !result.providerId || !Number.isFinite(Date.parse(result.acceptedAt))) {
        throw new Error('Website did not confirm the saved document or accepted email. Check both deployments before retrying.')
      }
      entry.status = 'complete'
      entry.result = result
      delete entry.error
      await save('running', `${LABELS[step]} accepted.`)
    } catch (error) {
      entry.status = 'failed'
      entry.error = error instanceof Error ? error.message.slice(0, 400) : 'Request failed'
      await save('failed', `${LABELS[step]} failed: ${entry.error}. Select Retry incomplete onboarding after resolving the problem.`)
      return { output: { ok: false } }
    }
  }
  // Mark document dates only after the corresponding send was accepted. This
  // checkpoint is retryable without sending any of the completed emails again.
  try {
    for (const [email, document] of Object.entries(DOCUMENTS)) {
      await payload.db.updateOne({ collection: 'onboarding-documents', id: state.steps[document].result.documentId,
        data: { sentToClientAt: state.steps[email].result.scheduledAt || state.steps[email].result.acceptedAt }, returning: false })
    }
    await save('complete', 'All documents saved. All five emails accepted by Resend; scheduled emails will follow their recorded times. Inbox delivery is tracked separately.')
    return { output: { ok: true } }
  } catch {
    await save('failed', 'Emails were accepted, but document delivery dates could not be saved. Retry will finish filing without resending emails.')
    return { output: { ok: false } }
  }
}

export const clientOnboardingTask: TaskConfig<any> = {
  slug: 'clientOnboarding', retries: 0,
  concurrency: ({ input }: any) => `client-onboarding-${input.clientId}`,
  inputSchema: [{ name: 'clientId', type: 'text', required: true }, { name: 'requestId', type: 'text', required: true }],
  outputSchema: [{ name: 'ok', type: 'checkbox', required: true }],
  handler: runClientOnboarding,
}
