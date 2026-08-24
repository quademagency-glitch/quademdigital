'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

type Usage = { table: string; label: string; historyOnly: boolean }

/**
 * "Used in" on the media edit screen.
 *
 * Deleting a file used to be a guess. This answers the question before the
 * delete button is pressed, and the same lookup refuses the delete if the
 * answer is "yes, it is on a live page".
 */
export const MediaUsagePanel = () => {
  const { id } = useDocumentInfo()
  const [state, setState] = useState<{ loading: boolean; usage: Usage[] | null; error: string }>({
    loading: true,
    usage: null,
    error: '',
  })

  useEffect(() => {
    if (!id) {
      setState({ loading: false, usage: [], error: '' })
      return
    }
    let cancelled = false
    fetch(`/api/media/${id}/usage`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (!cancelled) setState({ loading: false, usage: d.usage || [], error: '' }) })
      .catch((e) => { if (!cancelled) setState({ loading: false, usage: null, error: String(e.message || e) }) })
    return () => { cancelled = true }
  }, [id])

  if (!id) return null

  const box: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 4,
    padding: '12px 14px',
    marginBottom: 24,
    fontSize: 13,
    lineHeight: 1.6,
  }

  if (state.loading) return <div style={box}>Checking where this file is used...</div>
  if (state.error) {
    return (
      <div style={box}>
        <strong>Used in</strong>
        <div>Could not check just now ({state.error}). Treat this file as in use until you know otherwise.</div>
      </div>
    )
  }

  const usage = state.usage || []
  const live = usage.filter((u) => !u.historyOnly)
  const history = usage.filter((u) => u.historyOnly)

  return (
    <div style={box}>
      <strong>Used in</strong>
      {live.length > 0 ? (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {live.map((u) => <li key={u.table}>{u.label}</li>)}
        </ul>
      ) : (
        <div style={{ margin: '6px 0 0' }}>
          Nothing on the live site points at this file, so deleting it is safe.
        </div>
      )}
      {history.length > 0 && (
        <div style={{ margin: '10px 0 0', opacity: 0.75 }}>
          Also in the saved history of {history.map((u) => u.label).join(', ')}. That does not stop
          you deleting it, but restoring one of those old versions would come back without the picture.
        </div>
      )}
    </div>
  )
}
