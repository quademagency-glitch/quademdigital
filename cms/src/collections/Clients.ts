import { APIError, type CollectionBeforeDeleteHook, type CollectionConfig } from 'payload'
import { activityField, nextFollowUpField } from '../fields/activityLog'
import { generateAccessCode } from '../lib/accessCode'
import { prepareOnboarding, queueOnboarding } from '../lib/onboarding'
import { adminOrSite, adminSiteOrMine, isAdmin } from '../access/roles'
import { updatedByField } from '../fields/updatedBy'
import { creditClientFromLead, limitTeamRead, TEAM_CLIENT_FIELDS } from '../lib/clientCredit'
import { clientDeskEndpoints } from '../lib/clientDesk'

/**
 * Make a client deletable.
 *
 * Until this, a client with any paperwork could not be deleted at all.
 * `onboarding_documents.client_id`, `client_journey_steps.client_id` and
 * `invoices.client_id` (and `_invoices_v.version_client_id`) are NOT NULL with
 * ON DELETE SET NULL, which is what Payload's generator emits for a required
 * relationship, so Postgres refuses to delete the parent row. Inside a bulk
 * delete that aborts the transaction, and every other client in the batch
 * fails with it as "current transaction is aborted". Ernest hit exactly that
 * on 2026-10-02 trying to remove the two QA clients, and reported it as bulk
 * actions not working anywhere. Same trap and same fix as Pitches.
 *
 * - Journey steps and onboarding documents belong to the client and go with
 *   it, deleted through Payload so the files leave the private bucket too.
 * - Invoices do not. They are financial records, so the delete is refused and
 *   names them. That includes an invoice since moved to another client whose
 *   saved history still points here, which would trip the same constraint.
 *
 * Refusing with an APIError before any SQL runs keeps the transaction healthy,
 * so in a bulk delete the other clients still go.
 */
const removeClientPaperwork: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const invoices = await req.payload.find({
    collection: 'invoices',
    where: { client: { equals: id } },
    depth: 0,
    limit: 20,
    req,
  })
  if (invoices.totalDocs) {
    const names = invoices.docs.map((d: any) => d.invoiceId || `#${d.id}`).join(', ')
    const one = invoices.totalDocs === 1
    throw new APIError(
      `This client still has ${one ? 'an invoice' : `${invoices.totalDocs} invoices`} (${names}). Invoices are never deleted along with a client. Delete ${one ? 'it' : 'them'} first if you are sure, then delete the client.`,
      400,
    )
  }
  const history = await req.payload.findVersions({
    collection: 'invoices',
    where: { 'version.client': { equals: id } },
    depth: 0,
    limit: 1,
    req,
  })
  if (history.totalDocs) {
    throw new APIError(
      "An invoice that now belongs to another client still names this one in its saved history, so this client cannot be deleted without rewriting that invoice's history.",
      400,
    )
  }

  for (const collection of ['client-journey-steps', 'onboarding-documents'] as const) {
    let failed = ''
    try {
      // Deleting by `where` reports per-document failures in `errors` rather
      // than throwing, so both have to be checked.
      const result = await req.payload.delete({
        collection,
        where: { client: { equals: id } },
        req,
      })
      failed = result.errors?.[0]?.message || ''
    } catch (err) {
      failed = err instanceof Error ? err.message : String(err)
    }
    if (failed) {
      req.payload.logger.error(
        { id, collection, failed },
        'could not delete the records belonging to a client',
      )
      throw new APIError(
        `This client's ${collection === 'onboarding-documents' ? 'documents' : 'journey steps'} could not be removed, so the client has not been deleted. Try again in a moment.`,
        500,
      )
    }
  }
}

export const Clients: CollectionConfig = {
  slug: 'clients',
  labels: { singular: 'Client', plural: 'Clients' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'clientName',
    defaultColumns: ['clientName', 'contactName', 'service', 'pipelineStatus', 'projectStatus'],
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    // A team member reads the clients credited to them, for My clients in the
    // team portal, and on those only TEAM_CLIENT_FIELDS (spec 3.2).
    read: adminSiteOrMine('creditTo'),
    create: adminOrSite,
    update: adminOrSite,
    delete: adminOrSite,
    // Version history holds every past copy of every record. Admin only.
    readVersions: isAdmin,
  },
  // History, not drafts. See the note in Invoices.ts for why. A client record
  // carries the portal access code, the agreed price and the contract
  // customisations, all of which were previously overwritable without trace.
  versions: { maxPerDoc: 50 },
  // The founder portal's client page: email or change the code, add journey steps from a template.
  endpoints: clientDeskEndpoints,
  hooks: {
    // Credit first, so onboarding sees the finished record.
    beforeChange: [creditClientFromLead, prepareOnboarding],
    afterChange: [queueOnboarding],
    beforeDelete: [removeClientPaperwork],
  },
  fields: limitTeamRead([
    {
      name: 'clientContext',
      type: 'ui',
      admin: { components: { Field: './components/ClientWorkspace#ClientContext' } },
    },
    {
      name: 'onboardingStatus',
      label: 'Onboarding delivery',
      type: 'textarea',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'onboardingState',
      label: 'Delivery details',
      type: 'json',
      access: { create: () => false, update: () => false },
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Saved results and request references for each delivery step.',
        // Holds a copy of the access code (client.accessCode), so it is shown
        // with that dotted out, here and in Versions, and kept out of the list.
        disableListColumn: true,
        components: {
          Field: './components/ClientWorkspace#OnboardingDelivery',
          Diff: './components/SecretDiff#SecretDiff',
        },
      },
    },
    {
      name: 'retryOnboarding',
      label: 'Retry incomplete onboarding',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Select and save after resolving a delivery problem. Completed steps are kept.',
      },
    },
    nextFollowUpField('client'),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Client Details & CRM',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'clientName',
                  label: 'Business / Client Name',
                  type: 'text',
                  required: true,
                },
                { name: 'contactName', label: 'Contact Person', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'clientEmail', label: 'Email Address', type: 'email' },
                { name: 'phone', label: 'WhatsApp / Phone', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'service',
                  type: 'select',
                  label: 'Service',
                  options: [
                    { label: 'Web Design', value: 'web-design' },
                    { label: 'Digital Marketing', value: 'digital-marketing' },
                    { label: 'Branding', value: 'branding' },
                    { label: 'AI Video & Reels', value: 'video-production' },
                    { label: 'SEO & Paid Ads', value: 'seo-paid-ads' },
                    { label: 'Social Media Management', value: 'social-media' },
                    { label: 'Multiple Services', value: 'multiple' },
                    { label: 'Custom Project', value: 'custom' },
                  ],
                },
                { name: 'package', type: 'text', label: 'Package / Plan Name' },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'country',
                  label: 'Country (2-letter code)',
                  type: 'text',
                  maxLength: 2,
                  admin: {
                    width: '50%',
                    description:
                      'ISO country code, e.g. GH, NG, GB or US.',
                    placeholder: 'GH',
                  },
                  hooks: {
                    beforeChange: [
                      ({ value }) =>
                        value ? String(value).trim().toUpperCase().slice(0, 2) : value,
                    ],
                  },
                  validate: (value: unknown) => {
                    if (!value) return true
                    return /^[A-Za-z]{2}$/.test(String(value))
                      ? true
                      : 'Use the two-letter country code, e.g. GH or NG.'
                  },
                },
                {
                  name: 'currency',
                  label: 'Agreed currency',
                  type: 'text',
                  admin: { width: '50%', description: 'ISO billing currency, e.g. GHS or USD.' },
                  validate: (value: unknown) =>
                    !value ||
                    ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP'].includes(String(value)) ||
                    'Choose an ISO billing currency such as GHS or USD.',
                },
              ],
            },
            {
              name: 'agreementContext',
              type: 'ui',
              admin: { components: { Field: './components/ClientWorkspace#AgreementContext' } },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'price',
                  type: 'number',
                  label: 'Agreed fee',
                  min: 0,
                  admin: {
                    description:
                      'Whole units in the agreed currency. Billing follows the contract payment terms.',
                  },
                },
                {
                  name: 'startDate',
                  type: 'date',
                  label: 'Project Start Date',
                  admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'pipelineStatus',
                  type: 'select',
                  defaultValue: 'lead',
                  label: 'Pipeline Status',
                  options: [
                    { label: 'Lead', value: 'lead' },
                    { label: 'Discovery', value: 'discovery' },
                    { label: 'Proposal Sent', value: 'proposal' },
                    { label: 'Negotiating', value: 'negotiating' },
                    { label: 'Won', value: 'won' },
                    { label: 'Lost', value: 'lost' },
                    { label: 'On Hold', value: 'on-hold' },
                    { label: 'Active Client', value: 'active' },
                    { label: 'Completed', value: 'completed' },
                  ],
                },
                {
                  name: 'source',
                  type: 'select',
                  label: 'How They Found You',
                  options: [
                    { label: 'Website', value: 'website' },
                    { label: 'WhatsApp', value: 'whatsapp' },
                    { label: 'Referral', value: 'referral' },
                    { label: 'Social Media', value: 'social' },
                    { label: 'Walk-in', value: 'walk-in' },
                    { label: 'Other', value: 'other' },
                  ],
                },
              ],
            },
            {
              name: 'proposalUrl',
              type: 'text',
              label: 'Proposal Link',
              admin: {
                description: 'Google Drive or shared URL for the proposal sent to this client',
              },
            },
            { name: 'notes', type: 'textarea', label: 'Internal Notes' },
            activityField(),
            {
              type: 'collapsible',
              label: 'Where it came from',
              admin: { initCollapsed: true },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'sourceLead',
                      label: 'Lead',
                      type: 'relationship',
                      relationTo: 'leads',
                      admin: { width: '34%' },
                    },
                    {
                      name: 'creditTo',
                      label: 'Credited to',
                      type: 'relationship',
                      relationTo: 'users',
                      admin: { width: '33%' },
                    },
                    {
                      name: 'creditType',
                      label: 'Credit',
                      type: 'select',
                      options: [
                        { label: 'Sourced', value: 'sourced' },
                        { label: 'Handed over', value: 'handed' },
                      ],
                      admin: { width: '33%' },
                    },
                  ],
                },
              ],
            },
            {
              name: 'documentsSent',
              type: 'group',
              label: 'Manual document checklist',
              admin: {
                description:
                  'Manual checklist. Automatic document and email results appear under Onboarding delivery.',
                condition: (data: any) =>
                  data?.pipelineStatus === 'won' || data?.pipelineStatus === 'active',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'contract',
                      type: 'checkbox',
                      label: 'Service Agreement',
                      defaultValue: false,
                    },
                    {
                      name: 'invoice',
                      type: 'checkbox',
                      label: 'Proforma Invoice',
                      defaultValue: false,
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'onboardingEmail',
                      type: 'checkbox',
                      label: 'Onboarding Email',
                      defaultValue: false,
                    },
                    {
                      name: 'setupInstructions',
                      type: 'checkbox',
                      label: 'Setup Instructions',
                      defaultValue: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Client Portal',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'slug', label: 'Portal Slug', type: 'text', required: true, unique: true },
                {
                  name: 'accessCode',
                  label: 'Access Code',
                  type: 'text',
                  required: true,
                  unique: true,
                  admin: {
                    readOnly: true,
                    description:
                      'Generated automatically and sent to the client in their welcome email. Leave it alone, clear the field and save if you ever need to issue a new one.',
                    // Hidden behind an eye here and in Versions, and kept out of
                    // the list's columns. See lib/passwordReveal.ts.
                    className: 'qd-secret',
                    disableListColumn: true,
                    components: { Diff: './components/SecretDiff#SecretDiff' },
                  },
                  hooks: {
                    // beforeValidate, not beforeChange: the field is required,
                    // so it has to be filled before validation runs or saving
                    // without one fails.
                    //
                    // Codes used to be six characters from Math.random(): a
                    // million possibilities from a generator that is not
                    // cryptographic, guarding client files, timelines and
                    // invoices behind a login with no meaningful throttle.
                    // These are 56^14 from crypto.randomBytes.
                    beforeValidate: [({ value }) => value || generateAccessCode()],
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'projectName', label: 'Project Name', type: 'text' },
                {
                  name: 'projectStatus',
                  label: 'Portal Project Status',
                  type: 'select',
                  defaultValue: 'onboarding',
                  options: [
                    { label: 'Onboarding', value: 'onboarding' },
                    { label: 'Design', value: 'design' },
                    { label: 'Development', value: 'development' },
                    { label: 'Review', value: 'review' },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Retainer', value: 'retainer' },
                  ],
                },
              ],
            },
            { name: 'welcomeMessage', label: 'Welcome Message', type: 'textarea' },
            {
              name: 'onboardingGuide',
              label: 'Onboarding Guide',
              type: 'relationship',
              relationTo: 'onboarding-guides',
            },
            {
              name: 'timeline',
              label: 'Project Timeline',
              type: 'array',
              fields: [
                { name: 'date', label: 'Date', type: 'date', required: true },
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
              ],
            },
            {
              name: 'deliverables',
              label: 'Deliverables & Assets',
              type: 'array',
              fields: [
                {
                  name: 'category',
                  label: 'Category',
                  type: 'select',
                  defaultValue: 'other',
                  options: [
                    { label: 'Design Files', value: 'design' },
                    { label: 'Brand Assets', value: 'brand' },
                    { label: 'Documents', value: 'documents' },
                    { label: 'Videos', value: 'videos' },
                    { label: 'Other', value: 'other' },
                  ],
                },
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'url', label: 'URL', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Customizations',
          fields: [
            {
              name: 'customizations',
              type: 'group',
              label: 'Project Customizations',
              admin: {
                description:
                  'Override document defaults for this client. Blank fields use standard values.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'duration',
                      type: 'number',
                      label: 'Contract Duration (months)',
                      min: 0,
                      admin: {
                        placeholder: 'Default: 3',
                        description: 'Use 0 for a one-off project with no recurring fee.',
                        width: '50%',
                      },
                    },
                    {
                      name: 'revisions',
                      type: 'number',
                      label: 'Revision Rounds Included',
                      min: 0,
                      admin: { placeholder: 'Default: 2', width: '50%' },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'depositPercent',
                      type: 'number',
                      label: 'Deposit Required (%)',
                      min: 0,
                      max: 100,
                      admin: { placeholder: 'e.g. 50 for 50% upfront', width: '50%' },
                    },
                    {
                      name: 'numberOfPages',
                      type: 'number',
                      label: 'Number of Pages (web design)',
                      min: 1,
                      admin: { placeholder: 'e.g. 5', width: '50%' },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'postsPerMonth',
                      type: 'number',
                      label: 'Posts Per Month (social media)',
                      min: 1,
                      admin: { placeholder: 'e.g. 12', width: '50%' },
                    },
                    {
                      name: 'platforms',
                      type: 'text',
                      label: 'Platforms / Channels',
                      admin: { placeholder: 'e.g. Facebook, Instagram, LinkedIn', width: '50%' },
                    },
                  ],
                },
                {
                  name: 'paymentTerms',
                  type: 'text',
                  label: 'Payment Terms',
                  admin: {
                    placeholder:
                      'e.g. 50% upfront, 50% on delivery. Overrides standard monthly retainer wording',
                  },
                },
                {
                  name: 'extraDeliverables',
                  type: 'textarea',
                  label: 'Additional / Custom Deliverables',
                  admin: {
                    placeholder:
                      'One per line. Appended to the standard deliverables list in the contract',
                    rows: 4,
                  },
                },
                {
                  name: 'specialTerms',
                  type: 'textarea',
                  label: 'Special Terms or Notes',
                  admin: {
                    placeholder:
                      'Any clause, condition, or agreement specific to this client that should appear in the contract',
                    rows: 3,
                  },
                },
              ],
            },
            {
              name: 'emailNotes',
              type: 'group',
              label: 'Email Customizations',
              admin: {
                description:
                  'Optional personal notes injected into each automated email. Blank = standard template.',
              },
              fields: [
                {
                  name: 'welcome',
                  type: 'textarea',
                  label: 'Welcome Pack email: personal note',
                  admin: {
                    rows: 3,
                    description: 'Appears as a highlighted block in the first email.',
                  },
                },
                {
                  name: 'contract',
                  type: 'textarea',
                  label: 'Service Agreement email: personal note',
                  admin: {
                    rows: 3,
                    description: 'Appears in the contract email, above the action-required block.',
                  },
                },
                {
                  name: 'setup',
                  type: 'textarea',
                  label: 'Setup Instructions email: personal note',
                  admin: {
                    rows: 3,
                    description: 'Appears in the setup email, to clarify anything agreed verbally.',
                  },
                },
                {
                  name: 'checkin',
                  type: 'textarea',
                  label: 'Week-one check-in email: personal note',
                  admin: { rows: 3, description: 'Appears in the 7-day follow-up email.' },
                },
              ],
            },
          ],
        },
      ],
    },
    updatedByField(),
  ], TEAM_CLIENT_FIELDS),
}
