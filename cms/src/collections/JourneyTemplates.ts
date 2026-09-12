import type { CollectionConfig } from 'payload'

/*
  What happens after a client says yes, written once per service.

  Until this existed the only journey in the system was `projectStatus` on the
  client, five words in a dropdown that the portal draws as a stepper. It says
  where a project is and nothing about what has to happen next, who owes it, or
  when it is due, so the actual steps lived in Ernest's head and in the static
  SETUP_ITEMS map baked into the site's client-won automation.

  A template is a list of steps with an owner and a due offset. Provisioning a
  proposal copies the matching template onto the new client as real, dated,
  tickable steps (see client-journey-steps), so changing a template never
  rewrites the history of a client already part way through one.

  SERVICE IS HOW A TEMPLATE IS CHOSEN

  A proposal names a service, and provisioning looks for the template whose
  service matches, then for one marked as the fallback. Two templates for the
  same service is allowed and the default wins, so a seasonal variant can sit
  beside the standard one without being picked by accident.
*/

export const SERVICE_OPTIONS = [
  { label: 'Web Design', value: 'web-design' },
  { label: 'Digital Marketing', value: 'digital-marketing' },
  { label: 'Branding', value: 'branding' },
  { label: 'AI Video & Reels', value: 'video-production' },
  { label: 'SEO & Paid Ads', value: 'seo-paid-ads' },
  { label: 'Social Media Management', value: 'social-media' },
  { label: 'Multiple Services', value: 'multiple' },
]

/* The same six words the portal stepper draws, so a step can say which part of
   the project it belongs to and the two never drift apart. */
export const STAGE_OPTIONS = [
  { label: 'Onboarding', value: 'onboarding' },
  { label: 'Design', value: 'design' },
  { label: 'Development', value: 'development' },
  { label: 'Review', value: 'review' },
  { label: 'Completed', value: 'completed' },
  { label: 'Retainer', value: 'retainer' },
]

export const OWNER_OPTIONS = [
  { label: 'Me', value: 'quadem' },
  { label: 'The client', value: 'client' },
]

export const JourneyTemplates: CollectionConfig = {
  slug: 'journey-templates',
  labels: { singular: 'Journey Template', plural: 'Journey Templates' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'name',
    defaultColumns: ['name', 'service', 'isDefault', 'updatedAt'],
    description:
      'The steps a client goes through after they sign, one template per service. Uploading a proposal copies the matching template onto the new client as dated steps.',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', label: 'Template Name', type: 'text', required: true, admin: { placeholder: 'Web design build' } },
        {
          name: 'service',
          label: 'For which service',
          type: 'select',
          options: SERVICE_OPTIONS,
          admin: {
            description: 'Provisioning picks the template matching the proposal\'s service.',
          },
        },
      ],
    },
    {
      name: 'isDefault',
      label: 'Use this when no template matches the service',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'The fallback. Tick it on one template only: a proposal for a service with no template of its own gets this one.',
      },
    },
    {
      name: 'summary',
      label: 'What this journey is for',
      type: 'textarea',
      admin: { rows: 2, description: 'Internal note. Never shown to a client.' },
    },
    {
      name: 'steps',
      label: 'Steps',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Step', plural: 'Steps' },
      admin: {
        description:
          'In order. Each one becomes a dated step on the client when a proposal is provisioned.',
        initCollapsed: false,
      },
      fields: [
        { name: 'title', label: 'Step', type: 'text', required: true, admin: { placeholder: 'Kickoff call' } },
        {
          name: 'detail',
          label: 'What it involves',
          type: 'textarea',
          admin: { rows: 2, description: 'Shown to the client when the step is marked visible to them.' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'owner',
              label: 'Who does it',
              type: 'select',
              defaultValue: 'quadem',
              options: OWNER_OPTIONS,
              admin: { width: '33%' },
            },
            {
              name: 'stage',
              label: 'Stage',
              type: 'select',
              defaultValue: 'onboarding',
              options: STAGE_OPTIONS,
              admin: { width: '33%' },
            },
            {
              name: 'dueOffsetDays',
              label: 'Due (days from start)',
              type: 'number',
              defaultValue: 0,
              min: 0,
              admin: {
                width: '33%',
                description: 'Counted from the project start date, or from today if the proposal gave none.',
              },
            },
          ],
        },
        {
          name: 'clientVisible',
          label: 'Show this step to the client',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Untick for anything internal. A step the client cannot see is still tracked here.',
          },
        },
      ],
    },
  ],
}
