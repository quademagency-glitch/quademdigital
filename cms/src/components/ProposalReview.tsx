'use client'

import { useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'

import { T, panel, heading } from './pitchTheme'

/*
  The panel at the top of a proposal, and the one button the screen is for.

  It answers three questions in the order they come up: has the PDF been read
  yet, does what it read look right, and what exists now that it has been used.

  IT REFUSES TO RUN ON UNSAVED EDITS

  Provisioning reads the proposal out of the database, not out of this form, so
  correcting a price and pressing the button without saving would create the
  client from the old number and say it worked. The button is held until the
  form is saved, which is the only honest way round that.
*/

const money = (value: unknown, currency: unknown) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${String(currency || '').toUpperCase() || ''} ${n.toLocaleString('en-US')}`.trim()
}

const idOf = (value: any) => (value && typeof value === 'object' ? value.id : value)

export const ProposalReview = () => {
  const { id } = useDocumentInfo() as any
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; log?: string[]; error?: string } | null>(null)

  const f = useFormFields(([fields]) => ({
    status: (fields?.status?.value as string) || 'parsing',
    parseError: (fields?.parseError?.value as string) || '',
    clientName: (fields?.clientName?.value as string) || '',
    clientEmail: (fields?.clientEmail?.value as string) || '',
    service: (fields?.service?.value as string) || '',
    total: fields?.total?.value,
    currency: fields?.currency?.value,
    depositPercent: fields?.depositPercent?.value,
    client: idOf(fields?.client?.value),
    invoice: idOf(fields?.invoice?.value),
    provisionLog: (fields?.provisionLog?.value as string) || '',
  }))

  const button: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    lineHeight: 1.2,
  }

  if (!id) {
    return (
      <div style={panel}>
        <strong style={heading}>Drop the proposal in and save</strong>
        <p style={{ margin: 0, color: T.muted }}>
          Choose the PDF below and press Save. It is read straight away, and what it found appears here for you to
          check. Nothing is created and nobody is emailed until you press the button on this panel.
        </p>
      </div>
    )
  }

  if (f.status === 'parsing') {
    return (
      <div style={panel}>
        <strong style={heading}>Reading the PDF</strong>
        <p style={{ margin: '0 0 10px', color: T.muted }}>
          This takes a few seconds. Reload the page to see what it found.
        </p>
        <button type="button" onClick={() => window.location.reload()} style={{ ...button, background: T.accent, color: '#050814' }}>
          Reload
        </button>
      </div>
    )
  }

  if (f.status === 'provisioned') {
    return (
      <div style={{ ...panel, borderColor: T.accentBorder, background: T.accentSubtle }}>
        <strong style={heading}>Client created</strong>
        <p style={{ margin: '0 0 10px', color: T.muted, whiteSpace: 'pre-line' }}>
          {f.provisionLog || 'This proposal has been used.'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.client ? (
            <a
              href={`/admin/collections/clients/${f.client}`}
              style={{ ...button, background: T.accent, color: '#050814', textDecoration: 'none' }}
            >
              Open the client
            </a>
          ) : null}
          {f.invoice ? (
            <a
              href={`/admin/collections/invoices/${f.invoice}`}
              style={{
                ...button,
                background: T.overlay,
                border: `1px solid ${T.border}`,
                color: T.text,
                textDecoration: 'none',
              }}
            >
              Open the invoice
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  /* needs-review, or failed and filled in by hand. */
  const missing: string[] = []
  if (!f.clientName.trim()) missing.push('the client name')
  if (!f.clientEmail.trim()) missing.push('an email address')

  const total = money(f.total, f.currency)
  const ready = missing.length === 0 && !modified && !busy

  const provision = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`/api/proposals/${id}/provision`, {
        method: 'post',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json()
      setResult(body)
      if (body?.ok) setTimeout(() => window.location.reload(), 1200)
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || 'The request did not go through.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={panel}>
      <strong style={heading}>Check this, then create everything</strong>

      <p style={{ margin: '0 0 10px', color: T.muted }}>
        {f.clientName || 'An unnamed client'}
        {f.service ? `, ${f.service.replace(/-/g, ' ')}` : ''}
        {total ? `, ${total}` : ''}
        {Number(f.depositPercent) > 0 ? `, ${f.depositPercent}% deposit` : ''}.
      </p>

      <p style={{ margin: '0 0 12px', color: T.faint, fontSize: 12 }}>
        Pressing the button creates the client as won, which sends the welcome email and schedules the contract, the
        setup instructions and the week-one check-in. It also drafts an invoice, which is not sent, and copies the
        journey template onto the client as dated steps.
      </p>

      {f.parseError ? (
        <p style={{ margin: '0 0 12px', color: T.bad, fontSize: 12 }}>{f.parseError}</p>
      ) : null}

      {missing.length ? (
        <p style={{ margin: '0 0 12px', color: T.bad, fontSize: 12 }}>
          Fill in {missing.join(' and ')} first, then save.
        </p>
      ) : null}

      {modified && !missing.length ? (
        <p style={{ margin: '0 0 12px', color: T.bad, fontSize: 12 }}>
          Save your changes first. This reads the proposal from the database, so anything unsaved would be ignored.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!ready}
        onClick={provision}
        style={
          ready
            ? { ...button, background: T.accent, color: '#050814' }
            : { ...button, background: T.overlay, border: `1px solid ${T.border}`, color: T.faint, cursor: 'not-allowed' }
        }
      >
        {busy ? 'Creating...' : 'Create everything'}
      </button>

      {result ? (
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 12,
            color: result.ok ? T.good : T.bad,
            whiteSpace: 'pre-line',
          }}
        >
          {result.ok ? (result.log || []).join('\n') : result.error}
        </p>
      ) : null}
    </div>
  )
}
