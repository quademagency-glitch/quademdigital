'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'
import { Mail, RefreshCw, Send } from 'lucide-react'

const audiences: Record<string, string> = {
  all: 'Everyone subscribed',
  seo: 'SEO and paid ads',
  'web-design': 'Web design',
  'brand-identity': 'Brand identity',
  video: 'AI video and reels',
  test: 'Test to Ernest only',
}

/** Review saved content separately from the native Save action. */
export const SendCampaignButton = () => {
  const { id, savedDocumentData } = useDocumentInfo()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const [counting, setCounting] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const segment: string = savedDocumentData?.segment || 'all'
  const sentAt = savedDocumentData?.sentAt
  const isTest = segment === 'test'
  const blocked = busy || modified || attempted || (!isTest && Boolean(sentAt))

  if (!id) {
    return (
      <section className="qd-panel qd-workflow">
        <h3>
          <Mail size={17} aria-hidden="true" /> Send review
        </h3>
        <p>Save your message first. The saved subject and audience will appear here for review.</p>
        <span className="qd-badge">Draft not saved</span>
      </section>
    )
  }

  const send = async () => {
    if (blocked) return
    const question = isTest
      ? `Send a test of “${savedDocumentData?.subject || 'this campaign'}” to Ernest?`
      : `Send “${savedDocumentData?.subject || 'this campaign'}” to ${audiences[segment] || segment}? This sends the saved message and cannot be recalled.`
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
        setResult({
          tone: 'bad',
          text:
            body?.error ||
            `The send could not be confirmed (HTTP ${res.status}). Review delivery results before trying again.`,
        })
      } else {
        if (!isTest) setAttempted(true)
        const partial =
          Boolean(body.problems?.length) ||
          (Number.isFinite(body.sent) && Number.isFinite(body.of) && body.sent < body.of)
        setResult({
          tone: partial ? 'bad' : 'ok',
          text: body.test
            ? 'Test accepted for delivery. Check the test inbox before choosing a live audience.'
            : `Accepted ${body.sent ?? 0} of ${body.of ?? 0} for delivery.${partial ? ' Review the delivery log for failures before any retry.' : ' Delivery events will update as they arrive.'}`,
        })
      }
    } catch {
      setAttempted(true)
      setResult({
        tone: 'bad',
        text: 'The connection was lost. Sending may already have started. Reload and review delivery results before retrying.',
      })
    } finally {
      setBusy(false)
    }
  }

  const recount = async () => {
    setCounting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/emailCampaigns/${id}/recount`, {
        method: 'POST',
        credentials: 'include',
      })
      setResult(
        res.ok
          ? {
              tone: 'ok',
              text: 'Delivery events recounted. Reload the record to see the updated totals.',
            }
          : { tone: 'bad', text: `Could not recount delivery events (HTTP ${res.status}).` },
      )
    } catch {
      setResult({ tone: 'bad', text: 'Could not reach the server to recount delivery events.' })
    } finally {
      setCounting(false)
    }
  }

  return (
    <section className="qd-panel qd-workflow" aria-label="Campaign send review">
      <h3>
        <Mail size={17} aria-hidden="true" /> Send review
      </h3>
      <span className={`qd-badge qd-badge--${sentAt ? 'info' : isTest ? 'info' : 'warning'}`}>
        {sentAt && !isTest ? 'Previously sent' : isTest ? 'Test audience' : 'Live audience'}
      </span>
      <dl>
        <dt>Saved subject</dt>
        <dd>{savedDocumentData?.subject || 'Untitled campaign'}</dd>
        <dt>Saved audience</dt>
        <dd>{audiences[segment] || segment}</dd>
      </dl>
      <button
        type="button"
        className="qd-button qd-button--primary"
        onClick={send}
        disabled={blocked}
      >
        <Send size={15} aria-hidden="true" />
        {busy ? 'Sending…' : isTest ? 'Send a test' : 'Send campaign'}
      </button>
      <p>
        {modified
          ? 'Save your changes to update the subject and audience in this review.'
          : sentAt && !isTest
            ? 'This campaign has already been sent. Duplicate it to prepare another message.'
            : 'Only eligible subscribers in the saved audience receive a live campaign.'}
      </p>
      {sentAt && !isTest && (
        <button type="button" className="qd-button" onClick={recount} disabled={counting}>
          <RefreshCw size={15} aria-hidden="true" />{' '}
          {counting ? 'Recounting…' : 'Recount delivery events'}
        </button>
      )}
      {result && (
        <div
          role={result.tone === 'bad' ? 'alert' : 'status'}
          className={`qd-notice qd-notice--${result.tone === 'bad' ? 'danger' : 'success'}`}
        >
          {result.text}
        </div>
      )}
    </section>
  )
}
