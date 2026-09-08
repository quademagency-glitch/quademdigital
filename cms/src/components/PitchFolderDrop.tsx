'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import { T, heading, panel } from './pitchTheme'

/**
 * Drop the whole folder.
 *
 * A browser cannot upload a directory. It can be handed one and asked for the
 * files inside it, each still carrying the path it had, which is what this
 * does: walk what was dropped, keep the paths, and post the lot to the pitch's
 * `/folder` endpoint. The index becomes the page and everything beside it
 * becomes a file the site serves at the same relative address the markup asks
 * for, so an exported site works as exported.
 *
 * Two ways in, because both are how people actually do this: drag the folder
 * from Finder, or click and pick it. The second uses `webkitDirectory`, which
 * is non-standard and implemented by every browser that matters.
 *
 * The junk Finder and this drive leave behind is dropped on the floor:
 * .DS_Store, __MACOSX, and the `._` AppleDouble sidecars that have broken a
 * CMS build here three times already.
 */

const MAX_FILES = 150
const MAX_BYTES = 40_000_000

const JUNK = /(^|\/)(\.DS_Store|Thumbs\.db|__MACOSX|\.git|\.gitignore|node_modules)(\/|$)/i
const APPLE_DOUBLE = /(^|\/)\._/

type Picked = { file: File; path: string }
type Asset = { id: number; path: string; filesize?: number }

const usable = ({ path }: Picked) => !JUNK.test(path) && !APPLE_DOUBLE.test(path)

/** Strip the wrapper directory Finder gives you when you drag a folder. */
const relativeTo = (paths: string[]) => {
  const segments = paths.map((p) => p.split('/'))
  if (segments.length < 2) return ''
  const first = segments[0][0]
  return segments.every((s) => s.length > 1 && s[0] === first) ? `${first}/` : ''
}

const readEntries = (reader: any): Promise<any[]> =>
  new Promise((resolve) => reader.readEntries((entries: any[]) => resolve(entries), () => resolve([])))

const walk = async (entry: any, prefix: string, out: Picked[]): Promise<void> => {
  if (!entry) return
  if (entry.isFile) {
    const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject))
    out.push({ file, path: `${prefix}${entry.name}` })
    return
  }
  if (entry.isDirectory) {
    const reader = entry.createReader()
    // readEntries hands back at most a hundred at a time and an empty array
    // when it is finished, so it has to be asked repeatedly.
    for (;;) {
      const batch = await readEntries(reader)
      if (!batch.length) break
      for (const child of batch) await walk(child, `${prefix}${entry.name}/`, out)
    }
  }
}

const kb = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`)

export const PitchFolderDrop = () => {
  const { id } = useDocumentInfo() as any
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const loadAssets = useCallback(() => {
    if (!id) return
    fetch(`/api/pitch-assets?where[pitch][equals]=${id}&limit=200&depth=0&sort=path`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setAssets(d.docs || []))
      .catch(() => setAssets(null))
  }, [id])

  useEffect(loadAssets, [loadAssets])

  const send = async (picked: Picked[]) => {
    const files = picked.filter(usable)
    if (!files.length) {
      setResult({ tone: 'bad', text: 'Nothing usable in that folder.' })
      return
    }
    if (files.length > MAX_FILES) {
      setResult({ tone: 'bad', text: `${files.length} files. The limit is ${MAX_FILES}.` })
      return
    }
    const total = files.reduce((sum, f) => sum + f.file.size, 0)
    if (total > MAX_BYTES) {
      setResult({ tone: 'bad', text: `That folder is ${kb(total)}. The limit is 40MB.` })
      return
    }

    const base = relativeTo(files.map((f) => f.path))
    const paths = files.map((f) => (base && f.path.startsWith(base) ? f.path.slice(base.length) : f.path))

    const body = new FormData()
    files.forEach((f, i) => body.append(`f${i}`, f.file, f.file.name))
    body.append('_payload', JSON.stringify({ paths }))

    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`/api/pitches/${id}/folder`, {
        method: 'POST',
        body,
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ tone: 'bad', text: data?.error || `The upload failed with HTTP ${res.status}.` })
        return
      }
      const left = Array.isArray(data.skipped) ? data.skipped : []
      setResult({
        tone: 'ok',
        text:
          `${data.index} is the page, with ${data.files} file${data.files === 1 ? '' : 's'} beside it.` +
          (left.length ? ` Left out, not a kind we serve: ${left.slice(0, 4).join(', ')}${left.length > 4 ? ` and ${left.length - 4} more` : ''}.` : '') +
          ' Reloading.',
      })
      // The page it just rewrote is on screen and now stale, markup included.
      // A reload is the honest way to show what was actually saved.
      setTimeout(() => window.location.reload(), 900)
    } catch {
      setResult({ tone: 'bad', text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (busy || !id) return
    const items = Array.from(e.dataTransfer.items || [])
    const entries = items.map((i: any) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean)
    const out: Picked[] = []
    if (entries.length) {
      for (const entry of entries) await walk(entry, '', out)
    } else {
      for (const file of Array.from(e.dataTransfer.files || [])) out.push({ file, path: file.name })
    }
    await send(out)
  }

  if (!id) {
    return (
      <div style={panel}>
        <strong style={heading}>The folder</strong>
        <div style={{ color: T.muted }}>
          Give this pitch a name and press Save, and the drop zone appears here. The files need a
          document to belong to, and that is this one.
        </div>
      </div>
    )
  }

  return (
    <div style={panel}>
      <strong style={heading}>The folder</strong>
      <div style={{ color: T.muted, marginBottom: 12 }}>
        Drop the exported site in, folder and all. The index becomes the page and everything beside
        it is served at the address the markup already asks for, so nothing has to be rewritten.
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') input.current?.click()
        }}
        style={{
          border: `2px dashed ${over ? T.accent : T.accentBorder}`,
          background: over ? 'var(--qd-accent-dim, rgba(0, 174, 239, 0.15))' : T.accentSubtle,
          color: T.text,
          fontWeight: 500,
          borderRadius: 8,
          padding: '26px 16px',
          textAlign: 'center',
          cursor: busy ? 'progress' : 'pointer',
          transition: 'border-color .15s, background .15s',
        }}
      >
        {busy ? 'Uploading the folder...' : over ? 'Let go' : 'Drag the folder here, or click to choose one'}
      </div>

      <input
        ref={input}
        type="file"
        multiple
        // Non-standard and universally supported. React needs them lowercased.
        {...{ webkitdirectory: '', directory: '' }}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          await send(files.map((file) => ({ file, path: (file as any).webkitRelativePath || file.name })))
          e.target.value = ''
        }}
      />

      {result && (
        <p style={{ margin: '10px 0 0', color: result.tone === 'ok' ? T.good : T.bad }}>
          {result.text}
        </p>
      )}

      {assets && assets.length > 0 && (
        <details style={{ marginTop: 10, color: T.muted }}>
          <summary style={{ cursor: 'pointer', color: T.text }}>
            {assets.length} file{assets.length === 1 ? '' : 's'} alongside the page
          </summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: T.muted }}>
            {assets.map((a) => (
              <li key={a.id} style={{ wordBreak: 'break-all' }}>
                <code>{a.path}</code>
                {typeof a.filesize === 'number' ? ` (${kb(a.filesize)})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {assets && assets.length === 0 && (
        <p style={{ margin: '10px 0 0', color: T.muted }}>
          No files yet. A single self-contained .html in the box above works too.
        </p>
      )}
    </div>
  )
}
