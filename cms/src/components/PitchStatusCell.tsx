'use client'

import { Link, useConfig } from '@payloadcms/ui'

/**
 * One column that answers "is this link working right now".
 *
 * A tickbox column says whether Live is ticked, not whether the page is up: a
 * pitch can be ticked Live and still be a 404 because its expiry has passed.
 * Two columns that have to be read together is one column too many, so they
 * are read together here.
 *
 * It renders its own link when it is the first column, and that is not
 * decoration. Payload links exactly one cell per row, the first active one,
 * and it does that by rendering DefaultCell, which a custom cell replaces
 * outright. A custom cell in that position that draws no link leaves the list
 * with no way into any document at all. The `title` column is first by default
 * so this rarely applies, but the column order is the reader's to change.
 */
export const PitchStatusCell = ({
  link,
  linkURL,
  rowData,
}: {
  link?: boolean
  linkURL?: string
  rowData?: Record<string, any>
}) => {
  const { config } = useConfig()

  const expiresAt = rowData?.expiresAt
  const end = expiresAt ? new Date(expiresAt) : null
  if (end && !Number.isNaN(end.getTime())) end.setHours(23, 59, 59, 999)

  const expired = Boolean(end && !Number.isNaN(end.getTime()) && end.getTime() < Date.now())
  const off = rowData?.live === false

  const { text, colour } = off
    ? { text: 'Switched off', colour: '#dc2626' }
    : expired
      ? { text: 'Expired', colour: '#dc2626' }
      : { text: 'Live', colour: '#16a34a' }

  const body = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }}
      />
      {text}
    </span>
  )

  if (!link || !rowData?.id) return body

  const adminRoute = config?.routes?.admin || '/admin'
  const href = linkURL || `${adminRoute}/collections/pitches/${encodeURIComponent(String(rowData.id))}`

  return (
    <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
      {body}
    </Link>
  )
}
