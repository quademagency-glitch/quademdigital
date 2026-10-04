'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

import { T } from './pitchTheme'

/**
 * "Send it again" on a request that was withdrawn, declined or expired.
 *
 * Makes a new draft with the same PDF, people, message, settings and places
 * (copyRequest in lib/signing/flow.ts) and opens it, so Ernest can put right
 * whatever made him withdraw it and press Send. The old request stays as it
 * is, as the record of what happened.
 *
 * Its own field rather than part of SigningPanel, which another tool was
 * redesigning in the shared folder when this was added.
 */

type Doc = Record<string, any>
const ENDED: Record<string, string> = { cancelled: 'was withdrawn', declined: 'was declined', expired: 'expired before everyone signed' }

export const SigningResend = () => {
  const { id, savedDocumentData } = useDocumentInfo() as { id?: number | string; savedDocumentData?: Doc }
  const status = String(savedDocumentData?.status || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!id || !ENDED[status]) return null

  const again = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/signature-requests/${id}/copy`, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) { setError(data.error || `That did not work (HTTP ${res.status}).`); return }
      window.location.href = `/admin/collections/signature-requests/${data.id}`
    } finally { setBusy(false) }
  }

  return (
    <div style={{ border: `1px solid ${T.border}`, background: T.raised, borderRadius: 6, padding: 16, margin: '8px 0 24px', color: T.text }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Send it again</p>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
        This {ENDED[status]}. Sending it again makes a new copy with the same document, people, message and places, including everything you moved or typed, and opens it so you can make any change before you press Send. This one stays here as the record.
      </p>
      <button
        type="button" onClick={again} disabled={busy}
        style={{ appearance: 'none', cursor: busy ? 'default' : 'pointer', borderRadius: 999, padding: '8px 16px', fontSize: 14, fontWeight: 600, border: `1px solid ${T.accent}`, background: T.accent, color: T.raised, opacity: busy ? 0.6 : 1 }}
      >{busy ? 'Making the copy…' : 'Make a copy to send again'}</button>
      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: T.bad }}>{error}</p>}
    </div>
  )
}
