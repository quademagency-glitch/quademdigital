import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { Button } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { T } from './pitchTheme'

const TEAM_PORTAL_URL = process.env.TEAM_PORTAL_URL || 'https://team.quademdigital.com'

/**
 * The screen an account sees when it signs in here but may not open the admin.
 *
 * Payload's own version says "Unauthorized" and offers a log out button, which
 * is accurate and useless to a team member who typed the wrong address. Team
 * accounts work in the team portal, so this one says so and links there. The
 * website and integration accounts work by API key and have no business
 * signing in with a password, so they are told that instead.
 */
export function Unauthorized({ initPageResult }: AdminViewServerProps) {
  const {
    req: { user, payload },
  } = initPageResult
  const role = (user as { role?: string } | null)?.role
  const logOut = formatAdminURL({
    adminRoute: payload.config.routes.admin,
    path: payload.config.admin.routes.logout,
  })

  const team = role === 'team'
  const system = role === 'site' || role === 'integration'

  const heading = team
    ? 'Your work is in the team portal'
    : system
      ? 'This account cannot open the CMS'
      : 'You cannot open this page'
  const body = team
    ? 'Team accounts sign in at team.quademdigital.com with the same email and password. Your leads, daily report and money are all there.'
    : system
      ? 'It is a system account that works through its API key. Log out, then sign in with your own account.'
      : 'Your account does not have access to it. Log out and sign in with an account that does.'

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 460 }}>
      <h1 style={{ margin: 0, color: T.text, textWrap: 'balance' }}>{heading}</h1>
      <p style={{ margin: 0, color: T.muted, lineHeight: 1.5 }}>{body}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {team && (
          <Button el="anchor" url={TEAM_PORTAL_URL} size="large" buttonStyle="primary">
            Open the team portal
          </Button>
        )}
        <Button el="link" to={logOut} size="large" buttonStyle={team ? 'secondary' : 'primary'}>
          Log out
        </Button>
      </div>
    </div>
  )
}
