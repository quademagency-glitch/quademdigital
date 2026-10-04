'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { covers, KINDS, NOBODY, ownerOf, SENDER, SIGNER_PREFIX, type Place, type PlaceKind } from '../lib/signing/places'
import { T } from './pitchTheme'

/**
 * The document itself, with every place laid over it, on a request's screen.
 *
 * Ernest can move a place, resize it, add one the detector missed, delete one
 * he does not need (a witness line nobody will sign), give it to someone else,
 * and type into the blanks that are his to fill before sending. A blank given
 * to a signer is typed in by them on the signing page.
 *
 * Every change is saved as it is made, through /places, so there is never an
 * unsaved edit for the Send button to miss. Once the request is sent the
 * places are fixed, and this shows them without letting them change.
 *
 * pdf.js is the same self-hosted copy the website uses (cms/public/vendor),
 * loaded by a script tag so the bundler never has to understand it.
 */

type Doc = Record<string, any>
type Local = Place & { key: string }
type Drag = { key: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: Local; rect: DOMRect; moved: boolean }

const API = '/api/signature-requests'
const KIND_LABEL: Record<PlaceKind, string> = { signature: 'Signature', initials: 'Initials', name: 'Name', date: 'Date', title: 'Job title', text: 'Text to type' }
const SIZE: Record<PlaceKind, [number, number]> = { signature: [170, 32], initials: [44, 18], name: [150, 14], date: [110, 14], title: [140, 14], text: [160, 14] }
/* Literal on purpose: these sit on the white of a PDF page in either admin theme. */
const PALETTE = ['#d97706', '#16a34a', '#9333ea', '#dc2626', '#0d9488', '#ca8a04', '#2563eb', '#db2777']
const SENDER_COLOUR = '#0284c7'
const NOBODY_COLOUR = '#6b7280'

let pdfjsPromise: Promise<any> | null = null
const loadPdfjs = () => {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = new Promise((resolve, reject) => {
    const ready = `qdPdfjs${Date.now()}`
    const timer = window.setTimeout(() => { pdfjsPromise = null; reject(new Error('The document viewer did not load.')) }, 20000)
    window.addEventListener(ready, () => { window.clearTimeout(timer); resolve((window as any)[ready]) }, { once: true })
    const s = document.createElement('script')
    s.type = 'module'
    s.textContent = `import * as p from '/vendor/pdfjs/pdf.min.mjs'; p.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs'; window['${ready}'] = p; window.dispatchEvent(new Event('${ready}'))`
    document.head.appendChild(s)
  })
  return pdfjsPromise
}

/** Roughly whether typed words will have to shrink a lot to fit their place (about 10pt type, half an em a letter). */
const tooLong = (p: Place) => String(p.value || '').length * 5 > p.width * 1.6

let tmp = 0
const keyed = (p: Place): Local => ({ ...p, key: p.id || `new-${++tmp}` })
const r1 = (n: number) => Math.round(n * 10) / 10

export const SigningPlacesEditor = () => {
  const { id, savedDocumentData } = useDocumentInfo() as { id?: number | string; savedDocumentData?: Doc }
  const doc = savedDocumentData || {}
  const editable = (doc.status || 'draft') === 'draft'
  const pages = (doc.pages || []) as { width: number; height: number }[]
  const signers = (doc.signers || []) as Doc[]
  const parties = (doc.parties || []) as Doc[]

  const [places, setPlaces] = useState<Local[]>(() => ((doc.places || []) as Place[]).map(keyed))
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ kind: PlaceKind; owner: string } | null>(null)
  const [newKind, setNewKind] = useState<PlaceKind>('text')
  const [newOwner, setNewOwner] = useState<string>(SENDER)
  const [save, setSave] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ state: 'idle' })
  const [viewer, setViewer] = useState<{ state: 'loading' | 'ready' | 'error'; text?: string }>({ state: 'loading' })
  const [scan, setScan] = useState('')
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const drag = useRef<Drag | null>(null)
  const latest = useRef(places)
  latest.current = places

  // A reload after the panel above saves a match brings fresh places with it.
  const savedKey = JSON.stringify(doc.places || [])
  useEffect(() => { setPlaces(((doc.places || []) as Place[]).map(keyed)) }, [savedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const colourOf = useCallback((p: Place) => {
    const o = ownerOf(p, parties)
    if (o === SENDER) return SENDER_COLOUR
    const i = signers.findIndex((s) => String(s.id) === o)
    return i >= 0 ? PALETTE[i % PALETTE.length] : NOBODY_COLOUR
  }, [parties, signers])
  const nameOf = useCallback((p: Place) => {
    const o = ownerOf(p, parties)
    if (o === SENDER) return 'You'
    return signers.find((s) => String(s.id) === o)?.name || 'Nobody'
  }, [parties, signers])

  // ── Drawing the pages ──
  useEffect(() => {
    if (!id || !doc.filename) return
    let cancelled = false
    ;(async () => {
      try {
        const [pdfjs, res] = await Promise.all([loadPdfjs(), fetch(`${API}/${id}/original`, { credentials: 'include' })])
        if (!res.ok) throw new Error(`The document could not be fetched (HTTP ${res.status}).`)
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()), standardFontDataUrl: '/vendor/pdfjs/standard_fonts/', isEvalSupported: false }).promise
        if (cancelled) return
        setViewer({ state: 'ready' })
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n)
          const canvas = canvases.current[n - 1]
          if (!canvas || cancelled) continue
          const base = page.getViewport({ scale: 1 })
          const scale = (Math.max(canvas.clientWidth, 600) / base.width) * Math.min(window.devicePixelRatio || 1, 2)
          const vp = page.getViewport({ scale })
          canvas.width = Math.floor(vp.width)
          canvas.height = Math.floor(vp.height)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        }
      } catch (err) {
        if (!cancelled) setViewer({ state: 'error', text: (err as Error).message })
      }
    })()
    return () => { cancelled = true }
  }, [id, doc.filename, pages.length])

  // ── Saving, one request at a time, a moment after the last change ──
  const inFlight = useRef(false)
  const again = useRef(false)
  const timer = useRef<number | null>(null)
  const persist = useCallback(async () => {
    if (inFlight.current) { again.current = true; return }
    inFlight.current = true
    const sent = latest.current
    setSave({ state: 'saving' })
    try {
      const res = await fetch(`${API}/${id}/places`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: sent.map(({ key, ...p }) => ({ ...p, id: p.id || null })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `That did not save (HTTP ${res.status}).`)
      // New places get their ids from the server; match them up by position.
      const ids = (data.ids || []) as string[]
      setPlaces((cur) => cur.map((p) => {
        const i = sent.findIndex((s) => s.key === p.key)
        return i >= 0 && !p.id && ids[i] ? { ...p, id: ids[i] } : p
      }))
      setSave({ state: 'saved' })
    } catch (err) {
      setSave({ state: 'error', text: (err as Error).message })
    } finally {
      inFlight.current = false
      if (again.current) { again.current = false; void persist() }
    }
  }, [id])
  const change = useCallback((next: Local[] | ((cur: Local[]) => Local[]), soon = false) => {
    setPlaces((cur) => {
      const value = typeof next === 'function' ? next(cur) : next
      latest.current = value
      return value
    })
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void persist() }, soon ? 50 : 700)
  }, [persist])
  const update = (key: string, patch: Partial<Place>, soon = false) =>
    change((cur) => cur.map((p) => (p.key === key ? { ...p, ...patch } : p)), soon)
  const remove = (key: string) => { change((cur) => cur.filter((p) => p.key !== key), true); setSelected(null) }

  // Reads the document again for blanks no place covers yet. Saves first, so
  // nothing typed a moment ago is lost to the reload that shows the result.
  const rescan = async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; await persist() }
    setScan('Looking for blanks…')
    const res = await fetch(`${API}/${id}/rescan`, { method: 'POST', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setScan(data.error || `That did not work (HTTP ${res.status}).`); return }
    if (!data.added) { setScan('Nothing new found.'); return }
    setScan(`Found ${data.added} more. Showing them…`)
    window.location.reload()
  }

  // ── Moving and resizing ──
  const toPdf = (rect: DOMRect, page: number, clientX: number, clientY: number) => {
    const { width: W, height: H } = pages[page - 1]
    return { x: ((clientX - rect.left) / rect.width) * W, y: H - ((clientY - rect.top) / rect.height) * H }
  }
  const onPointerDown = (e: React.PointerEvent, p: Local, mode: 'move' | 'resize') => {
    e.stopPropagation()
    setSelected(p.key)
    if (!editable) return
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-page]') as HTMLElement | null
    if (!pageEl) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { key: p.key, mode, startX: e.clientX, startY: e.clientY, orig: p, rect: pageEl.getBoundingClientRect(), moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const { width: W, height: H } = pages[d.orig.page - 1]
    const dx = ((e.clientX - d.startX) / d.rect.width) * W
    const dy = ((e.clientY - d.startY) / d.rect.height) * H
    if (!d.moved && Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 3) return
    d.moved = true
    const o = d.orig
    const patch = d.mode === 'move'
      ? { x: r1(Math.min(Math.max(0, o.x + dx), W - o.width)), y: r1(Math.min(Math.max(0, o.y - dy), H - o.height)) }
      : (() => {
          const width = r1(Math.min(Math.max(12, o.width + dx), W - o.x))
          const height = r1(Math.min(Math.max(8, o.height + dy), o.y + o.height))
          return { width, height, y: r1(o.y + o.height - height) }
        })()
    setPlaces((cur) => { const v = cur.map((p) => (p.key === d.key ? { ...p, ...patch } : p)); latest.current = v; return v })
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.moved) change((cur) => cur, true)
  }

  const onPageClick = (e: React.MouseEvent, page: number) => {
    if (!adding || !editable) { setSelected(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const at = toPdf(rect, page, e.clientX, e.clientY)
    const [w, h] = SIZE[adding.kind]
    const { width: W, height: H } = pages[page - 1]
    const place = keyed({
      page, kind: adding.kind, x: r1(Math.min(Math.max(0, at.x), W - w)), y: r1(Math.min(Math.max(0, at.y - h), H - h)), width: w, height: h,
      party: adding.owner === SENDER ? SENDER : adding.owner ? `${SIGNER_PREFIX}${adding.owner}` : NOBODY,
      label: adding.kind === 'text' ? '' : null, value: null, required: adding.kind === 'text' && adding.owner !== SENDER ? true : null,
    })
    change((cur) => [...cur, place], true)
    setSelected(place.key)
    setAdding(null)
  }

  // Delete and the arrow keys act on the selected place, unless you are typing.
  useEffect(() => {
    if (!editable) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (!selected || t.closest('input, textarea, select, [contenteditable="true"]')) return
      const p = latest.current.find((x) => x.key === selected)
      if (!p) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(p.key); return }
      const step = e.shiftKey ? 10 : 1
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
      if (move[e.key]) { e.preventDefault(); update(p.key, { x: r1(p.x + move[e.key][0]), y: r1(p.y + move[e.key][1]) }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const sel = places.find((p) => p.key === selected) || null
  const yours = useMemo(() => places.filter((p) => p.kind === 'text' && p.party === SENDER), [places])
  const emptyYours = yours.filter((p) => !String(p.value || '').trim()).length

  if (!id || !doc.filename || !pages.length) return null

  const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '7px 9px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.raised, color: T.text, fontSize: 14 }
  const small: React.CSSProperties = { fontSize: 12, color: T.muted }
  const btn = (primary = false, danger = false): React.CSSProperties => ({
    appearance: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600,
    border: `1px solid ${danger ? T.bad : primary ? T.accent : T.border}`, background: primary ? T.accent : 'transparent',
    // The raised surface is white in the light theme and deep navy in the dark
    // one, which reads on that theme's accent either way.
    color: primary ? T.raised : danger ? T.bad : T.text,
  })
  const ownerSelect = (value: string, onChange: (v: string) => void, kind: PlaceKind, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={input}>
      {kind === 'text' && <option value={SENDER}>Me, before sending</option>}
      {signers.map((s) => <option key={s.id} value={String(s.id)}>{s.name || s.email}</option>)}
      <option value="">Nobody, leave it blank</option>
    </select>
  )
  const statusText = save.state === 'saving' ? 'Saving…' : save.state === 'saved' ? 'All changes saved' : save.state === 'error' ? save.text : ''

  return (
    <div style={{ border: `1px solid ${T.border}`, background: T.raised, borderRadius: 6, padding: 16, margin: '8px 0 24px', color: T.text }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>The document</p>
        <span role="status" style={{ fontSize: 12, color: save.state === 'error' ? T.bad : T.muted }}>{statusText}</span>
      </div>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
        {editable
          ? 'Every place to sign or fill in, on the pages themselves. Click a place to change it, drag it to move it, drag its corner to resize it. Changes save as you make them.'
          : 'This was sent, so the places are fixed. To change anything, withdraw it and send it again.'}
      </p>

      {editable && yours.length > 0 && (
        <div style={{ border: `1px solid ${T.border}`, background: T.overlay, borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600 }}>Blanks you fill in</p>
          <p style={{ ...small, margin: '0 0 10px' }}>
            Printed into the document before anyone signs.{emptyYours ? ` ${emptyYours} still empty: ${emptyYours === 1 ? 'it stays' : 'they stay'} blank unless you fill ${emptyYours === 1 ? 'it' : 'them'} in.` : ''}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {yours.map((p) => (
              <label key={p.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 34%) 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.text, overflowWrap: 'anywhere' }}>{p.label || 'Blank'} <span style={small}>· page {p.page}</span></span>
                <span style={{ display: 'grid', gap: 3 }}>
                  <input style={input} value={p.value || ''} maxLength={500} onFocus={() => setSelected(p.key)} onChange={(e) => update(p.key, { value: e.target.value })} />
                  {tooLong(p) && <span style={{ fontSize: 12, color: T.muted }}>Long for its space, so it will print small. Drag the box wider on the page if there is room.</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {editable && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <button type="button" style={btn()} onClick={rescan} disabled={scan === 'Looking for blanks…'}>Find blanks again</button>
          <span style={small}>{scan || 'Reads the document again and adds any blank that has no place yet. Nothing you have changed is touched.'}</span>
        </div>
      )}

      {editable && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Add a place:</span>
          <select aria-label="What kind of place" value={newKind} onChange={(e) => { const k = e.target.value as PlaceKind; setNewKind(k); if (k !== 'text' && newOwner === SENDER) setNewOwner(String(signers[0]?.id || '')) }} style={{ ...input, width: 'auto' }}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <span style={small}>for</span>
          <div style={{ width: 200 }}>{ownerSelect(newOwner, setNewOwner, newKind, 'Who fills the new place')}</div>
          {adding
            ? <><span style={{ fontSize: 13, color: T.accent }}>Now click on the page where it goes.</span><button type="button" style={btn()} onClick={() => setAdding(null)}>Cancel</button></>
            : <button type="button" style={btn(true)} onClick={() => setAdding({ kind: newKind, owner: newOwner })}>Add</button>}
        </div>
      )}

      {sel && (
        <div style={{ position: 'sticky', top: 64, zIndex: 5, border: `1px solid ${T.accentBorder}`, background: T.raised, borderRadius: 6, padding: 12, marginBottom: 12, boxShadow: '0 8px 24px -16px rgba(0,0,0,.45)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Page {sel.page}{sel.context ? ` · "${sel.context}"` : ''}</span>
            <button type="button" style={{ ...btn(), padding: '4px 10px' }} onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={small}>What it is</span>
              <select disabled={!editable} value={sel.kind} style={input} onChange={(e) => {
                const kind = e.target.value as PlaceKind
                const patch: Partial<Place> = { kind }
                if (kind !== 'text' && sel.party === SENDER) patch.party = signers[0] ? `${SIGNER_PREFIX}${signers[0].id}` : NOBODY
                if (kind === 'text' && sel.kind !== 'text') { patch.label = ''; patch.required = sel.party === SENDER ? null : true }
                update(sel.key, patch, true)
              }}>
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={small}>Who fills it</span>
              {editable
                ? ownerSelect(ownerOf(sel, parties) || '', (v) => update(sel.key, {
                    party: v === SENDER ? SENDER : v ? `${SIGNER_PREFIX}${v}` : NOBODY,
                    ...(sel.kind === 'text' ? { required: v === SENDER ? null : sel.required ?? true, value: v === SENDER ? sel.value ?? '' : null } : {}),
                  }, true), sel.kind, 'Who fills this place')
                : <span style={{ fontSize: 14 }}>{nameOf(sel)}</span>}
            </label>
            {sel.kind === 'text' && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={small}>What goes here</span>
                <input disabled={!editable} style={input} maxLength={120} placeholder="e.g. Witness address" value={sel.label || ''} onChange={(e) => update(sel.key, { label: e.target.value })} />
              </label>
            )}
            {sel.kind === 'text' && sel.party === SENDER && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={small}>Your text</span>
                <input disabled={!editable} style={input} maxLength={500} value={sel.value || ''} onChange={(e) => update(sel.key, { value: e.target.value })} />
              </label>
            )}
            {sel.kind === 'text' && sel.party !== SENDER && ownerOf(sel, parties) && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" disabled={!editable} checked={sel.required !== false} onChange={(e) => update(sel.key, { required: e.target.checked }, true)} />
                They must fill it in
              </label>
            )}
          </div>
          {editable && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" style={btn(false, true)} onClick={() => remove(sel.key)}>Delete this place</button>
              <span style={small}>Arrow keys nudge it; Shift moves further.</span>
            </div>
          )}
        </div>
      )}

      {viewer.state === 'error' && <p style={{ color: T.bad, fontSize: 13 }}>{viewer.text}</p>}
      {viewer.state === 'loading' && <p style={{ ...small, margin: '0 0 8px' }}>Loading the document…</p>}

      <div style={{ display: 'grid', gap: 14, maxWidth: 860 }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {pages.map((pg, i) => (
          <div
            key={i}
            data-page={i + 1}
            onClick={(e) => onPageClick(e, i + 1)}
            style={{ position: 'relative', aspectRatio: `${pg.width} / ${pg.height}`, background: '#fff', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,.25)', cursor: adding ? 'crosshair' : 'default', overflow: 'hidden', touchAction: 'none' }}
          >
            <canvas ref={(el) => { canvases.current[i] = el }} style={{ display: 'block', width: '100%', height: '100%' }} aria-label={`Page ${i + 1} of ${pages.length}`} />
            <span style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 11, color: '#6b7280' }}>{i + 1} / {pages.length}</span>
            {places.filter((p) => p.page === i + 1).map((p) => {
              const colour = colourOf(p)
              const isSel = p.key === selected
              const caption = p.kind === 'text' ? (p.party === SENDER ? (p.value || p.label || 'Your text') : `${p.label || 'Text'} · ${nameOf(p)}`) : `${KIND_LABEL[p.kind]} · ${nameOf(p)}`
              return (
                <div
                  key={p.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${KIND_LABEL[p.kind]} for ${nameOf(p)}, page ${p.page}`}
                  onPointerDown={(e) => onPointerDown(e, p, 'move')}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => setSelected(p.key)}
                  style={{
                    position: 'absolute',
                    left: `${(p.x / pg.width) * 100}%`, top: `${((pg.height - p.y - p.height) / pg.height) * 100}%`,
                    width: `${(p.width / pg.width) * 100}%`, height: `${(p.height / pg.height) * 100}%`,
                    background: covers(p) && p.party === SENDER && p.value ? '#ffffff' : `${colour}${isSel ? '33' : '1f'}`, outline: `${isSel ? 2 : 1.5}px ${ownerOf(p, parties) ? 'solid' : 'dashed'} ${colour}`,
                    borderRadius: 3, cursor: editable ? 'move' : 'default', display: 'flex', alignItems: 'flex-end', overflow: 'visible',
                  }}
                >
                  <span style={{ fontSize: 'clamp(7px, 1.15vw, 11px)', lineHeight: 1.1, color: p.party === SENDER && p.value ? '#0b1220' : colour, fontWeight: p.party === SENDER && p.value ? 500 : 700, padding: '0 3px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', pointerEvents: 'none' }}>
                    {caption}
                  </span>
                  {editable && isSel && (
                    <span
                      aria-hidden="true"
                      onPointerDown={(e) => onPointerDown(e, p, 'resize')}
                      style={{ position: 'absolute', right: -5, bottom: -5, width: 10, height: 10, background: colour, border: '2px solid #fff', borderRadius: 2, cursor: 'nwse-resize' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
