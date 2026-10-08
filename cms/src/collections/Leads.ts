import type { CollectionConfig } from 'payload'
import { convertWonLeadToClient } from '../hooks/convertWonLeadToClient'
import { activityField, nextFollowUpField } from '../fields/activityLog'
import { adminOrSite, adminSiteOrMine, isAdmin } from '../access/roles'
import { leadAfterChange, leadBeforeChange, leadEndpoints } from '../lib/leadRules'
import { updatedByField } from '../fields/updatedBy'

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: 'Lead',
    plural: 'Leads',
  },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'assignedTo', 'nextFollowUp', 'loggedAt'],
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  /*
    Team members see and work only the leads assigned to them; another
    member's lead answers "not found". The rules in lib/leadRules.ts decide
    which of their changes stand.
  */
  access: {
    read: adminSiteOrMine('assignedTo'),
    create: () => true, // Allow frontend to submit leads
    update: adminSiteOrMine('assignedTo'),
    delete: adminOrSite,
    // Version history holds every past copy of every record. Admin only.
    readVersions: isAdmin,
  },
  // History, not drafts. See the note in Invoices.ts for why. Here it mostly
  // buys a record of how a lead moved through the statuses, and what the
  // enquiry said before anyone edited it.
  versions: { maxPerDoc: 50 },
  hooks: {
    beforeChange: [leadBeforeChange],
    afterChange: [convertWonLeadToClient, leadAfterChange],
  },
  endpoints: leadEndpoints,
  fields: [
    {
      name: 'source',
      label: 'Source',
      type: 'select',
      /*
        These values must stay in step with the hidden `source` input on every
        form. When the homepage, the CMS-driven service pages and Brand Studio
        were repointed from Formspree to /api/submit-form they began sending
        'homepage', 'cms-page' and 'brand-studio', none of which were listed
        here, so Payload rejected the whole document with "This field has an
        invalid selection" and those leads never saved. The notification email
        still went out, which is what disguised it.
      */
      options: [
        { label: 'Contact Form', value: 'contact-form' },
        { label: 'Homepage Form', value: 'homepage' },
        { label: 'Service Page', value: 'cms-page' },
        // Brand Studio was retired and folded into the AI Video & Reels service
        // page, but historical leads still carry this value and it is part of
        // `enum_leads_source`. Removing the option would make those rows
        // unrenderable in the admin, so it stays, relabelled.
        { label: 'Brand Studio (retired)', value: 'brand-studio' },
        { label: 'Lead Magnet', value: 'lead-magnet' },
        { label: 'Newsletter Signup', value: 'newsletter' },
        { label: 'Quote Calculator', value: 'calculator' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Team prospecting', value: 'outreach' },
        { label: 'Daily briefing', value: 'daily-briefing' },
        { label: 'Referral', value: 'referral' },
        { label: 'Other', value: 'other' },
      ],
      admin: { description: 'Which entry point captured this lead.' },
    },
    {
      name: 'magnetRequested',
      label: 'Lead Magnet Requested',
      type: 'text',
      admin: { description: 'Name of the lead magnet they opted in for (e.g. "10-Point Website Audit Checklist").' },
    },
    /*
      Prospects often have WhatsApp and nothing else, so neither the name nor
      the email is required on its own any more. lib/leadRules.ts insists on a
      business or contact name, and on a phone, WhatsApp or email.
    */
    {
      name: 'title',
      type: 'text',
      admin: { hidden: true },
    },
    {
      type: 'row',
      fields: [
        { name: 'businessName', label: 'Business', type: 'text', admin: { width: '50%' } },
        { name: 'name', label: 'Contact name', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'phone', type: 'text', admin: { width: '33%' } },
        { name: 'whatsapp', label: 'WhatsApp', type: 'text', admin: { width: '33%' } },
        { name: 'email', label: 'Email', type: 'email', admin: { width: '34%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'website', type: 'text', admin: { width: '50%' } },
        { name: 'foundAt', label: 'Found at', type: 'text', admin: { width: '50%', description: 'The page or listing that was checked.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'niche',
          type: 'select',
          options: [
            { label: 'Restaurants and food', value: 'food' },
            { label: 'Salons and beauty', value: 'beauty' },
            { label: 'Clinics and health', value: 'health' },
            { label: 'Fashion', value: 'fashion' },
            { label: 'Real estate', value: 'real-estate' },
            { label: 'Events', value: 'events' },
            { label: 'Fitness', value: 'fitness' },
            { label: 'Other', value: 'other' },
          ],
          admin: { width: '34%' },
        },
        { name: 'city', type: 'text', admin: { width: '33%' } },
        {
          name: 'country',
          type: 'text',
          admin: { width: '33%', description: 'Two letters: NG, GH…' },
          validate: (value: unknown) => !value || /^[A-Z]{2}$/.test(String(value).trim().toUpperCase()) || 'Two letters, such as NG or GH.',
        },
      ],
    },
    {
      name: 'qualification',
      label: 'Why they qualify',
      type: 'select',
      options: [
        { label: 'No website', value: 'no-website' },
        { label: 'Domain does not load', value: 'domain-dead' },
        { label: 'Parked or for sale', value: 'parked' },
        { label: 'Error page', value: 'error-page' },
        { label: 'Social pages or a free platform only', value: 'social-only' },
        // Not only websites: every service has a sign a business needs it.
        { label: 'Website works but is old or hard to use', value: 'outdated-site' },
        { label: 'Social pages quiet or poorly kept', value: 'weak-social' },
        { label: 'No clear logo or brand', value: 'weak-brand' },
        { label: 'Hard to find on Google', value: 'not-found' },
        { label: 'No videos or reels', value: 'no-video' },
        { label: 'Selling, but ads reach everyone the same way, or none', value: 'ads-untargeted' },
        { label: 'Something else (say in the notes)', value: 'other' },
      ],
    },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea',
    },
    {
      name: 'budget',
      label: 'Budget',
      type: 'select',
      /*
        Two ladders, because the site sells at two price levels and the old
        single ladder could not describe either.

        The dollar bands used to start at "under $2,000", which is below the
        cheapest thing on offer internationally ($3,000 for a website), so the
        first option a buyer read implied a price that was never available.

        Worse, the Ghana ladder runs GH₵ 2,500 to GH₵ 11,500, roughly $425 to
        $1,955. Every Ghanaian lead therefore landed in that same bottom band
        and the question collected nothing at all about the site's primary
        market.

        The four original values are kept. ALTER TYPE cannot drop an enum value
        and hundreds of leads already carry them; removing the options here
        would make those rows unrenderable in the admin.
      */
      options: [
        { label: 'GH₵ under 2,500', value: 'GHS < 2,500' },
        { label: 'GH₵ 2,500 - 6,000', value: 'GHS 2,500 - 6,000' },
        { label: 'GH₵ 6,000 - 12,000', value: 'GHS 6,000 - 12,000' },
        { label: 'GH₵ 12,000+', value: 'GHS 12,000+' },
        { label: 'Under $1,500', value: '< $1,500' },
        { label: '$1,500 - $3,000', value: '$1.5k - $3k' },
        { label: '$3,000 - $6,000', value: '$3k - $6k' },
        { label: '$6,000+', value: '$6k+' },
        { label: 'Under $2,000 (retired band)', value: '< $2,000' },
        { label: '$2,000 - $5,000 (retired band)', value: '$2k - $5k' },
        { label: '$5,000 - $10,000 (retired band)', value: '$5k - $10k' },
        { label: '$10,000+ (retired band)', value: '$10k+' },
      ],
      admin: { description: 'Budget range selected on a form. Cedi bands are shown to visitors in Africa, dollar bands to everyone else.' },
    },
    {
      name: 'servicesInterested',
      label: 'Services Interested In',
      type: 'json',
      admin: {
        description: 'Services selected on the contact form (array of strings).',
      },
    },
    {
      name: 'metadata',
      label: 'Additional Data',
      type: 'json',
      admin: {
        description: 'Extra data like selected services or budget',
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      /*
        `new` is shown as Logged. The journey on the portal's home groups these
        into Found, Messaged, Talking, Quote and Won.
      */
      options: [
        { label: 'Logged', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Replied', value: 'replied' },
        { label: 'In conversation', value: 'in-conversation' },
        { label: 'Proposal requested', value: 'proposal-requested' },
        { label: 'Proposal sent', value: 'proposal-sent' },
        { label: 'No response', value: 'no-response' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Won', value: 'won' },
        { label: 'Lost', value: 'lost' },
        // They asked Quadem to stop contacting them: never contacted again (Team Handbook §10).
        { label: 'Asked us to stop', value: 'stopped' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'new',
    },
    {
      name: 'convertedClient',
      label: 'Converted Client',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        readOnly: true,
        description: 'Auto-set when this lead is marked Won. Links to the Client record created from it.',
      },
    },
    nextFollowUpField('lead'),
    activityField({ team: true }),
    /*
      Who found it and who works it (Agreement §6). Set by the server; see
      lib/leadRules.ts. `loggedAt` decides who sourced a deal and nobody can
      change it. `assignedTo` changes only through the handover.
    */
    {
      name: 'owner',
      label: 'Found by',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { position: 'sidebar', description: 'Empty means Quadem: the website, an import or Ernest before he logs it as his.' },
    },
    {
      name: 'ownerChangeReason',
      label: 'Why it changed',
      type: 'text',
      admin: { position: 'sidebar', description: 'Needed when changing who found it. Kept in the history.' },
    },
    {
      name: 'loggedAt',
      label: 'Logged',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, HH:mm' } },
    },
    {
      name: 'assignedTo',
      label: 'Worked by',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Changed with Hand over in the team portal.' },
    },
    {
      name: 'assignedAt',
      label: 'Since',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, HH:mm' } },
    },
    {
      name: 'creditType',
      label: 'Credit',
      type: 'text',
      virtual: true,
      admin: { position: 'sidebar', readOnly: true },
      hooks: {
        afterRead: [
          ({ siblingData }) =>
            !siblingData?.assignedTo || !siblingData?.owner
              ? null
              : String(idOf(siblingData.assignedTo)) === String(idOf(siblingData.owner))
                ? 'Sourced'
                : 'Handed over',
        ],
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'firstContactedAt', label: 'First contact', type: 'date', admin: { readOnly: true, width: '34%' } },
        { name: 'lastContactAt', label: 'Last contact', type: 'date', admin: { readOnly: true, width: '33%' } },
        { name: 'followUpCount', label: 'Follow-ups', type: 'number', admin: { readOnly: true, width: '33%' } },
      ],
    },
    // Normalised copies for the duplicate check. Written by the server only.
    { name: 'phoneKey', type: 'text', index: true, admin: { hidden: true } },
    { name: 'whatsappKey', type: 'text', index: true, admin: { hidden: true } },
    { name: 'websiteKey', type: 'text', index: true, admin: { hidden: true } },
    { name: 'nameCityKey', type: 'text', index: true, admin: { hidden: true } },
    {
      name: 'submittedAt',
      label: 'Submitted At',
      type: 'date',
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ operation, value }) => {
            if (operation === 'create') {
              return new Date().toISOString()
            }
            return value
          },
        ],
      },
    },
    updatedByField(),
  ],
}
