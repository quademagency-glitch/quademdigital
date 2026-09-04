'use client'

import { useDocumentInfo } from '@payloadcms/ui'

/**
 * Has the prospect opened it?
 *
 * The one thing you want to know between sending a pitch and hearing back, and
 * the CMS had no way to answer it. Counted by a beacon in the page itself
 * (src/pages/pitch/[...slug].ts on the site), so it counts people rather than
 * crawlers, once per browser session rather than once per refresh, and never
 * when the page is opened from the "Open it" button here.
 *
 * It is a signal, not a certainty. A forwarded link is somebody else opening
 * it, a phone with JavaScript off is a read that never gets counted, and two
 * views is not two people.
 */

const ago = (iso?: string | null) => {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.round((Date.now() - then) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `on ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

export const PitchViews = () => {
  const { id, savedDocumentData } = useDocumentInfo() as any

  if (!id) return null

  const count: number = savedDocumentData?.viewCount || 0
  const last = savedDocumentData?.lastViewedAt
  const first = savedDocumentData?.firstViewedAt

  const box: React.CSSProperties = { fontSize: 13, lineHeight: 1.6, margin: 0 }

  if (!count) {
    return (
      <p style={{ ...box, opacity: 0.75 }}>
        Not opened yet. This updates when somebody loads the page, so give it a
        moment after you send the link.
      </p>
    )
  }

  return (
    <div>
      <p style={{ ...box, fontWeight: 600 }}>
        Opened {count} {count === 1 ? 'time' : 'times'}
      </p>
      <p style={{ ...box, opacity: 0.75 }}>
        Last {ago(last)}
        {first && count > 1 ? `, first ${ago(first)}` : ''}.
      </p>
    </div>
  )
}
