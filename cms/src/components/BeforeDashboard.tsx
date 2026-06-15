'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 5)  return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const formatDate = (): string =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

const quickLinks: { label: string; href: string; icon: string; description: string }[] = [
  { label: 'New Blog Post',  href: '/admin/collections/blogPosts/create',  icon: '✍️', description: 'Publish content' },
  { label: 'New Lead',       href: '/admin/collections/leads/create',       icon: '🎯', description: 'Log an inquiry'  },
  { label: 'New Invoice',    href: '/admin/collections/invoices/create',    icon: '🧾', description: 'Bill a client'   },
  { label: 'New Offer',      href: '/admin/collections/offers/create',      icon: '🚀', description: 'Create a deal'   },
]

export const BeforeDashboard: React.FC = () => {
  const { user } = useAuth()
  const displayName = (user as any)?.name || (user?.email ?? '').split('@')[0] || 'there'

  return (
    <div
      style={{
        padding: '2rem 0 1.5rem',
        marginBottom: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Greeting row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 0.25rem',
              fontSize: '0.8125rem',
              color: '#8892a4',
              letterSpacing: '0.01em',
            }}
          >
            {formatDate()}
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#e8eaf0',
              lineHeight: 1.15,
            }}
          >
            {getGreeting()},{' '}
            <span style={{ color: '#00AEEF' }}>
              {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
            </span>
            .
          </h1>
        </div>

        {/* Quadem badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.875rem',
            background: 'rgba(0, 174, 239, 0.06)',
            border: '1px solid rgba(0, 174, 239, 0.2)',
            borderRadius: '100px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00AEEF',
              boxShadow: '0 0 6px #00AEEF',
              display: 'inline-block',
              animation: 'pulseGlow 2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#00AEEF',
              letterSpacing: '0.04em',
            }}
          >
            QUADEM CMS
          </span>
        </div>
      </div>

      {/* Quick actions row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.625rem',
        }}
      >
        {quickLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.75rem 1rem',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              textDecoration: 'none',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(0, 174, 239, 0.06)'
              el.style.borderColor = 'rgba(0, 174, 239, 0.25)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.background = 'rgba(255,255,255,0.025)'
              el.style.borderColor = 'rgba(255,255,255,0.06)'
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>
              {link.icon}
            </span>
            <div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#e8eaf0',
                  lineHeight: 1.2,
                }}
              >
                {link.label}
              </div>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: '#565e72',
                  marginTop: '0.125rem',
                }}
              >
                {link.description}
              </div>
            </div>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
