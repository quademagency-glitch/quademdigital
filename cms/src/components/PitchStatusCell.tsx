'use client'

/**
 * One column that answers "is this link working right now".
 *
 * The list had a tickbox column, which says whether Live is ticked and not
 * whether the page is up: a pitch can be ticked Live and still be a 404
 * because the expiry date has passed. Two columns that have to be read
 * together is one column too many, so they are read together here.
 */
export const PitchStatusCell = ({ rowData }: { rowData?: Record<string, any> }) => {
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

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }}
      />
      {text}
    </span>
  )
}
