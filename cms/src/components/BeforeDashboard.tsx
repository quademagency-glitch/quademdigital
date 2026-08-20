import React from 'react'
import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'
import config from '@payload-config'

const motivations = [
  'Every client win today started as a follow-up you almost put off.',
  "Small, consistent moves compound. Today's update is tomorrow's case study.",
  'The agencies that win are the ones that show up before the deadline, not after.',
  'Your next big client is one good follow-up away.',
  "Ship the thing. It doesn't have to be perfect to move the business forward.",
  'Good work, done consistently, beats perfect work done rarely.',
  "Someone on this list is waiting to hear back from you. Make today the day.",
]

function getMotivation(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
  return motivations[dayOfYear % motivations.length]
}

const statCards: { label: string; collection: 'leads' | 'clients' | 'blogPosts' | 'caseStudies'; icon: string; color: string }[] = [
  { label: 'Leads', collection: 'leads', icon: '📥', color: 'rgba(0, 174, 239, 0.12)' },
  { label: 'Clients', collection: 'clients', icon: '👥', color: 'rgba(16, 185, 129, 0.12)' },
  { label: 'Blog Posts', collection: 'blogPosts', icon: '📝', color: 'rgba(139, 92, 246, 0.12)' },
  { label: 'Case Studies', collection: 'caseStudies', icon: '🏆', color: 'rgba(245, 158, 11, 0.12)' },
]

const quickActions: { label: string; href: string; icon: string }[] = [
  { label: 'New Blog Post', href: '/admin/collections/blogPosts/create', icon: '✏️' },
  { label: 'View Leads', href: '/admin/collections/leads', icon: '📋' },
  { label: 'Manage Invoices', href: '/admin/collections/invoices', icon: '🧾' },
  { label: 'Site Settings', href: '/admin/globals/siteSettings', icon: '⚙️' },
]

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: 'rgba(0, 174, 239, 0.12)', text: '#5cc8f0' },
  contacted: { bg: 'rgba(139, 92, 246, 0.12)', text: '#a78bfa' },
  qualified: { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399' },
  won: { bg: 'rgba(16, 185, 129, 0.18)', text: '#6ee7b7' },
  lost: { bg: 'rgba(239, 68, 68, 0.12)', text: '#f87171' },
  archived: { bg: 'rgba(107, 114, 128, 0.12)', text: '#9ca3af' },
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const BeforeDashboard: React.FC = async () => {
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: await nextHeaders() })
  const displayName = (user as { name?: string; email?: string } | null)?.name
    || (user as { email?: string } | null)?.email?.split('@')[0]

  const counts = await Promise.all(
    statCards.map((card) =>
      payload
        .count({ collection: card.collection })
        .then((res) => res.totalDocs)
        .catch(() => null),
    ),
  )

  const recentLeads = await payload
    .find({ collection: 'leads', limit: 5, sort: '-createdAt' })
    .then((res) => res.docs)
    .catch(() => [])

  const greeting = getGreeting()
  const motivation = getMotivation()

  return (
    <div className="qd-dashboard">
      {/* Welcome Banner */}
      <div className="qd-welcome">
        <div className="qd-welcome__inner">
          <div>
            <h2 className="qd-welcome__title">{greeting}{displayName ? `, ${displayName}` : ''} 👋</h2>
            <p className="qd-welcome__subtitle">{motivation}</p>
          </div>
          <div className="qd-welcome__date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="qd-stats-grid">
        {statCards.map((card, i) => (
          <a
            key={card.collection}
            href={`/admin/collections/${card.collection}`}
            className="qd-stat-card"
            style={{ textDecoration: 'none' }}
          >
            <div className="qd-stat-card__icon" style={{ background: card.color }}>
              <span style={{ fontSize: '1.25rem' }}>{card.icon}</span>
            </div>
            <div className="qd-stat-card__body">
              <div className="qd-stat-card__label">{card.label}</div>
              <div className="qd-stat-card__value">{counts[i] ?? '-'}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Two-column layout: Recent Leads + Quick Actions */}
      <div className="qd-dashboard-row">
        {/* Recent Leads */}
        <div className="qd-panel qd-panel--leads">
          <div className="qd-panel__header">
            <h3 className="qd-panel__title">Recent Leads</h3>
            <a href="/admin/collections/leads" className="qd-panel__link">View All →</a>
          </div>
          {recentLeads.length > 0 ? (
            <div className="qd-leads-list">
              {recentLeads.map((lead: any) => {
                const status = lead.status || 'new'
                const colors = statusColors[status] || statusColors.new
                return (
                  <a
                    key={lead.id}
                    href={`/admin/collections/leads/${lead.id}`}
                    className="qd-lead-item"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="qd-lead-item__info">
                      <span className="qd-lead-item__name">
                        {lead.name || lead.email || `Lead #${lead.id}`}
                      </span>
                      {lead.source && (
                        <span className="qd-lead-item__source">{lead.source}</span>
                      )}
                    </div>
                    <div className="qd-lead-item__meta">
                      <span
                        className="qd-lead-item__status"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {status}
                      </span>
                      <span className="qd-lead-item__date">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          ) : (
            <div className="qd-panel__empty">No leads yet. They&apos;ll appear here.</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="qd-panel qd-panel--actions">
          <div className="qd-panel__header">
            <h3 className="qd-panel__title">Quick Actions</h3>
          </div>
          <div className="qd-actions-grid">
            {quickActions.map((action) => (
              <a key={action.href} href={action.href} className="qd-action-btn">
                <span className="qd-action-btn__icon">{action.icon}</span>
                <span className="qd-action-btn__label">{action.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
