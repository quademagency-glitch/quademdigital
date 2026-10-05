import React from 'react'
import { getPayload, type CollectionSlug } from 'payload'
import { headers as nextHeaders } from 'next/headers'
import { Gutter } from '@payloadcms/ui'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Plus,
  ReceiptText,
} from 'lucide-react'
import config from '@payload-config'
import { hasRole } from '../access/roles'
import {
  activeRetainerWhere,
  dayBounds,
  findAll,
  formatMoney,
  invoiceSetURL,
  invoiceSummary,
  listURL,
  retainerSummary,
  type DueContact,
  type InvoiceSummary,
  type Money,
} from '../lib/dashboard'
import { DashboardRefresh } from './DashboardRefresh'

type Contact = {
  id: number | string
  name?: string
  clientName?: string
  email?: string
  source?: string
  status?: string
  createdAt?: string
  nextFollowUp?: string
}
type Retainer = { currency?: string; country?: string; total?: number }
const sourceLabel = (v: string) => v.replace(/[-_]/g, ' ')
const ErrorState = ({ what }: { what: string }) => (
  <div className="qd-empty qd-empty--error" role="alert">
    <strong>Could not load {what}.</strong>
    <span>Refresh to try again. No totals are shown for unavailable data.</span>
    <DashboardRefresh label="Try again" />
  </div>
)
const MoneyRows = ({ totals }: { totals: Money }) => (
  <div className="qd-money-rows">
    {Object.keys(totals).length ? (
      Object.entries(totals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, amount]) => (
          <strong key={currency}>{formatMoney(currency, amount)}</strong>
        ))
    ) : (
      <span className="qd-muted">No amounts recorded</span>
    )}
  </div>
)

export const BeforeDashboard = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user || !hasRole(user, 'admin', 'site', 'editor')) return null
  const business = hasRole(user, 'admin', 'site')
  const now = new Date()
  const { start, end } = dayBounds(now)
  const followWhere = { nextFollowUp: { less_than_equal: end.toISOString() } }
  const retainerWhere = activeRetainerWhere(now)
  const attempt = async <T,>(name: string, read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read()
    } catch (error) {
      payload.logger.error({ err: error }, `Dashboard: ${name} unavailable`)
      return null
    }
  }
  const readAll = <T,>(collection: CollectionSlug, where?: Parameters<typeof findAll>[3]) =>
    findAll<T>(payload, user, collection, where)
  const cards = business
    ? [
        { slug: 'leads', label: 'Leads' },
        { slug: 'clients', label: 'Clients' },
        { slug: 'blogPosts', label: 'Blog posts' },
        { slug: 'caseStudies', label: 'Case studies' },
      ]
    : [
        { slug: 'blogPosts', label: 'Blog posts' },
        { slug: 'pages', label: 'Pages' },
        { slug: 'caseStudies', label: 'Case studies' },
        { slug: 'media', label: 'Media files' },
      ]
  const [invoices, retainers, dueLeads, dueClients, recent, counts] = await Promise.all([
    business ? attempt('invoices', () => readAll<InvoiceSummary>('invoices')) : null,
    business ? attempt('retainers', () => readAll<Retainer>('proposals', retainerWhere)) : null,
    business ? attempt('lead follow-ups', () => readAll<Contact>('leads', followWhere)) : null,
    business ? attempt('client follow-ups', () => readAll<Contact>('clients', followWhere)) : null,
    business
      ? attempt(
          'recent leads',
          async () =>
            (
              await payload.find({
                collection: 'leads',
                limit: 5,
                depth: 0,
                sort: '-createdAt',
                user,
                overrideAccess: false,
              })
            ).docs as Contact[],
        )
      : null,
    Promise.all(
      cards.map((card) =>
        attempt(
          card.label,
          async () =>
            (
              await payload.count({
                collection: card.slug as CollectionSlug,
                user,
                overrideAccess: false,
              })
            ).totalDocs,
        ),
      ),
    ),
  ])
  const money = invoices ? invoiceSummary(invoices, now) : null
  const followUps: DueContact[] = []
  for (const [collection, rows] of [
    ['leads', dueLeads],
    ['clients', dueClients],
  ] as const) {
    for (const row of rows || []) {
      if (!row.nextFollowUp || !Number.isFinite(Date.parse(row.nextFollowUp))) continue
      followUps.push({
        id: `${collection}-${row.id}`,
        href: `/admin/collections/${collection}/${row.id}`,
        who:
          (collection === 'leads' ? row.name : row.clientName) || row.email || `Record ${row.id}`,
        kind: collection === 'leads' ? 'Lead' : 'Client',
        days: Math.round(
          (start.getTime() - dayBounds(new Date(row.nextFollowUp)).start.getTime()) / 86400000,
        ),
      })
    }
  }
  followUps.sort((a, b) => b.days - a.days)
  const followError = dueLeads === null || dueClients === null
  const moneyCards = [
    {
      label: 'Collected',
      period: 'All time',
      totals: money?.collected,
      href: money ? invoiceSetURL(money.collectedIds) : '',
      link: 'View payments received',
    },
    {
      label: 'Awaiting payment',
      period: 'Outstanding balance',
      totals: money?.awaiting,
      href: money ? invoiceSetURL(money.awaitingIds) : '',
      link: 'View unpaid invoices',
    },
    {
      label: 'Overdue',
      period: 'Before today',
      totals: money?.overdue,
      href: money ? invoiceSetURL(money.due.map((d) => d.id)) : '',
      link: 'View overdue invoices',
    },
    {
      label: 'Active retainers',
      period: 'Monthly',
      totals: retainers ? retainerSummary(retainers) : null,
      href: listURL('proposals', retainerWhere),
      link: 'View active deals',
    },
  ]
  return (
    <div className="qd-dashboard">
      <div className="qd-page-heading">
        <div>
          <p className="qd-eyebrow">
            {now.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Africa/Accra',
            })}
          </p>
          <h1>{business ? 'Overview' : 'Content overview'}</h1>
          <p>
            {business
              ? 'Follow-ups, invoices and recent leads.'
              : 'Manage the pages, stories and media on your website.'}
          </p>
        </div>
        <div className="qd-actions">
          <a className="qd-button" href="/admin/collections/blogPosts/create">
            <FileText size={16} aria-hidden="true" />
            New blog post
          </a>
          <a
            className="qd-button qd-button--primary"
            href={business ? '/admin/collections/leads/create' : '/admin/collections/pages/create'}
          >
            <Plus size={17} aria-hidden="true" />
            {business ? 'New lead' : 'New page'}
          </a>
        </div>
      </div>
      <div className="qd-overview-tools">
        <DashboardRefresh />
        <a href="https://quademdigital.com" target="_blank" rel="noreferrer">
          Open website <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
      {business && (
        <>
          <div className="qd-attention-grid">
            <section className="qd-panel">
              <div className="qd-panel__header">
                <h2>
                  <CalendarClock size={18} aria-hidden="true" />
                  Follow-ups due
                </h2>
                {!followError && <span className="qd-count">{followUps.length}</span>}
              </div>
              {followError && (
                <ErrorState
                  what={
                    dueLeads === null && dueClients === null
                      ? 'follow-ups'
                      : dueLeads === null
                        ? 'lead follow-ups'
                        : 'client follow-ups'
                  }
                />
              )}
              {followUps.length > 0 ? (
                <ul className="qd-work-list">
                  {followUps.slice(0, 6).map((row) => (
                    <li key={row.id}>
                      <a href={row.href}>
                        <span>
                          <strong>{row.who}</strong>
                          <small>{row.kind}</small>
                        </span>
                        <span
                          className={`qd-badge ${row.days > 0 ? 'qd-badge--danger' : 'qd-badge--info'}`}
                        >
                          {row.days <= 0
                            ? 'Today'
                            : `${row.days} ${row.days === 1 ? 'day' : 'days'} overdue`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                !followError && (
                  <div className="qd-empty">
                    <CheckCircle2 size={22} aria-hidden="true" />
                    <strong>No follow-ups due.</strong>
                    <span>Upcoming dates will appear here when they are due.</span>
                  </div>
                )
              )}
              <div className="qd-panel__footer">
                {dueLeads !== null && (
                  <a href={listURL('leads', followWhere)}>
                    All due leads ({dueLeads.length}) <ArrowRight size={14} aria-hidden="true" />
                  </a>
                )}
                {dueClients !== null && (
                  <a href={listURL('clients', followWhere)}>
                    All due clients ({dueClients.length}){' '}
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            </section>
            <section className="qd-panel">
              <div className="qd-panel__header">
                <h2>
                  <ReceiptText size={18} aria-hidden="true" />
                  Overdue invoices
                </h2>
                {money && <span className="qd-count">{money.due.length}</span>}
              </div>
              {!money ? (
                <ErrorState what="overdue invoices" />
              ) : money.due.length ? (
                <ul className="qd-work-list">
                  {money.due.slice(0, 5).map((inv) => (
                    <li key={inv.id}>
                      <a href={`/admin/collections/invoices/${inv.id}`}>
                        <span>
                          <strong>{inv.ref}</strong>
                          <small>{formatMoney(inv.currency, inv.owed)} outstanding</small>
                        </span>
                        <span className="qd-badge qd-badge--danger">
                          {inv.daysLate} {inv.daysLate === 1 ? 'day' : 'days'} overdue
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="qd-empty">
                  <CheckCircle2 size={22} aria-hidden="true" />
                  <strong>No overdue invoices.</strong>
                  <span>Unpaid invoices appear here after their due date.</span>
                </div>
              )}
              {money && (
                <div className="qd-panel__footer">
                  <a href={invoiceSetURL(money.due.map((d) => d.id))}>
                    All overdue invoices ({money.due.length}){' '}
                    <ArrowRight size={14} aria-hidden="true" />
                  </a>
                </div>
              )}
            </section>
          </div>
          <section className="qd-money-section">
            <div className="qd-section-heading">
              <h2>Money overview</h2>
              <p>Currencies shown separately</p>
            </div>
            <div className="qd-money-grid">
              {moneyCards.map((card) => (
                <article className="qd-panel qd-money-card" key={card.label}>
                  <h3>{card.label}</h3>
                  <p>{card.period}</p>
                  {card.totals ? (
                    <>
                      <MoneyRows totals={card.totals} />
                      <a href={card.href}>
                        {card.link} <ArrowRight size={14} aria-hidden="true" />
                      </a>
                    </>
                  ) : (
                    <div className="qd-inline-error" role="alert">
                      Could not load totals. <DashboardRefresh label="Try again" />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className="qd-panel">
            <div className="qd-panel__header">
              <h2>Recent leads</h2>
              <a href="/admin/collections/leads">
                View all leads <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
            {recent === null ? (
              <ErrorState what="recent leads" />
            ) : recent.length ? (
              <div className="qd-table-scroll">
                <table className="qd-recent-table">
                  <thead>
                    <tr>
                      <th scope="col">Business / contact</th>
                      <th scope="col">Source</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((lead) => (
                      <tr key={lead.id}>
                        <th scope="row">
                          <a href={`/admin/collections/leads/${lead.id}`}>
                            {lead.name || lead.email || `Lead ${lead.id}`}
                          </a>
                        </th>
                        <td>{sourceLabel(lead.source || '—')}</td>
                        <td>
                          <span
                            className={`qd-badge ${['won', 'qualified'].includes(lead.status || '') ? 'qd-badge--success' : 'qd-badge--info'}`}
                          >
                            {sourceLabel(lead.status || 'new')}
                          </span>
                        </td>
                        <td>
                          {lead.createdAt
                            ? new Date(lead.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                timeZone: 'Africa/Accra',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="qd-empty">
                <strong>No leads yet.</strong>
                <a href="/admin/collections/leads/create">Add your first lead</a>
              </div>
            )}
          </section>
        </>
      )}
      <section
        className="qd-collection-summary"
        aria-label={business ? 'Record counts' : 'Website content'}
      >
        {cards.map((card, i) => (
          <a className="qd-panel" key={card.slug} href={`/admin/collections/${card.slug}`}>
            <span>{card.label}</span>
            <strong>{counts[i] ?? 'Unavailable'}</strong>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        ))}
      </section>
      {!business && (
        <section className="qd-panel qd-editor-start">
          <h2>Continue editing</h2>
          <p>Keep drafts, previews and scheduled publishing together in your content workspace.</p>
          <div className="qd-actions">
            <a className="qd-button" href="/admin/globals/homepage">
              Edit homepage
            </a>
            <a className="qd-button" href="/admin/collections/media">
              Browse media
            </a>
            <a className="qd-button" href="/admin/collections/blogPosts">
              Review blog posts
            </a>
          </div>
        </section>
      )}
    </div>
  )
}

export const DashboardView = () => (
  <Gutter className="dashboard">
    <BeforeDashboard />
  </Gutter>
)
