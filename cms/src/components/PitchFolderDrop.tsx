'use client'

import { useConfig, useDocumentInfo, useForm } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
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
 * **It works while creating the pitch, which is the whole point.** The files
 * need a document to belong to, so the first version asked for a name and a
 * save before it would take a folder, which is a form to fill in before you can
 * do the thing you came to do. Dropping a folder on a new pitch now creates the
 * pitch first, out of whatever is on the form, named after the folder if
 * nothing has been typed, and then uploads into it and opens it. One gesture.
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
  const { getData } = useForm()
  const { config } = useConfig()
  const router = useRouter()
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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

  /**
   * Create the pitch this folder is going to live in.
   *
   * Everything already typed on the form is kept, so a name, a prospect and an
   * expiry entered before the drop are not thrown away. The folder's own name
   * fills in the title when nothing has been typed, which makes "drop it and
   * go" the shortest path: the slug derives from the title in the collection's
   * own hook, exactly as it does on an ordinary save.
   */
  const createPitch = async (folderName: string): Promise<string | number> => {
    const data = { ...((getData?.() as Record<string, unknown>) || {}) }
    // The folder decides these two, not the empty form underneath it.
    delete data.html
    delete data.id
    const title = String(data.title || folderName || 'Untitled pitch').slice(0, 120)

    const res = await fetch('/api/pitches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...data, title }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail =
        body?.errors?.[0]?.data?.errors?.[0]?.message ||
        body?.errors?.[0]?.message ||
        `HTTP ${res.status}`
      throw new Error(
        /unique|already/i.test(String(detail))
          ? 'There is already a pitch at that address. Give this one a different name.'
          : `The pitch could not be created: ${detail}`,
      )
    }
    return body?.doc?.id
  }

  const send = async (picked: Picked[]) => {
    const files = picked.filter(usable)
    if (!files.length) {
      setResult({ tone: 'bad', text: 'Nothing usable in that.' })
      return
    }
    if (files.length > MAX_FILES) {
      setResult({ tone: 'bad', text: `${files.length} files. The limit is ${MAX_FILES}.` })
      return
    }
    const total = files.reduce((sum, f) => sum + f.file.size, 0)
    if (total > MAX_BYTES) {
      setResult({ tone: 'bad', text: `That is ${kb(total)}. The limit is 40MB.` })
      return
    }

    const base = relativeTo(files.map((f) => f.path))
    const paths = files.map((f) => (base && f.path.startsWith(base) ? f.path.slice(base.length) : f.path))

    const body = new FormData()
    files.forEach((f, i) => body.append(`f${i}`, f.file, f.file.name))
    body.append('_payload', JSON.stringify({ paths }))

    setResult(null)
    try {
      let pitchId = id
      const isNew = !pitchId
      if (isNew) {
        setBusy('Creating the pitch...')
        /*
          What to call it when nothing has been typed. A folder brings its own
          name. A single file has no folder, so the file's own stem is the next
          best thing, except when it is called index, which describes every one
          of these and identifies none of them.
        */
        const stem =
          base.replace(/\/$/, '') ||
          (files.length === 1 ? files[0].file.name.replace(/\.[^.]+$/, '') : '')
        pitchId = await createPitch(/^index$/i.test(stem) ? '' : stem)
      }

      setBusy(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}...`)
      const res = await fetch(`/api/pitches/${pitchId}/folder`, {
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
          (isNew ? ' Opening it.' : ' Reloading.'),
      })

      /*
        A new pitch has just been written by this component rather than by the
        Save button, so the form on screen is a create form for a document that
        now exists. Going to it is the only honest next state. An existing one
        just reloads: the markup it is showing was replaced underneath it.
      */
      const adminRoute = config?.routes?.admin || '/admin'
      setTimeout(() => {
        if (isNew) {
          router.push(`${adminRoute}/collections/pitches/${pitchId}`)
          router.refresh()
        } else {
          window.location.reload()
        }
      }, 900)
    } catch (err) {
      setResult({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not reach the server.' })
    } finally {
      setBusy('')
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (busy) return
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

  return (
    <div style={panel}>
      <strong style={heading}>The site</strong>
      <div style={{ color: T.muted, marginBottom: 12 }}>
        A whole exported folder, or one self-contained .html file. Either works. With a folder the
        index becomes the page and everything beside it is served at the address the markup already
        asks for, so nothing has to be rewritten.
        {!id && ' On a new pitch either one creates it, named after what you dropped unless you have typed a name.'}
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
        {busy || (over ? 'Let go' : 'Drag a folder or a file here, or click to choose a folder')}
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

      {/*
        A second input, because one <input> cannot offer both a folder and a
        file: webkitdirectory turns the picker into a directory chooser and
        there is no way to ask for either. Dropping a single file on the zone
        above has always worked, since the drop handler walks whatever it is
        given, but the only way to CHOOSE one was Payload's upload box further
        up the screen, and every word on this panel said "folder". So a single
        file looked unsupported when it was not.
      */}
      <button
        type="button"
        onClick={() => !busy && fileInput.current?.click()}
        disabled={Boolean(busy)}
        style={{
          marginTop: 8,
          padding: 0,
          border: 'none',
          background: 'none',
          color: T.muted,
          textDecoration: 'underline',
          textAlign: 'left',
          cursor: busy ? 'progress' : 'pointer',
          fontSize: 12,
        }}
      >
        or choose a single .html file
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".html,.htm,text/html"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          await send(files.map((file) => ({ file, path: file.name })))
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

      {id && assets && assets.length === 0 && (
        <p style={{ margin: '10px 0 0', color: T.muted }}>
          Just the page, nothing beside it. That is all a self-contained .html needs.
        </p>
      )}
    </div>
  )
}
