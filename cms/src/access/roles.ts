import type { Access, FieldAccess } from 'payload'

/**
 * Who each account is, and the one place that says what each can reach.
 *
 * admin        Ernest. Everything.
 * editor       Content help. The website's words and pictures: pages, posts,
 *              media, services, prices on the page. No proposals, team records
 *              or money, and no clients, leads, invoices, pitches or mailing
 *              list once the website's account has moved to `site` (WEBSITE
 *              below). Until October 2026 an editor could reach all of it,
 *              because most collections only asked "is anyone signed in?".
 * site         The website's own account, automation@quademdigital.com, by API
 *              key. Exactly what the website does: reads content and the bank
 *              details; reads and writes clients, invoices, leads, onboarding
 *              documents, subscribers, email campaigns and their events; serves
 *              pitch sites and records their views. It can also edit content,
 *              because the maintenance scripts in cms/scripts write with the
 *              same key. It never reaches the team and money collections.
 * team         Team members, Charles first. They use the team portal at
 *              team.quademdigital.com and are refused at /admin. What they can
 *              reach is added collection by collection as the portal is built.
 * integration  A system account with an API key for the WhatsApp and daily
 *              briefing imports. It can only create leads.
 *
 * Payload's default for a collection that leaves an operation out is "anyone
 * signed in", and the same default covers `readVersions`. With team accounts
 * that default would hand a trainee every lead in the version history, so every
 * collection in this CMS now names every operation it allows.
 */
export const ROLES = ['admin', 'editor', 'site', 'team', 'integration'] as const
export type Role = (typeof ROLES)[number]

type MaybeUser = { role?: string | null } | null | undefined

export const hasRole = (user: MaybeUser, ...roles: Role[]): boolean =>
  Boolean(user?.role && (roles as string[]).includes(user.role))

const allow =
  (...roles: Role[]): Access =>
  ({ req: { user } }) =>
    hasRole(user, ...roles)

const allowField =
  (...roles: Role[]): FieldAccess =>
  ({ req: { user } }) =>
    hasRole(user, ...roles)

export const nobody: Access = () => false
export const anyone: Access = () => true

export const isAdmin = allow('admin')

/** The website's words and pictures. */
export const contentEditors = allow('admin', 'editor', 'site')

/**
 * Who counts as the website.
 *
 * The website's account is still an editor on the live CMS until Ernest moves
 * it to "Website" in Users. Until then editors keep what the website needs, so
 * nothing on the website stops while it moves. Once `GET /api/users/me` with
 * the website's key answers `role: 'site'`, take 'editor' out of this list, and
 * only here: that release is the one that takes clients, invoices, leads and
 * the mailing list away from editors.
 */
const WEBSITE: Role[] = ['site', 'editor']

/** Client, sales and mailing-list records that the website itself uses. */
export const adminOrSite = allow('admin', ...WEBSITE)

/** The same rule, for custom endpoints that check the user themselves. */
export const isAdminOrSite = (user: MaybeUser): boolean => hasRole(user, 'admin', ...WEBSITE)

/** Field-level versions of the same, for fields inside a wider collection. */
export const adminField = allowField('admin')
export const adminOrSiteField = allowField('admin', ...WEBSITE)

/**
 * Who may open /admin at all.
 *
 * Team members sign in to the team portal instead, and the screen they get here
 * points them to it. The website's account is let in only when it arrives by
 * API key: the CMS does not start on a laptop, so loading an admin screen with
 * that key is the one way to see a change render, and the key already reaches
 * everything the screen would show through the REST API. A password sign-in to
 * that account is still refused.
 */
export const canOpenAdmin = ({ req: { user } }: { req: { user?: unknown } }): boolean => {
  const u = user as (MaybeUser & { _strategy?: string }) | undefined
  if (hasRole(u, 'admin', 'editor')) return true
  return hasRole(u, 'site') && u?._strategy === 'api-key'
}
