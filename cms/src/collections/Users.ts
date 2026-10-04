import type { CollectionConfig, Where } from 'payload'
import { canOpenAdmin, isAdmin, ROLES } from '../access/roles'
import { teamProfileFields } from '../fields/teamProfile'
import { teamAfterChange, teamAfterLogin, teamBeforeChange, teamBeforeDelete, teamBeforeLogin, teamEndpoints } from '../lib/teamAccounts'
import { managedIds } from '../access/managers'
import { resetEmail } from '../lib/teamEmails'

/**
 * There are two roles, admin and editor, and until now the distinction meant
 * nothing.
 *
 * This collection declared no `access` block at all, so Payload's defaults
 * applied: any authenticated user could create, read, update and delete users.
 * An editor could therefore open their own record, change `role` to `admin`,
 * and have the run of the place, or simply create themselves a second admin
 * account. `isAdmin` had been written for exactly this and was imported
 * nowhere. There is a real editor account on production, so this was not
 * theoretical.
 *
 * `login_attempts` and `lock_until` already exist on the table (Payload adds
 * them to every auth collection), so the throttle below needed no migration.
 *
 * October 2026: three more roles, for the team portal. What each one reaches is
 * written down in ../access/roles.ts. Team members also get a profile
 * (../fields/teamProfile.ts), a status with its history, and an invite that
 * emails them a link to set a password (../lib/teamAccounts.ts).
 */

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    group: 'System',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'status', 'updatedAt'],
  },
  auth: {
    useAPIKey: true,
    /**
     * Ten wrong passwords locks the account for ten minutes. The admin login
     * had no throttle of any kind, so a password could be attacked as fast as
     * the box would answer.
     */
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    /**
     * Thirty days, in seconds. Payload's default is two hours, which would ask
     * a team member to sign in again several times a day on their phone. It
     * applies to every account. Signing out still ends a sign-in at once,
     * because sessions are on (Payload's default since 3.x, the users_sessions
     * table): the token names a session, and logging out deletes it.
     */
    tokenExpiration: 30 * 24 * 60 * 60,
    /**
     * A team member's reset link goes to the team portal; anyone else's to the
     * CMS, as before. Payload's stock email pointed everyone at /admin/reset,
     * which refuses team members.
     */
    forgotPassword: {
      generateEmailSubject: () => 'Reset your Quadem password',
      generateEmailHTML: (args) =>
        resetEmail({
          token: String(args?.token ?? ''),
          team: (args?.user as { role?: string } | undefined)?.role === 'team',
          serverURL: args?.req?.payload?.config?.serverURL || 'https://cms.quademdigital.com',
        }).html,
    },
  },
  hooks: {
    beforeChange: [teamBeforeChange],
    afterChange: [teamAfterChange],
    beforeDelete: [teamBeforeDelete],
    beforeLogin: [teamBeforeLogin],
    afterLogin: [teamAfterLogin],
  },
  endpoints: teamEndpoints,
  access: {
    // Team members use the team portal. Everyone else lands on a screen that
    // sends them there (components/Unauthorized.tsx).
    admin: canOpenAdmin,
    unlock: isAdmin,
    // An editor has no business seeing the list of accounts, but must be able
    // to load their own to change their password.
    // A manager also reads the people who report to them (spec 14.1); the
    // private and money fields on those records stay theirs and Ernest's.
    read: async ({ req }) => {
      const { user } = req
      if (!user) return false
      if (user.role === 'admin') return true
      const people = await managedIds(req)
      return (people.length ? { or: [{ id: { equals: user.id } }, { id: { in: people } }] } : { id: { equals: user.id } }) as Where
    },
    create: isAdmin,
    delete: isAdmin,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { id: { equals: user.id } }
    },
  },
  fields: [
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Profile picture shown in the admin top bar.' },
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'Shown in the admin dashboard greeting.' },
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor (website content only)', value: 'editor' },
        { label: 'Website (its API key)', value: 'site' },
        { label: 'Team member (team portal only)', value: 'team' },
        { label: 'Integration (creates leads only)', value: 'integration' },
      ] satisfies { label: string; value: (typeof ROLES)[number] }[],
      // The least an account can be. It used to default to admin, so a new
      // account made in a hurry had the run of the place.
      defaultValue: 'editor',
      required: true,
      /**
       * The lock that matters. Without it the `update` rule above would still
       * let an editor edit their own record and set this to admin, which is
       * the whole escalation path in one field.
       */
      access: {
        create: ({ req: { user } }) => Boolean(user?.role === 'admin'),
        update: ({ req: { user } }) => Boolean(user?.role === 'admin'),
      },
      admin: {
        description:
          'Only an admin can change this. What each role can reach is listed in src/access/roles.ts.',
      },
    },
    ...teamProfileFields(),
  ],
  versions: false,
}
