import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const state = vi.hoisted(() => ({
  readBusiness: false,
  visibleCollections: ['clients', 'invoices', 'blogPosts'],
  visibleGlobals: ['homepage', 'ops-settings'],
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }))
vi.mock('../../src/components/SettingsLocale', () => ({ SettingsLocale: () => null }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({
    user: { role: 'editor', name: 'Content editor' },
    permissions: {
      collections: {
        clients: { read: state.readBusiness },
        invoices: { read: state.readBusiness },
        blogPosts: { read: true },
      },
      globals: { homepage: { read: true }, 'ops-settings': { read: state.readBusiness } },
    },
  }),
  useConfig: () => ({
    config: {
      routes: { admin: '/admin' },
      folders: false,
      collections: [
        { slug: 'clients', labels: { plural: 'Clients' } },
        { slug: 'invoices', labels: { plural: 'Invoices' } },
        { slug: 'blogPosts', labels: { plural: 'Blog posts' } },
      ],
      globals: [
        { slug: 'homepage', label: 'Homepage' },
        { slug: 'ops-settings', label: 'Operations settings' },
      ],
    },
  }),
  useEntityVisibility: () => ({
    visibleEntities: {
      collections: state.visibleCollections,
      globals: state.visibleGlobals,
    },
  }),
  useNav: () => ({ hydrated: true, navOpen: true, setNavOpen: vi.fn() }),
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
  Link: ({ children, prefetch: _prefetch, ...props }: any) => React.createElement('a', props, children),
  NavToggler: ({ children, ...props }: any) => React.createElement('button', props, children),
  BrowseByFolderButton: () => null,
  Logout: () => null,
}))

import { WorkspaceNav } from '../../src/components/WorkspaceNav'
afterEach(cleanup)

describe('Workspace navigation permissions', () => {
  it('excludes unreadable collections and globals even when entity visibility includes them', () => {
    state.readBusiness = false
    state.visibleCollections = ['clients', 'invoices', 'blogPosts']
    state.visibleGlobals = ['homepage', 'ops-settings']
    const { container } = render(React.createElement(WorkspaceNav))
    expect(screen.getByRole('link', { name: 'Blog posts' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Homepage' })).toBeTruthy()
    expect(container.querySelector('#nav-clients')).toBeNull()
    expect(container.querySelector('#nav-invoices')).toBeNull()
    expect(container.querySelector('#nav-ops-settings')).toBeNull()
  })

  it('also excludes hidden entities even when read permission is granted', () => {
    state.readBusiness = true
    state.visibleCollections = ['blogPosts']
    state.visibleGlobals = ['homepage']
    const { container } = render(React.createElement(WorkspaceNav))
    expect(screen.getByRole('link', { name: 'Blog posts' })).toBeTruthy()
    expect(container.querySelector('#nav-clients')).toBeNull()
    expect(container.querySelector('#nav-invoices')).toBeNull()
    expect(container.querySelector('#nav-ops-settings')).toBeNull()
  })
})
