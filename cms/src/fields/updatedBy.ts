import type { Field } from 'payload'

/**
 * Who made the last change (spec 3.4), beside the version history these
 * records already keep, which says what changed. Set by the server on every
 * save from the signed-in account; empty when the CMS itself made the change,
 * such as a scheduled job. Never typed.
 */
export const updatedByField = (): Field => ({
  name: 'updatedBy',
  label: 'Last changed by',
  type: 'relationship',
  relationTo: 'users',
  admin: { readOnly: true, position: 'sidebar' },
  hooks: {
    beforeChange: [({ req }) => req.user?.id ?? null],
  },
})
