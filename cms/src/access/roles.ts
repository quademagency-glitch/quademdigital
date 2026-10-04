import type { Access, FieldAccess } from 'payload'

/**
 * Who each account is, and the one place that says what each can reach.
 *
 * admin        Ernest. Everything.
 * editor       Content help. The website's words and pictures: pages, posts,
 *              media, services, prices on the page. No clients, leads,
 *              invoices, proposals, pitches, mailing list, team records or
 *              money. Until October 2026 an editor could reach all of it,
 *              because most collections only asked "is anyone signed in?".
 * site         The website's own account, automation@quademdigital.com, by API
 *              key. Exactly what the website does: reads content and the bank
 *              details; reads and writes clients, invoices, leads, onboarding
 *              documents, subscribers, email campaigns and their events; serves
 *              pitch sites and records their views. It can also edit content,
 *              because the maintenance scripts in cms/scripts write with the
 *              same key. It never reaches the team and money collections.
 * team         Team members, of any job role. They use the team portal at
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
 * Who counts as the website: its own account, and nobody else.
 *
 * Until 4 October 2026 this also listed 'editor', because the website's
 * account was an editor and moving it was a hand change in Users. Ernest moved
 * it to `site`, and taking 'editor' out here is what took clients, invoices,
 * leads, pitches and the mailing list away from editors.
 */
const WEBSITE: Role[] = ['site']

/** Client, sales and mailing-list records that the website itself uses. */
export const adminOrSite = allow('admin', ...WEBSITE)

/** The same rule, for custom endpoints that check the user themselves. */
export const isAdminOrSite = (user: MaybeUser): boolean => hasRole(user, 'admin', ...WEBSITE)

/** Admins and team members. Reference data the portal needs, such as job roles. */
export const adminOrTeam = allow('admin', 'team')

/**
 * Admins see every record; a team member sees the ones whose `field` points at
 * them. Anyone else sees nothing. Returning a query rather than true means a
 * team member who asks for another person's record gets "not found".
 */
export const adminOrMine =
  (field: string): Access =>
  ({ req: { user } }) => {
    if (hasRole(user, 'admin')) return true
    if (hasRole(user, 'team') && user) return { [field]: { equals: user.id } }
    return false
  }

/**
 * The website and admins see every record; a team member sees the ones whose
 * `field` points at them (leads: `assignedTo`).
 */
export const adminSiteOrMine =
  (field: string): Access =>
  (args) =>
    hasRole(args.req.user, 'admin', ...WEBSITE) ? true : adminOrMine(field)(args)

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
