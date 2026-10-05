import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const state = vi.hoisted(() => ({
  modified: false,
  doc: {} as Record<string, any>,
  id: 1 as number | undefined,
}))
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({ id: state.id, savedDocumentData: state.doc }),
  useFormModified: () => state.modified,
}))
import { SigningPanel } from '../../src/components/SigningPanel'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const draft = () => {
  state.id = 1
  state.modified = false
  state.doc = {
    status: 'draft',
    filename: 'sample.pdf',
    signInOrder: true,
    signers: [{ id: 'a', name: 'Ama', email: 'ama@example.com' }],
    parties: [{ partyId: 'client', context: 'Client', signerId: 'a' }],
    places: [{ party: 'client', page: 1, kind: 'signature' }],
  }
}
describe('Signing review interactions', () => {
  it('blocks sending and reassignment while the form has unsaved changes', () => {
    draft()
    state.modified = true
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(React.createElement(SigningPanel))
    expect(
      (screen.getByRole('button', { name: 'Send to 1 person' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('retains partial email failures when the request becomes out for signing', async () => {
    draft()
    const fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith('/send')
          ? { failed: ['ama@example.com'] }
          : {
              status: 'out',
              signers: [{ name: 'Ama', email: 'ama@example.com', status: 'sent' }],
            },
    }))
    vi.stubGlobal('fetch', fetch)
    render(React.createElement(SigningPanel))
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1 person' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('email failed for ama@example.com'),
    )
    expect(screen.getByRole('heading', { name: /Out for signing/ })).toBeTruthy()
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/send'))).toHaveLength(1)
  })
  it('treats a dropped connection as an uncertain action and never retries it automatically', async () => {
    draft()
    const fetch = vi.fn().mockRejectedValue(new Error('Network down'))
    vi.stubGlobal('fetch', fetch)
    render(React.createElement(SigningPanel))
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1 person' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('may already have completed'),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not expose a send action until the document exists', () => {
    draft()
    state.id = undefined
    render(React.createElement(SigningPanel))
    expect(screen.queryByRole('button', { name: /Send to/ })).toBeNull()
    expect(screen.getByText('Saving alone does not send anything.')).toBeTruthy()
  })
})

describe('Current document-editor ownership', () => {
  it('recognises signature places assigned directly to a signer', () => {
    draft()
    state.doc.parties = []
    state.doc.places = [{ party: 'signer:a', page: 1, kind: 'signature' }]
    render(React.createElement(SigningPanel))
    expect(screen.getByText('1 of 1 people have signature places')).toBeTruthy()
    expect(screen.queryByText(/will sign on the page added at/)).toBeNull()
    expect(screen.queryByText('A signing page will be added at the end')).toBeNull()
  })
})
