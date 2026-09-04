'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

/**
 * The link, and the one button this screen is really for.
 *
 * A pitch exists to be sent. Reading a URL out of a read-only text field and
 * retyping it into an email is where a slug gets a character wrong and the
 * prospect gets a 404 with your name on it, so the address is never typed
 * here: it is copied, or opened, or nothing.
 *
 * The status line answers the question a stale tab cannot: whether the link
 * being copied actually works right now. A pitch that is switched off or past
 * its expiry date serves a 404, and copying that into an email is worse than
 * copying nothing.
 */

/*
  Written out rather than read from configuration. This is a browser component,
  so the only environment it could read is the one shipped to the browser, and
  ASTRO_SITE_URL, the variable that would otherwise be the source, is set to
  http://localhost:4321 on Railway. A link that is going into an email cannot be
  wrong, and the site has exactly one address.
*/
const SITE = 'https://quademdigital.com'

const dayEnd = (value?: string | null) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(23, 59, 59, 999)
  return d
}

const asDate = (value: Date) =>
  value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Clipboard, with the old way behind it for a browser that refuses the new one. */
const copyText = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export const PitchLinkPanel = () => {
  const { id, savedDocumentData } = useDocumentInfo() as any
  const [copied, setCopied] = useState<'link' | 'email' | null>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const slug: string = savedDocumentData?.slug || ''

  if (!id || !slug) {
    return (
      <p style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.75, margin: 0 }}>
        Drop the file in, give it a name, and save. The link to send appears here.
      </p>
    )
  }

  const url = `${SITE}/pitch/${slug}/`
  const expiry = dayEnd(savedDocumentData?.expiresAt)
  const expired = Boolean(expiry && expiry.getTime() < Date.now())
  const off = savedDocumentData?.live === false

  const status = off
    ? { tone: '#dc2626', text: 'Switched off. This link returns a 404 until Live is ticked.' }
    : expired
      ? { tone: '#dc2626', text: `Expired on ${asDate(expiry as Date)}. This link returns a 404.` }
      : expiry
        ? { tone: '#16a34a', text: `Live until ${asDate(expiry as Date)}.` }
        : { tone: '#16a34a', text: 'Live. Anyone with this link can open it.' }

  const button: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    lineHeight: 1.2,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <code
        style={{
          display: 'block',
          fontSize: 12,
          lineHeight: 1.5,
          wordBreak: 'break-all',
          padding: '8px 10px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-150)',
          background: 'var(--theme-elevation-50)',
        }}
      >
        {url}
      </code>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={async () => setCopied((await copyText(url)) ? 'link' : null)}
          style={{ ...button, background: '#00AEEF', color: '#050814' }}
        >
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
        {/*
          preview=1 so opening it from here is not counted as the prospect
          opening it. Without that, checking your own work six times reads in
          the admin as six people looking at the pitch.
        */}
        <a
          href={`${url}?preview=1`}
          target="_blank"
          rel="noreferrer"
          style={{ ...button, background: 'var(--theme-elevation-100)', color: 'inherit', textDecoration: 'none' }}
        >
          Open it
        </a>
      </div>

      <button
        type="button"
        onClick={async () =>
          setCopied(
            (await copyText(
              `Here is the sample site I put together:\n\n${url}\n\nIt is a working page, not a picture, so open it on your phone as well.`,
            ))
              ? 'email'
              : null,
          )
        }
        style={{
          padding: 0,
          border: 'none',
          background: 'none',
          color: 'inherit',
          textDecoration: 'underline',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 12,
          opacity: 0.75,
        }}
      >
        {copied === 'email' ? 'Copied, paste it into the email' : 'Copy a sentence to send with it'}
      </button>

      <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: status.tone }}>{status.text}</p>
    </div>
  )
}
