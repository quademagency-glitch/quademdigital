'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { T, heading, panel } from './pitchTheme'

/**
 * What this page will do when it is not on your laptop.
 *
 * A pitch is written somewhere else and arrives finished, and the two ways it
 * breaks after it is sent are both invisible while you are looking at the
 * markup:
 *
 *  1. It refers to a file that is not in the folder. Since folders can be
 *     dropped, this is no longer "there is nowhere to put it": it is either a
 *     file that was left out of the export or a path that does not match. The
 *     check knows what was uploaded and only complains about what is missing
 *     from it, so a pitch whose folder is complete says nothing at all.
 *  2. It loads something over plain http. The site is https, so the browser
 *     refuses it silently and the console nobody has open is the only place it
 *     says so. That is what happened to the Wardrobe Theatre pitch: the teaser
 *     video was refused outright and every heading fell back to system type.
 *
 * Everything is checked against the markup as it stands in the box below, so a
 * paste is judged immediately and a dropped file is judged the moment it saves.
 */

const IGNORE = /^(#|mailto:|tel:|sms:|javascript:|data:|blob:)/i

/**
 * A relative reference is only reported when it looks like an actual file:
 * some path, then a dot, then a short extension.
 *
 * Without that test this panel cried wolf. The Exotiq pitch builds its gallery
 * markup in JavaScript, roughly `'<img src="' + IMG[5] + '">'`, and a scan of
 * the raw text reads `+IMG[5]+` as the value of a src attribute. The panel
 * announced four missing files, named them in a language nobody writes paths
 * in, and was wrong about a page that was fine. A warning that fires on a good
 * pitch is worse than no warning, because the next one gets ignored too.
 */
const LOOKS_LIKE_A_FILE = /^[A-Za-z0-9._~\-/]+\.[A-Za-z0-9]{2,5}(?:[?#][^\s]*)?$/

type Ref = { url: string; kind: 'missing' | 'insecure' }

/**
 * Script bodies are code, not markup, and the strings inside them are not
 * requests the browser will make as written. Their opening tags are kept, so a
 * genuine `<script src="app.js">` is still caught. Comments go for the same
 * reason: a commented-out image is not a request.
 */
const markupOnly = (html: string) =>
  html
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')
    .replace(/<!--[\s\S]*?-->/g, '')

/** `./images/x.png?v=2` and `images/x.png` are the same file. */
const normalise = (url: string) => url.replace(/^\.\//, '').split(/[?#]/)[0]

const collect = (html: string, uploaded: Set<string>): { refs: Ref[]; external: number } => {
  const found = new Map<string, Ref>()
  let external = 0

  const consider = (raw: string) => {
    const url = raw.trim()
    if (!url || IGNORE.test(url)) return
    if (/^https:\/\//i.test(url) || url.startsWith('//')) {
      external += 1
      return
    }
    if (/^http:\/\//i.test(url)) {
      found.set(url, { url, kind: 'insecure' })
      return
    }
    if (!LOOKS_LIKE_A_FILE.test(url)) return
    // In the folder that was dropped, so it will be served. Nothing to say.
    if (uploaded.has(normalise(url))) return
    found.set(url, { url, kind: 'missing' })
  }

  const markup = markupOnly(html)

  for (const m of markup.matchAll(/(?:src|href|poster|data-src|srcset)\s*=\s*["']([^"']+)["']/gi)) {
    // srcset carries a list; every candidate in it is a real request.
    for (const part of m[1].split(',')) consider(part.trim().split(/\s+/)[0])
  }
  for (const m of markup.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) consider(m[1])

  return { refs: [...found.values()], external }
}

export const PitchHealth = () => {
  const { id } = useDocumentInfo() as any
  const html = useFormFields(([fields]) => (fields?.html?.value as string) || '')
  const [uploaded, setUploaded] = useState<Set<string>>(new Set())

  /*
    What the folder actually contains. Fetched rather than passed in because
    the folder is uploaded by its own endpoint, not by this form, so the only
    honest source is the collection itself.
  */
  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/pitch-assets?where[pitch][equals]=${id}&limit=300&depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setUploaded(new Set((d.docs || []).map((a: { path: string }) => a.path)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  if (!html) {
    return (
      <div style={panel}>
        <strong style={heading}>Nothing to serve yet</strong>
        <div style={{ color: T.muted }}>
          Drop the exported <code>index.html</code> into the box above and save. One
          file, with its styles, script and type inside it.
        </div>
      </div>
    )
  }

  const bytes = new Blob([html]).size
  const kb = Math.round(bytes / 1024)
  const { refs, external } = collect(html, uploaded)
  const missing = refs.filter((r) => r.kind === 'missing')
  const insecure = refs.filter((r) => r.kind === 'insecure')
  const hasTitle = /<title[^>]*>[^<]*\S[^<]*<\/title>/i.test(html)
  const tooBig = bytes > 1_800_000

  const problems = missing.length + insecure.length + (tooBig ? 1 : 0)

  const list = (items: Ref[]) => (
    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
      {items.slice(0, 5).map((r) => (
        <li key={r.url} style={{ wordBreak: 'break-all' }}>
          <code>{r.url}</code>
        </li>
      ))}
      {items.length > 5 && <li>and {items.length - 5} more</li>}
    </ul>
  )

  return (
    <div style={panel}>
      <strong style={{ ...heading, color: problems ? T.bad : T.good }}>
        {problems ? 'Check this before you send it' : 'Ready to send'}
      </strong>

      {missing.length > 0 && (
        <div style={{ marginTop: 8, color: T.bad }}>
          {missing.length} {missing.length === 1 ? 'reference points' : 'references point'} at a
          file that is not in this pitch, and will 404 for the prospect. Drop the folder again with
          the file in it, or inline it, or use a full https address.
          {list(missing)}
        </div>
      )}

      {insecure.length > 0 && (
        <div style={{ marginTop: 8, color: T.bad }}>
          {insecure.length} loaded over plain http, which the browser refuses on an https page
          without saying so. Change it to https.
          {list(insecure)}
        </div>
      )}

      {tooBig && (
        <div style={{ marginTop: 8, color: T.bad }}>
          {kb}KB is close to the 2MB ceiling, and a page this heavy is slow on a phone. It is
          nearly always one photograph pasted in as a data: URI.
        </div>
      )}

      {!hasTitle && (
        <div style={{ marginTop: 8, color: T.muted }}>
          No <code>&lt;title&gt;</code>, so the browser tab shows the address instead of the
          client's name. Worth adding before you send it.
        </div>
      )}

      <div style={{ marginTop: 8, color: T.muted }}>
        {kb}KB of markup
        {uploaded.size > 0 ? `, ${uploaded.size} file${uploaded.size === 1 ? '' : 's'} in the folder` : ', self-contained'}
        {external > 0 ? `, ${external} loaded from elsewhere` : ''}.
      </div>
    </div>
  )
}
