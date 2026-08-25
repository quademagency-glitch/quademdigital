'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

/**
 * The send button.
 *
 * Sending used to happen on a separate page at /admin/campaigns on the site,
 * behind a password that was written into that page's own JavaScript, so anyone
 * who viewed source could mail the whole list. It also never read this
 * collection and never wrote back to it.
 *
 * Two deliberate frictions here, because an email cannot be recalled:
 *
 *  - Save first. The button sends what is stored, not what is on screen, and
 *    the difference between those two is how a half-edited subject goes out.
 *  - Confirm, with the number of people and the segment in the sentence, so the
 *    thing being agreed to is the thing that happens.
 */
export const SendCampaignButton = () => {
  const { id, savedDocumentData } = useDocumentInfo() as any
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const segment: string = savedDocumentData?.segment || 'all'
  const sentAt: string | undefined = savedDocumentData?.sentAt
  const isTest = segment === 'test'

  if (!id) {
    return (
      <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
        Save the campaign and the send button appears here.
      </p>
    )
  }

  const send = async () => {
    const question = isTest
      ? 'Send a test of this campaign to yourself?'
      : `Send this campaign for real, to everyone subscribed in "${segment}"? It cannot be recalled.`
    if (!confirm(question)) return

    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`/api/emailCampaigns/${id}/send`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ tone: 'bad', text: body?.error || `Failed with HTTP ${res.status}` })
      } else {
        setResult({
          tone: 'ok',
          text: body.test
            ? `Test sent to you. Check your inbox, then change the segment and send for real.`
            : `Sent to ${body.sent} of ${body.of}.${body.problems?.length ? ' Some batches failed, see What happened.' : ''}`,
        })
      }
    } catch {
      setResult({ tone: 'bad', text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={send}
        disabled={busy || (!isTest && Boolean(sentAt))}
        style={{
          padding: '9px 14px',
          borderRadius: 4,
          border: 'none',
          cursor: busy || (!isTest && sentAt) ? 'not-allowed' : 'pointer',
          background: isTest ? '#334155' : '#00AEEF',
          color: isTest ? '#ffffff' : '#050814',
          fontWeight: 600,
          fontSize: 14,
          opacity: busy || (!isTest && sentAt) ? 0.5 : 1,
        }}
      >
        {busy ? 'Sending...' : isTest ? 'Send a test to me' : 'Send this campaign'}
      </button>

      <p style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.75, margin: 0 }}>
        {sentAt && !isTest
          ? 'Already sent. A campaign only goes out once, so duplicate it to send again.'
          : 'Sends what is saved, not what is on screen. Save any edits first.'}
      </p>

      {result && (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0,
            color: result.tone === 'ok' ? '#16a34a' : '#dc2626',
          }}
        >
          {result.text}
        </p>
      )}
    </div>
  )
}
