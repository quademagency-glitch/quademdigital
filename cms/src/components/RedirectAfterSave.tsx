'use client'

import React, { useCallback } from 'react'
import { useForm, useFormProcessing } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

/**
 * Custom Save button that publishes and redirects to the admin dashboard after save.
 * Used for collections WITHOUT drafts (replaces the default Save button).
 */
export const SaveAndRedirectButton: React.FC<{ label?: string }> = ({ label }) => {
  const { submit } = useForm()
  const processing = useFormProcessing()
  const router = useRouter()

  const handleSave = useCallback(async () => {
    const result = await submit()
    if (result && result.formState) {
      // Check if the form state has no errors
      const hasErrors = Object.values(result.formState).some(
        (field: any) => field?.valid === false
      )
      if (!hasErrors) {
        setTimeout(() => {
          router.push('/admin')
        }, 500)
      }
    }
  }, [submit, router])

  return (
    <button
      className="btn btn--style-primary btn--size-medium btn--icon-style-without-border"
      disabled={processing}
      onClick={handleSave}
      type="button"
      id="action-save-and-redirect"
      style={{ gap: '0.5rem' }}
    >
      {processing ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="qd-spinner" />
          Saving…
        </span>
      ) : (
        label || 'Save & Publish'
      )}
    </button>
  )
}

/**
 * Custom Publish button for collections WITH drafts enabled.
 * Forces publish (the hook sets _status=published) and redirects to dashboard.
 */
export const PublishAndRedirectButton: React.FC<{ label?: string }> = ({ label }) => {
  const { submit } = useForm()
  const processing = useFormProcessing()
  const router = useRouter()

  const handlePublish = useCallback(async () => {
    // Submit with overrides to force _status=published
    const result = await submit({
      overrides: { _status: 'published' },
    })
    if (result && result.formState) {
      const hasErrors = Object.values(result.formState).some(
        (field: any) => field?.valid === false
      )
      if (!hasErrors) {
        setTimeout(() => {
          router.push('/admin')
        }, 500)
      }
    }
  }, [submit, router])

  return (
    <button
      className="btn btn--style-primary btn--size-medium btn--icon-style-without-border"
      disabled={processing}
      onClick={handlePublish}
      type="button"
      id="action-publish-and-redirect"
      style={{ gap: '0.5rem' }}
    >
      {processing ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="qd-spinner" />
          Publishing…
        </span>
      ) : (
        label || 'Save & Publish'
      )}
    </button>
  )
}
