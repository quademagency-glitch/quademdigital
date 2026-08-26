'use client'

import { useRowLabel } from '@payloadcms/ui'

/**
 * The one-line summary on a collapsed contact history entry.
 *
 * Without it every row reads "Entry 01", "Entry 02", which makes a collapsed
 * list useless and forces you to open all of them to find the one you want.
 */

const HOW: Record<string, string> = {
  whatsapp: 'WhatsApp',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
}

export const ActivityRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ at?: string; kind?: string; note?: string }>()

  if (!data?.at && !data?.note) return <span>Entry {String((rowNumber ?? 0) + 1).padStart(2, '0')}</span>

  const when = data?.at
    ? new Date(data.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  const how = HOW[data?.kind || ''] || ''
  const first = (data?.note || '').trim().split('\n')[0]
  const gist = first.length > 70 ? `${first.slice(0, 70)}...` : first

  return <span>{[when, how, gist].filter(Boolean).join(' - ')}</span>
}
