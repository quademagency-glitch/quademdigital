'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, CheckCircle2, Circle, FileSignature, Send } from 'lucide-react'
import { ownerOf } from '../lib/signing/places'

type Doc = Record<string, any>
const API = '/api/signature-requests'
const KIND: Record<string, string> = {
  signature: 'Signature',
  initials: 'Initials',
  name: 'Name',
  date: 'Date',
  title: 'Job title',
  text: 'Text to fill in',
}
const STATUS: Record<string, string> = {
  waiting: 'Waiting their turn',
  sent: 'Link issued · not opened',
  opened: 'Opened · not signed',
  signed: 'Signed',
  declined: 'Declined',
  cancelled: 'Withdrawn',
}
const when = (v?: string | null) =>
  v && Number.isFinite(Date.parse(v))
    ? new Date(v).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Accra',
      })
    : ''
const copyText = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* use fallback */
  }
  const el = document.createElement('textarea')
  try {
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    el.remove()
  }
}

export const SigningPanel = () => {
  const { id, savedDocumentData } = useDocumentInfo() as {
    id?: number | string
    savedDocumentData?: Doc
  }
  const modified = useFormModified()
  const doc = savedDocumentData || {}
  const [live, setLive] = useState<Doc | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [copied, setCopied] = useState('')
  const status: string = live?.status || doc.status || 'draft'

  useEffect(() => {
    setLive(null)
    setLoadError('')
    setNote(null)
    setConfirmWithdraw(false)
  }, [id, savedDocumentData])
  const loadStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return
      try {
        const res = await fetch(`${API}/${id}/status`, { credentials: 'include', signal })
        if (!res.ok) throw new Error('Could not load signing status. Try refreshing it.')
        const data = await res.json()
        if (!signal?.aborted) {
          setLive(data)
          setLoadError('')
        }
      } catch (error) {
        if (!signal?.aborted)
          setLoadError(error instanceof Error ? error.message : 'Could not load signing status.')
      }
    },
    [id],
  )
  useEffect(() => {
    if (status === 'draft' || !id) return
    const controller = new AbortController()
    void loadStatus(controller.signal)
    const timer = ['out', 'completing'].includes(status)
      ? setInterval(() => {
          void loadStatus(controller.signal)
        }, 15000)
      : undefined
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [id, status, loadStatus])

  const call = async (path: string, init: RequestInit, done: string) => {
    setBusy(path)
    setNote(null)
    try {
      const res = await fetch(`${API}/${id}/${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNote({
          tone: 'danger',
          text:
            data.error ||
            `The request could not be confirmed (HTTP ${res.status}). Refresh status before trying again.`,
        })
        return null
      }
      setNote({ tone: 'success', text: done })
      return data
    } catch {
      setNote({
        tone: 'danger',
        text: 'The connection was interrupted. Refresh signing status before trying again; the action may already have completed.',
      })
      return null
    } finally {
      setBusy('')
    }
  }
  const feedback = (
    <>
      {note && (
        <p
          className={`qd-notice qd-notice--${note.tone}`}
          role={note.tone === 'danger' ? 'alert' : 'status'}
        >
          {note.text}
        </p>
      )}
      {loadError && (
        <p role="alert" className="qd-notice qd-notice--danger">
          {loadError}
        </p>
      )}
    </>
  )

  if (!id)
    return (
      <section className="qd-panel qd-signing">
        <div className="qd-panel__header">
          <h2>
            <FileSignature size={18} aria-hidden="true" />
            Prepare your document
          </h2>
        </div>
        <div className="qd-panel__body">
          <p>
            Upload the PDF, add everyone who signs it, then save. Review the detected signature
            places before sending the links.
          </p>
          <p className="qd-notice">Saving alone does not send anything.</p>
        </div>
      </section>
    )

  const signers = (doc.signers || []) as Doc[]
  const parties = (doc.parties || []) as Doc[]
  const places = (doc.places || []) as Doc[]
  if (status === 'draft') {
    const placesOf = (partyId: string) => places.filter((p) => p.party === partyId)
    const withSignature = new Set(
      places.filter((place) => place.kind === 'signature').map((place) => ownerOf(place, parties)),
    )
    const appended = signers.filter((s) => !withSignature.has(String(s.id)))
    const validSigners =
      signers.length > 0 &&
      signers.every((s) => s.name?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email || '')) &&
      new Set(signers.map((s) => s.email?.trim().toLowerCase())).size === signers.length
    const canSend = validSigners && Boolean(doc.filename) && !modified && !busy
    const checks = [
      { label: 'PDF uploaded', ok: Boolean(doc.filename) },
      {
        label: `${signers.length} ${signers.length === 1 ? 'person' : 'people'} with unique email addresses`,
        ok: validSigners,
      },
      {
        label: places.some((place) => place.kind === 'signature')
          ? `${signers.length - appended.length} of ${signers.length} people have signature places`
          : 'A signing page will be added at the end',
        ok: Boolean(doc.filename) && (!places.length || appended.length === 0),
      },
      { label: modified ? 'Save your latest changes' : 'Latest changes saved', ok: !modified },
    ]
    return (
      <div className="qd-signing">
        <div className="qd-signing-grid">
          <section className="qd-panel">
            <div className="qd-panel__header">
              <h2>Signature places</h2>
              <span className="qd-badge">Draft</span>
            </div>
            <div className="qd-panel__body">
              {doc.filename && (
                <p>
                  <strong>{doc.filename}</strong>
                  {Array.isArray(doc.pages) ? ` · ${doc.pages.length} pages` : ''}
                  {doc.url && (
                    <>
                      {' '}
                      ·{' '}
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        View PDF <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </>
                  )}
                </p>
              )}
              <p>
                {!doc.filename
                  ? 'Upload the PDF and save to find the signature places.'
                  : !places.some((place) => place.kind === 'signature')
                    ? 'No signature places are assigned on the document. Each person will sign on a page added at the end.'
                    : 'Review the places on the document below. A place matched to nobody stays blank.'}
              </p>
              <div className="qd-signing-places">
                {parties.map((party) => {
                  const found = placesOf(party.partyId)
                  const pages = [...new Set(found.map((p) => p.page))]
                  const kinds = [...new Set(found.map((p) => KIND[p.kind] || p.kind))]
                  return (
                    <div key={party.partyId} className="qd-signing-place">
                      <strong>{party.context || 'Signature block'}</strong>
                      <small>
                        {party.witness ? 'Witness · ' : ''}
                        {kinds.join(', ')} · {pages.length === 1 ? 'Page' : 'Pages'}{' '}
                        {pages.join(', ')}
                      </small>
                      <select
                        aria-label={`Who signs: ${party.context || 'Signature block'}`}
                        disabled={modified || Boolean(busy)}
                        value={party.signerId || ''}
                        onChange={async (e) => {
                          const ok = await call(
                            'assign',
                            {
                              method: 'POST',
                              body: JSON.stringify({
                                party: party.partyId,
                                signerId: e.target.value || null,
                              }),
                            },
                            'Signature place saved.',
                          )
                          if (ok) window.location.reload()
                        }}
                      >
                        <option value="">Nobody, leave blank</option>
                        {signers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name || s.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
              {appended.length > 0 && places.length > 0 && (
                <p className="qd-notice">
                  {appended.map((s) => s.name || s.email).join(', ')} will sign on the page added at
                  the end.
                </p>
              )}
              {modified && (
                <p role="status" className="qd-notice qd-notice--danger">
                  Save changes to the PDF, signers or settings before matching places or sending.
                </p>
              )}
            </div>
          </section>
          <section className="qd-panel">
            <div className="qd-panel__header">
              <h2>{canSend ? 'Ready to send' : 'Before you send'}</h2>
            </div>
            <div className="qd-panel__body">
              <ul className="qd-checklist">
                {checks.map((check) => {
                  const Icon = check.ok ? CheckCircle2 : Circle
                  return (
                    <li key={check.label} data-ok={check.ok}>
                      <Icon size={17} aria-hidden="true" />
                      <span>{check.label}</span>
                    </li>
                  )
                })}
              </ul>
              <dl className="qd-signing-summary">
                <div>
                  <dt>Signing order</dt>
                  <dd>{doc.signInOrder ? 'One after another' : 'Everyone at once'}</dd>
                </div>
                <div>
                  <dt>Email verification</dt>
                  <dd>{doc.requireCode ? 'Code required' : 'Private link'}</dd>
                </div>
                <div>
                  <dt>Link expires after</dt>
                  <dd>{doc.expiresInDays || 30} days</dd>
                </div>
              </dl>
              <p className="qd-notice">
                Sending emails the signing links. Saving alone does not send anything.
              </p>
              <button
                className="qd-button qd-button--primary qd-signing-send"
                type="button"
                disabled={!canSend}
                onClick={async () => {
                  const r = await call(
                    'send',
                    { method: 'POST' },
                    doc.signInOrder
                      ? 'Signing started. The first person receives their link now.'
                      : 'Signing started. Email links requested for everyone.',
                  )
                  if (r) {
                    if (r.failed?.length)
                      setNote({
                        tone: 'danger',
                        text: `Signing started, but email failed for ${r.failed.join(', ')}. Review the status and use a reminder after resolving the delivery problem.`,
                      })
                    await loadStatus()
                  }
                }}
              >
                <Send size={16} aria-hidden="true" />
                {busy === 'send'
                  ? 'Sending…'
                  : `Send to ${signers.length} ${signers.length === 1 ? 'person' : 'people'}`}
              </button>
              <p>
                {doc.signInOrder
                  ? 'The first signer receives the link now. Others follow after the previous person signs.'
                  : 'Everyone receives their own private link.'}
              </p>
              <button
                type="button"
                className="qd-button qd-button--quiet"
                disabled={Boolean(busy)}
                onClick={() => void loadStatus()}
              >
                Refresh signing status
              </button>
            </div>
          </section>
        </div>
        {feedback}
      </div>
    )
  }

  const people = (live?.signers || []) as Doc[]
  const signedCount = people.filter((p) => p.status === 'signed').length
  const headline: Record<string, string> = {
    out: live ? `Out for signing · ${signedCount} of ${people.length} signed` : 'Out for signing',
    completing: 'Everyone has signed. Preparing the signed copy…',
    completed: 'Signed by everyone',
    declined: 'Declined',
    cancelled: 'Withdrawn',
    expired: 'Expired before everyone signed',
  }
  return (
    <section className="qd-panel qd-signing">
      <div className="qd-panel__header">
        <h2>{headline[status] || status}</h2>
        <button
          className="qd-button qd-button--quiet"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void loadStatus()}
        >
          Refresh status
        </button>
      </div>
      <div className="qd-panel__body">
        {feedback}
        <p>
          {doc.reference || live?.reference
            ? `Reference ${doc.reference || live?.reference}. `
            : ''}
          {live?.expiresAt && status === 'out'
            ? `Links work until ${when(live.expiresAt)} GMT.`
            : ''}
        </p>
        {!live && !loadError && <p role="status">Loading signing status…</p>}
        {people.map((person) => (
          <div className="qd-signing-person" key={person.email}>
            <div>
              <strong>{person.name}</strong>
              <small>{person.email}</small>
              <span
                className={`qd-badge ${person.status === 'signed' ? 'qd-badge--success' : person.status === 'declined' ? 'qd-badge--danger' : 'qd-badge--info'}`}
              >
                {STATUS[person.status] || person.status}
                {person.signedAt ? ` · ${when(person.signedAt)}` : ''}
              </span>
              {person.declineReason && <p>{person.declineReason}</p>}
            </div>
            {person.url && status === 'out' && (
              <button
                className="qd-button"
                type="button"
                onClick={async () => {
                  if (await copyText(person.url)) setCopied(person.email)
                  else
                    setNote({
                      tone: 'danger',
                      text: 'The link could not be copied. Check your browser clipboard permission and try again.',
                    })
                }}
              >
                {copied === person.email ? 'Copied' : 'Copy link'}
              </button>
            )}
          </div>
        ))}
        {status === 'out' && (
          <div className="qd-actions" style={{ marginTop: 20 }}>
            <button
              className="qd-button qd-button--primary"
              type="button"
              disabled={Boolean(busy)}
              onClick={async () => {
                const r = await call('remind', { method: 'POST' }, 'Reminder requested.')
                if (r) {
                  setNote({
                    tone: 'success',
                    text: r.reminded?.length
                      ? `Reminder sent to ${r.reminded.join(', ')}.`
                      : 'Nobody is waiting on a reminder.',
                  })
                  await loadStatus()
                }
              }}
            >
              {busy === 'remind' ? 'Sending…' : 'Send a reminder'}
            </button>
            {!confirmWithdraw ? (
              <button
                className="qd-button qd-button--danger"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </button>
            ) : (
              <>
                <button
                  className="qd-button qd-button--danger"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={async () => {
                    const r = await call('cancel', { method: 'POST' }, 'Request withdrawn.')
                    if (r) {
                      setConfirmWithdraw(false)
                      await loadStatus()
                    }
                  }}
                >
                  Confirm withdrawal
                </button>
                <button
                  className="qd-button"
                  type="button"
                  onClick={() => setConfirmWithdraw(false)}
                >
                  Keep request
                </button>
              </>
            )}
          </div>
        )}
        {status === 'completed' && live?.signedFile?.url && (
          <p>
            <a
              className="qd-button qd-button--primary"
              href={live.signedFile.url}
              target="_blank"
              rel="noreferrer"
            >
              Download signed copy <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </p>
        )}
        {status === 'completed' && (
          <p>
            <CheckCircle2 size={15} aria-hidden="true" /> The completed document is kept as a
            read-only record.
          </p>
        )}
        {status === 'completed' && doc.signedHash && (
          <details className="qd-signing-history">
            <summary>Document fingerprint</summary>
            <p style={{ overflowWrap: 'anywhere' }}>{doc.signedHash}</p>
          </details>
        )}
        {Array.isArray(doc.events) && doc.events.length > 0 && (
          <details className="qd-signing-history">
            <summary>Signing history</summary>
            <ul>
              {doc.events.map((event: Doc, i: number) => (
                <li key={i}>
                  {when(event.at)} · {event.text}
                </li>
              ))}
            </ul>
          </details>
        )}
        {['declined', 'cancelled', 'expired'].includes(status) && (
          <p className="qd-notice">
            <AlertCircle size={15} aria-hidden="true" /> This request is closed. Prepare a new
            request if the document still needs signing.
          </p>
        )}
      </div>
    </section>
  )
}
