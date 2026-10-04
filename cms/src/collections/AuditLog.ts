import type { CollectionConfig } from 'payload'
import { isAdmin, nobody } from '../access/roles'

/**
 * The audit log (spec 14.9): every change to someone's terms, status changes
 * and ended agreements, people added, roles changed, handovers, Won and Lost,
 * and later payouts and approvals. Who did it, when, and what changed from
 * what to what.
 *
 * Written only by the CMS (lib/audit.ts). Nobody can edit or delete an entry,
 * admins included, so it stays an honest record. Only an admin reads it.
 */
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Audit entry', plural: 'Audit log' },
  admin: {
    group: 'Team',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'actor', 'createdAt'],
    description: 'A record of important changes. Read-only.',
  },
  defaultSort: '-createdAt',
  access: {
    read: isAdmin,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'summary', type: 'text', required: true },
    { name: 'actor', label: 'By', type: 'relationship', relationTo: 'users', index: true },
    { name: 'person', label: 'About', type: 'relationship', relationTo: 'users', index: true },
    {
      type: 'row',
      fields: [
        { name: 'subjectType', label: 'Record', type: 'text', index: true, admin: { width: '50%' } },
        { name: 'subjectId', label: 'Record id', type: 'text', index: true, admin: { width: '50%' } },
      ],
    },
    { name: 'reason', type: 'text' },
    { name: 'changes', type: 'json', admin: { description: 'What changed: field, from, to.' } },
  ],
}
