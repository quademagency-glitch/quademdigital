'use client'

import { useFormFields } from '@payloadcms/ui'

/**
 * What this page will do when it is not on your laptop.
 *
 * A pitch is written somewhere else and arrives finished, and the two ways it
 * breaks after it is sent are both invisible while you are looking at the
 * markup:
 *
 *  1. It refers to a file that was never uploaded. There is nowhere here to put
 *     a second file, so `<link href="styles.css">` is a 404 and the prospect
 *     gets an unstyled page. This is the mistake the format invites, so it is
 *     the first thing checked.
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

const collect = (html: string): { refs: Ref[]; external: number } => {
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
  const html = useFormFields(([fields]) => (fields?.html?.value as string) || '')

  const box: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 4,
    padding: '12px 14px',
    marginBottom: 24,
    fontSize: 13,
    lineHeight: 1.6,
  }

  if (!html) {
    return (
      <div style={{ ...box, opacity: 0.8 }}>
        <strong>Nothing to serve yet</strong>
        <div>
          Drop the exported <code>index.html</code> into the box above and save. One
          file, with its styles, script and type inside it.
        </div>
      </div>
    )
  }

  const bytes = new Blob([html]).size
  const kb = Math.round(bytes / 1024)
  const { refs, external } = collect(html)
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
    <div style={box}>
      <strong>{problems ? 'Check this before you send it' : 'Ready to send'}</strong>

      {missing.length > 0 && (
        <div style={{ marginTop: 8, color: '#dc2626' }}>
          {missing.length} {missing.length === 1 ? 'reference points' : 'references point'} at a
          file that is not part of this pitch, and will 404 for the prospect. Inline it, or put the
          file in the media library and use its full https address.
          {list(missing)}
        </div>
      )}

      {insecure.length > 0 && (
        <div style={{ marginTop: 8, color: '#dc2626' }}>
          {insecure.length} loaded over plain http, which the browser refuses on an https page
          without saying so. Change it to https.
          {list(insecure)}
        </div>
      )}

      {tooBig && (
        <div style={{ marginTop: 8, color: '#dc2626' }}>
          {kb}KB is close to the 2MB ceiling, and a page this heavy is slow on a phone. It is
          nearly always one photograph pasted in as a data: URI.
        </div>
      )}

      {!hasTitle && (
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          No <code>&lt;title&gt;</code>, so the browser tab shows the address instead of the
          client's name. Worth adding before you send it.
        </div>
      )}

      <div style={{ marginTop: 8, opacity: 0.7 }}>
        {kb}KB, self-contained
        {external > 0 ? `, plus ${external} ${external === 1 ? 'file' : 'files'} loaded from elsewhere` : ''}.
      </div>
    </div>
  )
}
