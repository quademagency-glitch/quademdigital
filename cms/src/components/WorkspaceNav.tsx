'use client'

import React, { useState } from 'react'
import {
  BrowseByFolderButton,
  Link,
  Logout,
  NavToggler,
  useAuth,
  useConfig,
  useEntityVisibility,
  useNav,
  useTheme,
} from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Megaphone,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  sortDestinations,
  workspaceFor,
  WORKSPACES,
  type NavDestination,
} from '../lib/adminNavigation'
import { SettingsLocale } from './SettingsLocale'

const icons = {
  Sales: BriefcaseBusiness,
  Content: FileText,
  Marketing: Megaphone,
  Team: Users,
  Finance: Wallet,
  Settings,
}
const labelOf = (label: unknown, fallback: string) =>
  typeof label === 'string' ? label : (label as { en?: string })?.en || fallback

export const WorkspaceNav = () => {
  const { config } = useConfig()
  const { visibleEntities } = useEntityVisibility()
  const { user, permissions } = useAuth()
  const { theme, setTheme } = useTheme()
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav()
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [opened, setOpened] = useState<Record<string, boolean>>({
    [user?.role === 'editor' ? 'Content' : 'Sales']: true,
  })
  const admin = config.routes.admin
  const items = sortDestinations([
    ...config.collections
      .filter(
        (c) =>
          permissions?.collections?.[c.slug]?.read && visibleEntities.collections.includes(c.slug),
      )
      .map((c) => ({
        slug: c.slug,
        label: c.slug === 'proposals' ? 'Proposals & deals' : labelOf(c.labels.plural, c.slug),
        href: `${admin}/collections/${c.slug}`,
        group: workspaceFor(c.slug),
      })),
    ...config.globals
      .filter(
        (g) => permissions?.globals?.[g.slug]?.read && visibleEntities.globals.includes(g.slug),
      )
      .map((g) => ({
        slug: g.slug,
        label: labelOf(g.label, g.slug),
        href: `${admin}/globals/${g.slug}`,
        group: workspaceFor(g.slug),
      })),
  ] as NavDestination[])
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const closeOnMobile = () => {
    if (window.matchMedia('(max-width: 768px)').matches) setNavOpen(false)
  }
  const name = user?.name || user?.email?.split('@')[0] || 'Account'
  const groups = WORKSPACES.map((group) => ({
    group,
    items: items.filter(
      (item) =>
        item.group === group &&
        `${item.label} ${group}`.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  })).filter((g) => g.items.length)

  return (
    <aside
      className={[
        'nav',
        'qd-workspace-nav',
        navOpen && 'nav--nav-open',
        hydrated && 'nav--nav-hydrated',
        shouldAnimate && 'nav--nav-animate',
      ]
        .filter(Boolean)
        .join(' ')}
      inert={!navOpen ? true : undefined}
    >
      <div className="nav__scroll" ref={navRef}>
        <div className="qd-nav-brand">
          <img src="/logo-icon.png" alt="" width="30" height="30" />
          <div>
            <strong>Quadem Digital</strong>
            <span>CMS ADMIN</span>
          </div>
          <NavToggler className="qd-nav-close">
            <X size={19} aria-hidden="true" />
            <span className="qd-sr-only">Close navigation</span>
          </NavToggler>
        </div>
        <nav className="nav__wrap" aria-label="Main navigation">
          <div className="qd-nav-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Find a section"
              placeholder="Find a section…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link
            className="qd-nav-overview"
            href={admin}
            aria-current={pathname === admin ? 'page' : undefined}
            onClick={closeOnMobile}
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            Overview
          </Link>
          <div className="qd-nav-groups">
            {groups.map(({ group, items: links }) => {
              const Icon = icons[group]
              const isOpen =
                Boolean(search.trim()) || (opened[group] ?? links.some((item) => active(item.href)))
              return (
                <div className="qd-nav-group" key={group}>
                  <button
                    type="button"
                    className="qd-nav-group__toggle"
                    aria-expanded={isOpen}
                    aria-controls={`workspace-${group}`}
                    onClick={() => setOpened((prev) => ({ ...prev, [group]: !isOpen }))}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {group}
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                  <div id={`workspace-${group}`} hidden={!isOpen} className="qd-nav-group__links">
                    {links.map((item) => (
                      <Link
                        id={`nav-${item.slug}`}
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        className="nav__link"
                        aria-current={active(item.href) ? 'page' : undefined}
                        onClick={closeOnMobile}
                      >
                        {item.label}
                      </Link>
                    ))}
                    {group === 'Content' && config.folders && config.folders.browseByFolder && (
                      <BrowseByFolderButton
                        active={pathname.startsWith(
                          `${admin}${config.admin.routes.browseByFolder}`,
                        )}
                      />
                    )}
                  </div>
                </div>
              )
            })}
            {groups.length === 0 && (
              <p className="qd-nav-empty" role="status">
                No sections match “{search}”.
              </p>
            )}
          </div>
          <div className="qd-nav-footer">
            <a href="https://team.quademdigital.com" target="_blank" rel="noreferrer">
              Open team portal <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <div className="qd-theme-switch" aria-label="Colour theme">
              <button
                type="button"
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                <Sun size={15} aria-hidden="true" />
                Light
              </button>
              <button
                type="button"
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                <Moon size={15} aria-hidden="true" />
                Dark
              </button>
            </div>
            <Link className="qd-nav-account" href={`${admin}/account`} onClick={closeOnMobile}>
              <span className="qd-nav-avatar">{String(name).slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{name}</strong>
                <small>
                  {user?.role === 'admin'
                    ? 'Administrator'
                    : user?.role === 'editor'
                      ? 'Content editor'
                      : 'Account'}
                </small>
              </span>
            </Link>
            <div className="qd-nav-utilities">
              <SettingsLocale />
              <Logout />
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}
