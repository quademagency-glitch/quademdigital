import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

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
 */

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    group: 'System',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'updatedAt'],
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
  },
  access: {
    // An editor has no business seeing the list of accounts, but must be able
    // to load their own to change their password.
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { id: { equals: user.id } }
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
      options: ['admin', 'editor'],
      defaultValue: 'admin',
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
        description: 'Only an admin can change this.',
      },
    },
  ],
  versions: false,
}
