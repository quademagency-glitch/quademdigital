'use client'

import React, { useEffect, useState } from 'react'
import type { JSONFieldClientComponent } from 'payload'
import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { AlertCircle, CheckCircle2, Circle, LoaderCircle } from 'lucide-react'
import { redactSecrets } from '../lib/passwordReveal'
import {
  ONBOARDING_LABELS,
  onboardingStepLabel,
  onboardingStatusLabel,
  type DeliveryState,
} from '../lib/onboardingPresentation'

export const ClientContext = () => {
  const pipeline = useFormFields(([fields]) => fields.pipelineStatus?.value) as string | undefined
  const project = useFormFields(([fields]) => fields.projectStatus?.value) as string | undefined
  const label = (v?: string) =>
    v ? v.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Not set'
  return (
    <div className="qd-client-context">
      <span className={`qd-badge ${pipeline === 'won' ? 'qd-badge--success' : 'qd-badge--info'}`}>
        Sales: {label(pipeline)}
      </span>
      <span className="qd-badge qd-badge--info">Project: {label(project)}</span>
      <p>
        Portal access, timeline and assets are in Client Portal. Contract terms and email notes are
        in Customizations.
      </p>
    </div>
  )
}

export const AgreementContext = () => {
  const duration = useFormFields(([fields]) => fields['customizations.duration']?.value) as
    | number
    | null
    | undefined
  const currency = useFormFields(([fields]) => fields.currency?.value) as string | undefined
  return (
    <div className="qd-agreement-context">
      {duration === 0
        ? 'One-off project · Contract duration: 0 months.'
        : `Contract duration: ${duration ?? 3} months${duration == null ? ' (default)' : ''}.`}{' '}
      {currency ? `Agreed currency: ${currency}. ` : ''}Review the payment schedule and document
      terms under Customizations.
    </div>
  )
}

export const OnboardingDelivery: JSONFieldClientComponent = ({ field, path }) => {
  const { value } = useField<DeliveryState | null>({ path: path || field.name })
  const { id, savedDocumentData } = useDocumentInfo()
  const [live, setLive] = useState<{ state: DeliveryState; message: string } | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const state = live?.state || value || {}
  const message = live?.message || savedDocumentData?.onboardingStatus || ''
  useEffect(() => {
    setLive(null)
    setError('')
  }, [id, value])
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(id)}?depth=0`, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!res.ok)
          throw new Error('Could not refresh onboarding. The last saved results are shown.')
        const doc = await res.json()
        if (controller.signal.aborted) return
        setLive({ state: doc.onboardingState || {}, message: doc.onboardingStatus || '' })
        setError('')
        if (['pending', 'running'].includes(doc.onboardingState?.status))
          timer = setTimeout(load, 15000)
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Could not refresh onboarding.')
      }
    }
    // Refreshing is read-only and never submits the form or queues a retry.
    void load()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [id, value, refresh])
  const attention = ['failed', 'reconcile', 'needs-review'].includes(state.status || '')
  return (
    <section className="qd-panel qd-onboarding" aria-label="Onboarding delivery">
      <div className="qd-onboarding__heading">
        <h3>Onboarding delivery</h3>
        <span
          className={`qd-badge ${attention ? 'qd-badge--danger' : state.status === 'complete' ? 'qd-badge--success' : 'qd-badge--info'}`}
        >
          {onboardingStatusLabel(state.status)}
        </span>
      </div>
      <p role="status" aria-live="polite">
        {message ||
          'Onboarding starts after a Won client is saved with the required agreement details.'}
      </p>
      <ol className="qd-onboarding-steps">
        {ONBOARDING_LABELS.map(([key, label]) => {
          const step = state.steps?.[key]
          const Icon =
            step?.status === 'complete'
              ? CheckCircle2
              : step?.status === 'failed'
                ? AlertCircle
                : step?.status === 'running'
                  ? LoaderCircle
                  : Circle
          return (
            <li key={key} data-status={step?.status || 'pending'}>
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              <span>{onboardingStepLabel(key, step)}</span>
              {step?.error && <small>{step.error}</small>}
              {step?.result?.scheduledAt && (
                <small>
                  Scheduled for{' '}
                  {new Date(step.result.scheduledAt).toLocaleString('en-GB', {
                    timeZone: 'Africa/Accra',
                  })}{' '}
                  GMT
                </small>
              )}
            </li>
          )
        })}
      </ol>
      <p>
        Accepted confirms the email provider received the message. Inbox delivery is tracked
        separately.
      </p>
      {state.status === 'reconcile' && (
        <p className="qd-notice qd-notice--danger">
          Check the saved delivery references before retrying an uncertain send.
        </p>
      )}
      {error && (
        <p role="alert" className="qd-notice qd-notice--danger">
          {error}
        </p>
      )}
      {id && (
        <button
          type="button"
          className="qd-button qd-button--quiet"
          onClick={() => setRefresh((n) => n + 1)}
        >
          Refresh delivery status
        </button>
      )}
      <details>
        <summary>View delivery details</summary>
        <div className="qd-secret-json__box">
          <pre>{JSON.stringify(redactSecrets(state), null, 2)}</pre>
        </div>
      </details>
    </section>
  )
}
