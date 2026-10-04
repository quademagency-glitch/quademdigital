'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { T } from './pitchTheme'

/**
 * "Wrong email address?" on a request that is out for signing.
 *
 * Ernest picks someone who has not signed yet, types the right address, and a
 * new link goes to it (see changeSignerEmail in lib/signing/flow.ts). Nobody
 * else is asked to sign again and nothing restarts. Shown only while the
 * request is out, and only for people who can still sign.
 *
 * Its own field rather than part of SigningPanel, which another tool was
 * redesigning in the shared folder when this was added.
 */

type Doc = Record<string, any>
const API = '/api/signature-requests'
const STATE: Record<string, string> = { waiting: 'waiting their turn', sent: 'not opened yet', opened: 'opened, not signed' }

export const SigningEmailFix = () => {
  const { id, savedDocumentData } = useDocumentInfo() as { id?: number | string; savedDocumentData?: Doc }
  const status = savedDocumentData?.status
  const [people, setPeople] = useState<Doc[]>([])
  const [who, setWho] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  useEffect(() => {
    if (!id || status !== 'out') return
    fetch(`${API}/${id}/status`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const open = ((d?.signers || []) as Doc[]).filter((s) => ['waiting', 'sent', 'opened'].includes(s.status))
        setPeople(open)
        if (open.length === 1) setWho(String(open[0].id))
      })
      .catch(() => {})
  }, [id, status])

  if (!id || status !== 'out' || !people.length) return null
  const chosen = people.find((p) => String(p.id) === who)

  const save = async () => {
    setNote(null)
    if (!chosen) return setNote({ tone: 'bad', text: 'Choose who the address is for.' })
    setBusy(true)
    try {
      const res = await fetch(`${API}/${id}/change-email`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: chosen.id, email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setNote({ tone: 'bad', text: data.error || `That did not work (HTTP ${res.status}).` })
      setNote({ tone: 'good', text: data.sent ? `Saved. A new link is on its way to ${data.email}; the old one no longer works.` : `Saved. ${data.name} gets a link at ${data.email} when it is their turn.` })
      window.setTimeout(() => window.location.reload(), 1800)
    } finally { setBusy(false) }
  }

  const input: React.CSSProperties = { boxSizing: 'border-box', padding: '7px 9px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.raised, color: T.text, fontSize: 14 }
  return (
    <div style={{ border: `1px solid ${T.border}`, background: T.raised, borderRadius: 6, padding: 16, margin: '8px 0 24px', color: T.text }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Wrong email address?</p>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
        Correct it for someone who has not signed yet and they get a new link. Everyone who has signed stays signed, and the link sent to the wrong address stops working.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select aria-label="Whose address" value={who} onChange={(e) => setWho(e.target.value)} style={{ ...input, minWidth: 220 }}>
          {people.length > 1 && <option value="">Choose a person</option>}
          {people.map((p) => <option key={p.id} value={String(p.id)}>{p.name} ({p.email}, {STATE[p.status] || p.status})</option>)}
        </select>
        <input aria-label="Correct email address" type="email" placeholder="correct@address.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, minWidth: 240, flex: '1 1 240px' }} />
        <button
          type="button" disabled={busy || !email.trim() || !chosen}
          onClick={save}
          style={{ appearance: 'none', cursor: busy ? 'default' : 'pointer', borderRadius: 999, padding: '8px 16px', fontSize: 14, fontWeight: 600, border: `1px solid ${T.accent}`, background: T.accent, color: T.raised, opacity: busy || !email.trim() || !chosen ? 0.55 : 1 }}
        >{busy ? 'Saving…' : 'Save and send a new link'}</button>
      </div>
      {note && <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: note.tone === 'bad' ? T.bad : T.good }}>{note.text}</p>}
    </div>
  )
}
