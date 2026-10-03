import type { CollectionConfig } from 'payload'
import { adminField, adminOrTeam, isAdmin } from '../access/roles'

/**
 * What a kind of job looks like in the team portal.
 *
 * Business development came first, but a designer or a video editor should be
 * able to join without a code change, so the parts of the portal a person sees
 * and the standard their daily report is held to belong to their job role, not
 * to the code. Team members can read job roles because their own screens are
 * built from one; there is no money here.
 */
export const JobRoles: CollectionConfig = {
  slug: 'job-roles',
  labels: { singular: 'Job role', plural: 'Job roles' },
  admin: {
    group: 'Team',
    useAsTitle: 'name',
    defaultColumns: ['name', 'active', 'updatedAt'],
    description: 'Kinds of job on the team. Each sets what its people see in the team portal and what their daily report counts.',
  },
  access: {
    read: adminOrTeam,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, admin: { description: 'For example Business development.' } },
    { name: 'description', type: 'textarea' },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Untick to stop offering this role to new people. People already in it keep it.' },
    },
    {
      name: 'modules',
      label: 'Parts of the portal',
      type: 'group',
      admin: { description: 'What people in this role see.' },
      fields: [
        { name: 'pipeline', label: 'Pipeline and leads', type: 'checkbox', defaultValue: false },
        { name: 'quoteRequests', label: 'Quote requests', type: 'checkbox', defaultValue: false },
        { name: 'commission', label: 'Commission', type: 'checkbox', defaultValue: false },
        { name: 'dataAllowance', label: 'Data allowance', type: 'checkbox', defaultValue: false },
        { name: 'clientProjects', label: 'Client projects', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'reportCounts',
      label: 'Daily report',
      type: 'array',
      labels: { singular: 'Count', plural: 'Counts' },
      admin: {
        description:
          'What the daily report counts and the standard for each. Counted automatically from the pipeline, or typed in by the person, such as "designs delivered".',
        initCollapsed: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { width: '40%', description: 'As the person sees it.' } },
            {
              name: 'source',
              type: 'select',
              required: true,
              defaultValue: 'typed',
              admin: { width: '30%' },
              options: [
                { label: 'Typed in by the person', value: 'typed' },
                { label: 'Businesses researched (pipeline)', value: 'researched' },
                { label: 'First messages (pipeline)', value: 'firstMessages' },
                { label: 'Follow-ups due and done (pipeline)', value: 'followUps' },
                { label: 'Replies received (pipeline)', value: 'replies' },
              ],
            },
            {
              name: 'target',
              type: 'number',
              min: 0,
              admin: { width: '15%', description: 'Green at or above. Empty for follow-ups: all of those due.' },
            },
            {
              name: 'amberFrom',
              label: 'Amber from',
              type: 'number',
              min: 0,
              admin: { width: '15%', description: 'Below this is red.' },
            },
          ],
        },
      ],
    },
    {
      name: 'defaultTerms',
      label: 'Default terms',
      type: 'relationship',
      relationTo: 'terms-templates',
      admin: { description: 'Offered first when someone joins in this role. Their own terms can then differ.' },
      // A team member reads their role, not what the role pays.
      access: { read: adminField },
    },
  ],
}
