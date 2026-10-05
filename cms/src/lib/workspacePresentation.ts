import type { CollectionConfig, Field, GlobalConfig } from 'payload'

/** Presentation only: these helpers never change stored paths or access rules. */
const descriptions: Record<string, string> = {
  'quote-requests': 'Review requested quotes, their owners and the next action.',
  projects: 'Review client projects, owners, milestones and delivery progress.',
  deliverables: 'Track project deliverables, responsibilities and due dates.',
  'time-off': 'Review leave requests, dates and approval decisions.',
  'monthly-reviews': 'Review monthly progress, feedback and follow-up actions.',
  warnings: 'Review team notices and acknowledgement status.',
  appraisals: 'Manage performance reviews, outcomes and due dates.',
  goals: 'Track team goals, targets and progress.',
  'training-modules': 'Organise training content and role requirements.',
  'training-progress': 'Review completed training and sign-off status.',
  meetings: 'Manage meetings, agendas and the actions that follow.',
  'know-how': 'Review and share useful team knowledge.',
  openings: 'Manage job openings and application deadlines.',
  applicants: 'Review applicants and their hiring progress.',
  channels: 'Manage team conversation spaces.',
  messages: 'Review messages in team conversations.',
  polls: 'Manage team polls and their closing dates.',
  clients: 'Manage client relationships, project progress and onboarding in one place.',
  leads: 'Keep enquiries, contact history and the next follow-up together.',
  proposals: 'Review proposal details, then create the client, draft invoice and delivery plan.',
  invoices: 'Review invoices by client, currency, payment status and due date.',
  blogPosts: 'Write articles, manage drafts and prepare posts for publication.',
  pages: 'Build website pages, review drafts and manage publication.',
  services: 'Edit the services, benefits and details shown on your website.',
  caseStudies: 'Present completed work with project stories, results and images.',
  media: 'Organise images and videos, manage folders and check where files are used.',
  emailCampaigns: 'Write your message, choose the audience and review delivery results.',
  subscribers: 'Manage newsletter subscriptions, interests and consent status.',
  offers: 'Manage the offers and campaign landing pages shown on the website.',
  users: 'Manage workspace accounts, roles and team member details.',
  tasks: 'Track responsibilities, due dates and the work still to be done.',
  'daily-reports': 'Review the team’s daily work, progress and next steps.',
  announcements: 'Manage updates and notices for the team.',
  documents: 'Keep team documents and supporting files organised.',
  'client-payments': 'Review received payments, supporting costs and commission records.',
  payouts: 'Record payments made to team members and their supporting references.',
  'expense-claims': 'Review submitted expenses, receipts, decisions and payment records.',
  'signature-requests': 'Prepare documents for signing and track each request through completion.',
  'signed-documents': 'Access completed documents and their signing records.',
  'signing-sessions': 'Review individual signer sessions and verification progress.',
  pitches: 'Prepare client pitch sites, manage their files and track link activity.',
  'pitch-assets': 'Manage the files attached to client pitch sites.',
  blogCategories: 'Organise articles into clear topics for readers.',
  testimonials: 'Manage client feedback and the names shown with it.',
  faqs: 'Keep answers to common customer questions up to date.',
  webapps: 'Manage the applications and product links featured on the website.',
  stats: 'Maintain the statistics shown across the website.',
  processSteps: 'Explain the steps clients follow when working with Quadem.',
  pricingPlans: 'Manage published plans, their markets, prices and inclusions.',
  calculatorServices: 'Maintain service options and prices used by the quote calculator.',
  redirects: 'Maintain the old and new addresses used for website redirects.',
  'onboarding-guides': 'Prepare the setup instructions used during client onboarding.',
  'onboarding-documents': 'Review client paperwork and onboarding files.',
  'journey-templates': 'Define reusable delivery steps for new client projects.',
  'client-journey-steps': 'Track the planned work and milestones for each client.',
  'job-roles': 'Maintain team roles and their responsibilities.',
  'terms-templates': 'Manage the agreement templates used for team members.',
  'member-terms': 'Review each member’s agreed terms and effective dates.',
  notifications: 'Review notifications created for workspace members.',
  comments: 'Review conversations attached to team work.',
  'audit-log': 'Review recorded changes and activity across the workspace.',
  campaignEvents: 'Review delivery, open, click and bounce events for email campaigns.',
}

type Section = { label: string; description?: string; names: string[] }

/** Unnamed tabs group existing top-level fields without creating data keys.
 * Unlisted fields stay visible in a final section, including future additions.
 * Sidebar and hidden fields retain their original placement and configuration.
 */
export function sectionFields(fields: Field[], sections: Section[]): Field[] {
  const fixed = fields.filter(
    (field) =>
      field.admin?.position === 'sidebar' ||
      (field.admin && 'hidden' in field.admin && field.admin.hidden),
  )
  const remaining = new Set(fields.filter((field) => !fixed.includes(field)))
  const tabs = sections.flatMap(({ names, ...section }) => {
    const selected = fields.filter(
      (field) =>
        'name' in field &&
        typeof field.name === 'string' &&
        names.includes(field.name) &&
        remaining.has(field),
    )
    selected.forEach((field) => remaining.delete(field))
    return selected.length ? [{ ...section, fields: selected }] : []
  })
  if (remaining.size) tabs.push({ label: 'More details', fields: [...remaining] })
  return [{ type: 'tabs', tabs }, ...fixed]
}

export function workspaceCollection(collection: CollectionConfig): CollectionConfig {
  let fields = collection.fields
  if (collection.slug === 'blogPosts') {
    fields = fields.map((field) =>
      field.type === 'json' && field.name === 'body'
        ? { ...field, admin: { ...field.admin, readOnly: true } }
        : field,
    )
    fields = sectionFields(fields, [
      {
        label: 'Article',
        description: 'Write the article and the summary readers see in the blog listing.',
        names: ['title', 'slug', 'excerpt', 'content'],
      },
      { label: 'Media & details', names: ['coverImage', 'category', 'author', 'publishedAt'] },
      { label: 'Distribution', names: ['linkedInPost', 'seoDescription'] },
      {
        label: 'Legacy content',
        description: 'Previous article content is kept here for reference.',
        names: ['body'],
      },
    ])
  }
  if (collection.slug === 'emailCampaigns') {
    fields = sectionFields(fields, [
      {
        label: 'Message',
        names: ['subject', 'previewText', 'body', 'body_html', 'ctaText', 'ctaUrl'],
      },
      {
        label: 'Audience',
        description: 'Choose the saved audience before reviewing the send panel.',
        names: ['client', 'segment', 'status'],
      },
      { label: 'Delivery results', names: ['sendLog', 'stats'] },
    ])
  }
  const columns: Record<string, string[]> = {
    blogPosts: ['title', '_status', 'category', 'publishedAt', 'updatedAt'],
    pages: ['title', '_status', 'slug', 'updatedAt'],
    invoices: ['invoiceId', 'client', 'currency', 'status', 'dueDate'],
    emailCampaigns: ['subject', 'segment', 'status', 'sentAt', 'recipientCount'],
  }
  return {
    ...collection,
    fields,
    admin: {
      ...collection.admin,
      description: collection.admin?.description || descriptions[collection.slug],
      ...(columns[collection.slug] ? { defaultColumns: columns[collection.slug] } : {}),
    },
  }
}

export function workspaceGlobal(global: GlobalConfig): GlobalConfig {
  let fields = global.fields
  if (global.slug === 'siteSettings') {
    fields = sectionFields(fields, [
      {
        label: 'Business & contact',
        names: [
          'title',
          'description',
          'email',
          'address',
          'whatsappNumber',
          'whatsappMessage',
          'socialLinks',
        ],
      },
      {
        label: 'Navigation & footer',
        names: ['navLinks', 'footerTagline', 'footerLinks', 'clientLogos', 'certifications'],
      },
      { label: 'Payments', names: ['bankDetails', 'enablePaystack'] },
      { label: 'Analytics', names: ['analytics'] },
    ])
  }
  if (global.slug === 'homepage') {
    fields = sectionFields(fields, [
      {
        label: 'Hero & introduction',
        names: [
          'heroPresentation',
          'heroHeadline',
          'heroTagline',
          'heroSubheadline',
          'heroEyebrow',
          'heroServices',
        ],
      },
      {
        label: 'Trust & highlights',
        names: ['showStats', 'trustHighlights', 'riskReversal', 'promoSections'],
      },
      { label: 'Founder', names: ['founderTitle', 'founderText', 'founderImage'] },
      {
        label: 'Contact & newsletter',
        names: [
          'newsletterHeading',
          'newsletterSubheading',
          'contactHeading',
          'contactSubheading',
          'contactInfoTitle',
          'contactInfoText',
          'contactWhatsappButtonText',
          'contactSubmitButtonText',
          'contactFormSuccessMessage',
        ],
      },
    ])
  }
  return { ...global, fields }
}
