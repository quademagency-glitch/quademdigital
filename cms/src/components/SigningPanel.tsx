'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

import { T, panel } from './pitchTheme'

/**
 * The part of a signing request Ernest actually works in.
 *
 * Before sending: every signature place found in the document, grouped by whose
 * it is, with a choice to change the match. After sending: where each person
 * is, a link to copy for WhatsApp, a reminder, and withdrawing. Once everyone
 * has signed: the signed copy.
 *
 * Matches are made against the saved list of signers, so the panel asks for a
 * save whenever the form has changes, rather than offering choices that the
 * server would refuse.
 */

type Doc = Record<string, any>
const API = '/api/signature-requests'

const KIND: Record<string, string> = { signature: 'signature', initials: 'initials', name: 'name', date: 'date', title: 'job title' }
const STATUS: Record<string, [string, string]> = {
  waiting: ['Waiting their turn', T.faint],
  sent: ['Sent, not opened yet', T.muted],
  opened: ['Opened, not signed yet', T.accent],
  signed: ['Signed', T.good],
  declined: ['Declined', T.bad],
  cancelled: ['Withdrawn', T.faint],
}

const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' }) : ''

const copyText = async (text: string) => {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true } } catch { /* fall through */ }
  try {
    const el = document.createElement('textarea')
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'
    document.body.appendChild(el); el.select()
    const ok = document.execCommand('copy'); document.body.removeChild(el); return ok
  } catch { return false }
}

const button = (primary = false, danger = false): React.CSSProperties => ({
  appearance: 'none', cursor: 'pointer', borderRadius: 999, padding: '8px 16px', fontSize: 14, fontWeight: 600,
  border: `1px solid ${danger ? T.bad : primary ? T.accent : T.border}`,
  background: primary ? T.accent : 'transparent', color: primary ? '#04121c' : danger ? T.bad : T.text,
})
const h = { margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: T.text } as const
const sub = { margin: '0 0 14px', fontSize: 13, color: T.muted, lineHeight: 1.5 } as const

export const SigningPanel = () => {
  const { id, savedDocumentData } = useDocumentInfo() as { id?: number | string; savedDocumentData?: Doc }
  const modified = useFormModified()
  const doc = savedDocumentData || {}
  const status: string = doc.status || 'draft'
  const [live, setLive] = useState<Doc | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [copied, setCopied] = useState('')

  const loadStatus = useCallback(async () => {
    if (!id || status === 'draft') return
    const res = await fetch(`${API}/${id}/status`, { credentials: 'include' })
    if (res.ok) setLive(await res.json())
  }, [id, status])
  useEffect(() => { loadStatus() }, [loadStatus])

  const call = async (path: string, init: RequestInit, done: string) => {
    setBusy(path); setNote(null)
    try {
      const res = await fetch(`${API}/${id}/${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setNote({ tone: 'bad', text: data.error || `That did not work (HTTP ${res.status}).` }); return null }
      setNote({ tone: 'good', text: done })
      return data
    } finally { setBusy('') }
  }

  if (!id) {
    return (
      <div style={{ ...panel, padding: 16, marginBottom: 24 }}>
        <p style={h}>Send a document for signing</p>
        <p style={{ ...sub, margin: 0 }}>Upload the PDF, add everyone who signs it, and save. The places to sign are found in the document when you save, and shown here before anything is sent.</p>
      </div>
    )
  }

  const signers = (doc.signers || []) as Doc[]
  const parties = (doc.parties || []) as Doc[]
  const places = (doc.places || []) as Doc[]
  const nameOf = (signerId?: string | null) => signers.find((s) => String(s.id) === String(signerId))?.name

  if (status === 'draft') {
    const placesOf = (partyId: string) => places.filter((p) => p.party === partyId)
    const describe = (partyId: string) => {
      const list = placesOf(partyId)
      const pages = [...new Set(list.map((p) => p.page))]
      const kinds = [...new Set(list.map((p) => KIND[p.kind] || p.kind))]
      return `${kinds.join(', ')} · page${pages.length > 1 ? 's' : ''} ${pages.length > 3 ? `${pages[0]} to ${pages[pages.length - 1]}` : pages.join(', ')}`
    }
    const withSignature = new Set(parties.filter((p) => p.signerId && placesOf(p.partyId).some((f) => f.kind === 'signature')).map((p) => String(p.signerId)))
    const onPageAtEnd = signers.filter((s) => !withSignature.has(String(s.id)))
    const canSend = signers.length > 0 && Boolean(doc.filename) && !modified

    return (
      <div style={{ ...panel, padding: 16, marginBottom: 24 }}>
        <p style={h}>Where each person signs</p>
        {!doc.filename ? (
          <p style={sub}>Upload the PDF and save.</p>
        ) : !parties.length ? (
          <p style={sub}>No signature places were found in this document, so everyone signs on a signing page added at the end.</p>
        ) : (
          <>
            <p style={sub}>Found in the document. Check each one is matched to the right person; change it if not. A place matched to nobody stays blank.</p>
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {parties.map((p) => (
                <div key={p.partyId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.overlay }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: T.text, fontWeight: 600, overflowWrap: 'anywhere' }}>{p.witness ? '' : ''}{p.context || 'Signature block'}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{p.witness ? 'Witness · ' : ''}{describe(p.partyId)}</div>
                  </div>
                  <select
                    aria-label={`Who signs: ${p.context}`}
                    disabled={modified || busy === 'assign'}
                    value={p.signerId || ''}
                    onChange={async (e) => {
                      const ok = await call('assign', { method: 'POST', body: JSON.stringify({ party: p.partyId, signerId: e.target.value || null }) }, 'Saved.')
                      if (ok) window.location.reload()
                    }}
                    style={{ minWidth: 180, padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.raised, color: T.text, fontSize: 14 }}
                  >
                    <option value="">Nobody, leave blank</option>
                    {signers.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
        {onPageAtEnd.length > 0 && parties.length > 0 && (
          <p style={{ ...sub, color: T.text }}>{onPageAtEnd.map((s) => s.name).join(', ')} {onPageAtEnd.length > 1 ? 'have' : 'has'} no signature place in the document, so {onPageAtEnd.length > 1 ? 'they sign' : 'they sign'} on the signing page added at the end.</p>
        )}
        {modified && <p style={{ ...sub, color: T.bad }}>Save your changes first. Places are matched to the saved list of signers.</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button" style={{ ...button(true), opacity: canSend ? 1 : 0.5 }} disabled={!canSend || Boolean(busy)}
            onClick={async () => { const r = await call('send', { method: 'POST' }, 'Sent. Each person has their link by email.'); if (r) window.location.reload() }}
          >{busy === 'send' ? 'Sending…' : `Send to ${signers.length || ''} ${signers.length === 1 ? 'person' : 'people'}`.replace('  ', ' ')}</button>
          <span style={{ fontSize: 13, color: T.muted }}>{doc.requireCode ? 'Each person will be asked for a code. ' : ''}{doc.signInOrder ? 'One after another, in the order listed.' : 'Everyone at once.'}</span>
        </div>
        {note && <p style={{ margin: '12px 0 0', fontSize: 13, color: note.tone === 'bad' ? T.bad : T.good }}>{note.text}</p>}
      </div>
    )
  }

  const people = (live?.signers || []) as Doc[]
  const signedCount = people.filter((p) => p.status === 'signed').length
  const headline: Record<string, string> = {
    out: `Out for signing · ${signedCount} of ${people.length || signers.length} signed`,
    completing: 'Everyone has signed. Preparing the signed copy…',
    completed: `Signed by everyone${live?.completedAt ? ` · ${when(live.completedAt)}` : ''}`,
    declined: 'Declined',
    cancelled: 'Withdrawn',
    expired: 'Expired before everyone signed',
  }

  return (
    <div style={{ ...panel, padding: 16, marginBottom: 24 }}>
      <p style={h}>{headline[status] || status}</p>
      <p style={sub}>{doc.reference ? `Reference ${doc.reference}. ` : ''}{live?.expiresAt && status === 'out' ? `Links work until ${when(live.expiresAt)}.` : ''}</p>
      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
        {people.map((p) => {
          const [label, colour] = STATUS[p.status] || [p.status, T.muted]
          return (
            <div key={p.email} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.overlay }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p.name} <span style={{ fontWeight: 400, color: T.muted }}>{p.email}</span></div>
                <div style={{ fontSize: 12, color: colour, marginTop: 2 }}>
                  {label}{p.status === 'signed' && p.signedAt ? ` · ${when(p.signedAt)}` : p.openedAt && p.status === 'opened' ? ` · opened ${when(p.openedAt)}` : ''}
                  {p.declineReason ? ` · "${p.declineReason}"` : ''}
                </div>
              </div>
              {p.url && status === 'out' && (
                <button type="button" style={button()} onClick={async () => { if (await copyText(p.url)) { setCopied(p.email); setTimeout(() => setCopied(''), 2000) } }}>
                  {copied === p.email ? 'Copied' : 'Copy link'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {status === 'out' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={button(true)} disabled={Boolean(busy)} onClick={async () => { const r = await call('remind', { method: 'POST' }, 'Reminder sent.'); if (r) { setNote({ tone: 'good', text: r.reminded?.length ? `Reminder sent to ${r.reminded.join(', ')}.` : 'Nobody is waiting on a reminder.' }); loadStatus() } }}>
            {busy === 'remind' ? 'Sending…' : 'Send a reminder'}
          </button>
          {!confirmWithdraw ? (
            <button type="button" style={button(false, true)} onClick={() => setConfirmWithdraw(true)}>Withdraw</button>
          ) : (
            <>
              <button type="button" style={button(true, true)} disabled={Boolean(busy)} onClick={async () => { const r = await call('cancel', { method: 'POST' }, 'Withdrawn.'); if (r) window.location.reload() }}>Yes, withdraw it</button>
              <button type="button" style={button()} onClick={() => setConfirmWithdraw(false)}>Keep it</button>
            </>
          )}
        </div>
      )}
      {status === 'completed' && live?.signedFile?.url && (
        <p style={{ margin: 0 }}><a href={live.signedFile.url} target="_blank" rel="noreferrer" style={{ ...button(true), display: 'inline-block', textDecoration: 'none' }}>Download the signed copy</a></p>
      )}
      {status === 'completed' && doc.signedHash && <p style={{ ...sub, margin: '12px 0 0', overflowWrap: 'anywhere' }}>Fingerprint of the signed copy: {doc.signedHash}</p>}
      {note && <p style={{ margin: '12px 0 0', fontSize: 13, color: note.tone === 'bad' ? T.bad : T.good }}>{note.text}</p>}
      {Array.isArray(doc.events) && doc.events.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: T.muted }}>History</summary>
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
            {(doc.events as Doc[]).map((e, i) => (
              <li key={i} style={{ fontSize: 12, color: T.muted }}><span style={{ color: T.faint }}>{when(e.at)}</span> · {e.text}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
