export const ONBOARDING_LABELS = [
  ['fileContract', 'Service agreement file'],
  ['fileWelcome', 'Welcome pack file'],
  ['fileSetup', 'Setup instructions file'],
  ['welcome', 'Welcome email'],
  ['contract', 'Agreement email'],
  ['setup', 'Setup email'],
  ['checkin', 'Week-one check-in'],
  ['notify', 'Owner notification'],
] as const
export type DeliveryStep = {
  status?: string
  error?: string
  result?: {
    documentId?: string | number
    scheduledAt?: string
    acceptedAt?: string
    providerId?: string
  }
}
export type DeliveryState = {
  status?: string
  updatedAt?: string
  steps?: Record<string, DeliveryStep>
}
export function onboardingStepLabel(key: string, step?: DeliveryStep) {
  if (step?.status === 'complete')
    return key.startsWith('file') ? 'Saved' : step.result?.scheduledAt ? 'Scheduled' : 'Accepted'
  if (step?.status === 'failed') return 'Failed'
  if (step?.status === 'running') return 'In progress'
  return 'Not started'
}
export function onboardingStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    'needs-review': 'Review needed',
    pending: 'Queued',
    running: 'In progress',
    failed: 'Needs attention',
    reconcile: 'Reconcile delivery',
    complete: 'Complete',
  }
  return labels[status || ''] || 'Not started'
}
