import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const state = vi.hoisted(() => ({
  id: 1 as number | undefined,
  modified: false,
  doc: {} as Record<string, any>,
}))
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({ id: state.id, savedDocumentData: state.doc }),
  useFormModified: () => state.modified,
}))
import { SendCampaignButton } from '../../src/components/SendCampaignButton'
beforeEach(() => {
  state.id = 1
  state.modified = false
  state.doc = { subject: 'Saved message', segment: 'test' }
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('Campaign review', () => {
  it('blocks unsaved changes and shows the saved audience', () => {
    state.modified = true
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(React.createElement(SendCampaignButton))
    expect(
      (screen.getByRole('button', { name: 'Send a test' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText('Saved message')).toBeTruthy()
    expect(screen.getByText('Test to Ernest only')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not send from an unsaved campaign', () => {
    state.id = undefined
    render(React.createElement(SendCampaignButton))
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('keeps partial delivery visible and prevents another send from the stale screen', async () => {
    state.doc.segment = 'all'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ sent: 2, of: 3, problems: ['One failed'] }),
      })),
    )
    render(React.createElement(SendCampaignButton))
    fireEvent.click(screen.getByRole('button', { name: 'Send campaign' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Accepted 2 of 3'))
    expect(
      (screen.getByRole('button', { name: 'Send campaign' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('does not automatically retry an uncertain request', async () => {
    const fetch = vi.fn().mockRejectedValue(Error('Offline'))
    vi.stubGlobal('fetch', fetch)
    render(React.createElement(SendCampaignButton))
    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('may already have started'),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(
      (screen.getByRole('button', { name: 'Send a test' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('leaves a successful test available without calling it inbox delivery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ test: true }) })),
    )
    render(React.createElement(SendCampaignButton))
    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('accepted for delivery'),
    )
    expect(
      (screen.getByRole('button', { name: 'Send a test' }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })
})
