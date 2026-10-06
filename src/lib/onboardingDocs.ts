import { renderAgreementPdf, type AgreementBlock } from './agreementPdf'
import {
  Document, Packer, Paragraph, TextRun, type Table,
  HeadingLevel, AlignmentType,
} from 'docx'

/*
  The documents a new client is sent when they are Won: the Service Agreement
  and the Setup Instructions (the Welcome Pack is lib/welcomePackPdf.ts).
  Written from the client's service and what was agreed on their deal.

  Kept apart from the onboarding route (pages/api/client-won.ts), which sends
  them, so they can be rendered and checked without sending anything
  (cms/tests/int/onboarding-docs.int.spec.ts).
*/

// ── Colours ───────────────────────────────────────────────────
const NAVY  = '0D1B6E'
const CYAN  = '00B4D8'
const LBLUE = 'E8F6FB'
const WHITE = 'FFFFFF'
const DARK  = '1A1A1A'
const GREY  = 'F5F5F5'

// ── Service labels ────────────────────────────────────────────
export const SERVICE: Record<string, string> = {
  'web-design':        'Web Design & Development',
  'digital-marketing': 'Digital Marketing',
  'branding':          'Branding & Identity',
  'video-production':  'AI Video & Reels',
  'seo-paid-ads':      'SEO & Paid Advertising',
  'social-media':      'Social Media Management',
  'multiple':          'Multiple Services',
  'custom':            'Custom Project',
}

export interface Customizations {
  duration?:          number   // contract months: default 3; 0 = one-off, no term
  revisions?:         number   // revision rounds: default 2
  platforms?:         string   // comma-separated e.g. "Facebook, Instagram"
  postsPerMonth?:     number   // for social media
  numberOfPages?:     number   // for web design
  extraDeliverables?: string   // newline-separated, appended to standard list
  paymentTerms?:      string   // overrides standard payment wording
  specialTerms?:      string   // extra clause appended to contract
  depositPercent?:    number   // e.g. 50 = 50% deposit required
}

export interface EmailNotes {
  welcome?:  string   // personal note in Welcome Pack email
  contract?: string   // personal note in Service Agreement email
  setup?:    string   // personal note in Setup Instructions email
  checkin?:  string   // personal note in week-one check-in email
}

export interface ClientData {
  currency?: string
  id?:             string
  businessName:    string
  contactName:     string
  email:           string
  phone?:          string
  service:         string
  package?:        string
  price?:          number
  startDate?:      string
  notes?:          string
  accessCode?:     string
  signOnline?:     boolean  // the agreement goes out to sign online (the CMS sends it), not as a PDF to return
  portalUrl?:      string
  customizations?: Customizations
  emailNotes?:     EmailNotes
}

// ── Date helpers ──────────────────────────────────────────────
export function fmtDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function addMonths(iso?: string, n = 3): string {
  const d = iso ? new Date(iso) : new Date()
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────
//  DOCUMENT 1: Service Agreement (Contract)
// ─────────────────────────────────────────────────────────────
export async function generateContract(c: ClientData): Promise<Buffer> {
  const cx         = c.customizations ?? {}
  const service    = SERVICE[c.service] ?? c.service
  const price      = c.price ? `${c.currency || 'GHS'} ${c.price.toLocaleString()}` : 'as mutually agreed'
  const startDate  = fmtDate(c.startDate)
  const duration   = cx.duration ?? 3
  const endDate    = addMonths(c.startDate, duration)
  const today      = fmtDate()
  const revisions  = cx.revisions ?? 2

  // A one-off engagement is signalled by duration: 0. That is an existing CMS field,
  // and 0 months is already meaningless as a retainer term, so this needs no
  // new column and no migration. Without it every contract was a monthly
  // retainer with a 3-month minimum and 30 days notice, which flatly
  // contradicts the products sold as one-off: the Reel Pack promises "no
  // subscription and no commitment", and the landing-page and logo tiers are
  // single projects too. Anyone buying those was sent the wrong paperwork.
  const isOneOff = cx.duration === 0
  const deposit  = cx.depositPercent && c.price
    ? `${c.currency || 'GHS'} ${(c.price * cx.depositPercent / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '-'

  // Build payment wording
  const paymentWording = cx.paymentTerms
    ? cx.paymentTerms
    : isOneOff
      ? cx.depositPercent
        ? `A ${cx.depositPercent}% deposit (${deposit}) of the one-off fee of ${price} is due before work commences. The remaining balance is due on delivery of the final files. There is no recurring charge.`
        : `The Client agrees to pay Quadem Digital a one-off fee of ${price} for the services outlined in Section 1. There is no recurring charge.`
      : cx.depositPercent
        ? `${cx.depositPercent}% deposit (${deposit}) is due before work commences. The remaining balance is due on completion. Thereafter, a monthly retainer of ${price}/month applies.`
        : `The Client agrees to pay Quadem Digital a monthly retainer of ${price}/month for the services outlined in Section 1.`

  // Extra deliverables from CMS
  const extraDeliverables: string[] = cx.extraDeliverables
    ? cx.extraDeliverables.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  // Platform override for relevant services
  const platformNote = cx.platforms ? ` (${cx.platforms})` : ''

  // Deliverables per service
  const deliverables: Record<string, string[]> = {
    'web-design': [
      `Custom website design (${cx.numberOfPages ? `${cx.numberOfPages} pages` : 'up to agreed number of pages'})`,
      'Mobile-responsive layout',
      'Basic SEO setup (meta tags, sitemap, robots.txt)',
      'Contact form integration',
      `Up to ${revisions} round${revisions === 1 ? '' : 's'} of revisions`,
      'Handover of source files and credentials upon full payment',
    ],
    'digital-marketing': [
      `Monthly social media content creation and scheduling${platformNote}`,
      'Paid advertising campaign setup and management',
      'Monthly performance report',
      'Audience targeting and optimization',
      'Ad creative design (static)',
    ],
    'branding': [
      'Logo design (primary + variants)',
      'Brand colour palette and typography guide',
      'Business card design',
      'Brand style guide (PDF)',
      `Up to three concept directions with ${revisions} revision round${revisions === 1 ? '' : 's'}`,
    ],
    'video-production': [
      'Script and hook development for each video, approved by the Client before production',
      'AI-generated video produced from Client-supplied brand assets and product imagery (no filming, no on-location shoot and no crew are included in this engagement)',
      'Editing, burned-in captions, brand overlay and licensed music or AI voiceover',
      `Up to ${revisions} revision round${revisions === 1 ? '' : 's'} per video, at script stage and on the final cut`,
      'Delivery in the agreed aspect ratios (9:16, 1:1 and 16:9) as MP4',
      'Full commercial usage rights, including paid advertising, transferring to the Client on final payment',
      'Any likeness of the Client or its staff used only under separate written consent supplied by the Client',
    ],
    'seo-paid-ads': [
      'Keyword research and strategy',
      'On-page SEO implementation',
      'Monthly paid ad campaign management (Meta / Google)',
      'Monthly analytics and performance report',
      'Landing page recommendations',
    ],
    'social-media': [
      `${cx.postsPerMonth ? `${cx.postsPerMonth} posts per month` : 'Monthly content calendar (agreed number of posts)'}${platformNote}`,
      'Content creation (graphics + captions)',
      'Scheduling and publishing',
      'Community management (comments and DMs, business hours)',
      'Monthly performance report',
    ],
    'multiple': [
      'The services set out in the accepted proposal or quotation',
      // A one-off has nothing to report on monthly.
      ...(isOneOff ? [] : ['Monthly reporting covering all active services']),
      'Dedicated point of contact throughout the engagement',
    ],
    // A custom project has no standard list: its scope is exactly what was quoted.
    'custom': [],
  }

  const isCustom = c.service === 'custom'
  const serviceDeliverables = isCustom
    ? [
        ...(extraDeliverables.length ? extraDeliverables : ['The work described in the accepted quotation']),
        `Up to ${revisions} round${revisions === 1 ? '' : 's'} of revisions on the agreed work`,
      ]
    : [
        ...(deliverables[c.service] ?? deliverables['multiple']),
        ...extraDeliverables,  // append any custom deliverables from CMS
      ]

  const h1 = (text: string): AgreementBlock => ({ kind: 'title', text })
  const h2 = (text: string): AgreementBlock => ({ kind: 'heading', text })
  const body = (text: string, opts: { bold?: boolean; italics?: boolean } = {}): AgreementBlock => ({ kind: 'paragraph', text, bold: opts.bold })
  const bullet = (text: string): AgreementBlock => ({ kind: 'bullet', text })
  const blocks: AgreementBlock[] = [
        // Parties
        h1('SERVICE AGREEMENT'),
        body(`This Service Agreement ("Agreement") is entered into as of ${today} between:`),
        { kind: 'space' },
        body('Quadem Digital Enterprise', { bold: true }),
        body('Ernest Avorwlanu, Founder'),
        body('Email: ernest@quademdigital.com | Website: quademdigital.com'),
        body('(hereinafter referred to as "Quadem Digital" or "Service Provider")'),
        { kind: 'space' },
        body('AND'),
        { kind: 'space' },
        body(c.businessName, { bold: true }),
        body(`Contact: ${c.contactName}`),
        body(`Email: ${c.email}${c.phone ? ` | Phone: ${c.phone}` : ''}`),
        body('(hereinafter referred to as "the Client")'),

        // Services
        h2('1. SERVICES'),
        body(`Quadem Digital agrees to provide the following services to the Client:`),
        body(service, { bold: true }),
        ...(c.package ? [body(`Package: ${c.package}`, { italics: true })] : []),
        { kind: 'space' },
        body(isCustom ? 'The work covered by this Agreement is:' : 'Scope of deliverables includes:', { bold: true }),
        ...serviceDeliverables.map(bullet),
        ...(isCustom ? [body('Anything not listed above is outside the scope of this Agreement and will be quoted separately if requested.')] : []),

        // Term
        h2('2. TERM'),
        ...(isOneOff
          ? [
              body(`This Agreement covers a single, one-off engagement commencing on ${startDate}. It ends when the deliverables in Section 1 have been delivered and accepted by the Client.`),
              body('There is no minimum term, no recurring fee and no notice period. Any further work is quoted and agreed separately.'),
            ]
          : [
              body(`This Agreement commences on ${startDate} and continues for an initial term of ${duration} ${duration === 1 ? 'month' : 'months'}, ending on ${endDate}, unless terminated earlier in accordance with Section 6 below.`),
              body('After the initial term, this Agreement renews on a month-to-month basis unless either party provides 30 days written notice of termination.'),
            ]),

        // Payment
        h2('3. PAYMENT'),
        body(paymentWording),
        body(isOneOff
          ? 'Invoices are issued through the agreed billing system and are payable on receipt.'
          : 'Payment is due on the 1st of each month. Invoices are issued separately through the agreed billing system.'),
        body('A delay of more than 10 business days in payment may result in a pause in service delivery until the outstanding balance is settled.'),
        body('All fees are exclusive of applicable taxes.'),

        // Client responsibilities
        h2('4. CLIENT RESPONSIBILITIES'),
        body('To enable Quadem Digital to deliver the agreed services effectively, the Client agrees to:'),
        ...([
          'Provide all required brand assets (logos, photos, content) within 7 days of signing',
          'Grant necessary platform and account access promptly upon request',
          'Respond to approval requests and feedback within 48 business hours',
          'Designate a single point of contact for all communication',
          'Provide accurate and complete information required to perform the services',
        ]).map(bullet),

        // Intellectual property
        h2('5. INTELLECTUAL PROPERTY'),
        body('All work product created by Quadem Digital remains the property of Quadem Digital until full payment has been received, at which point ownership transfers to the Client.'),
        body('The Client grants Quadem Digital the right to use completed work in its portfolio and for promotional purposes unless the Client requests otherwise in writing.'),

        // Termination
        h2('6. TERMINATION'),
        body(isOneOff
          // A 30-day notice period is meaningless on an engagement that ends at
          // delivery, and reads as a commitment the sales page says isn't there.
          ? 'Either party may cancel this Agreement in writing before the work is delivered.'
          : 'Either party may terminate this Agreement by providing 30 days written notice to the other party.'),
        body('In the event of termination, the Client remains liable for payment of all services rendered up to the termination date.'),
        body('Quadem Digital reserves the right to terminate immediately in cases of non-payment exceeding 30 days or conduct that is harmful to the business relationship.'),

        // Confidentiality
        h2('7. CONFIDENTIALITY'),
        body('Both parties agree to keep confidential any proprietary or sensitive information shared during the course of this engagement and not to disclose it to third parties without prior written consent.'),

        // Limitation of liability
        h2('8. LIMITATION OF LIABILITY'),
        body("Quadem Digital's total liability under this Agreement shall not exceed the total fees paid by the Client in the three (3) months prior to the claim. Quadem Digital shall not be liable for indirect, consequential, or incidental damages."),

        // Special terms (only if customized)
        ...(cx.specialTerms ? [
          h2('9. SPECIAL TERMS'),
          body(cx.specialTerms),
          // Governing law becomes section 10
          h2('10. GOVERNING LAW'),
          body('This Agreement is governed by the laws of the Republic of Ghana. Any disputes shall first be attempted to be resolved through good-faith negotiation between the parties.'),
          h2('11. SIGNATURES'),
        ] : [
          // No special terms: standard numbering
          h2('9. GOVERNING LAW'),
          body('This Agreement is governed by the laws of the Republic of Ghana. Any disputes shall first be attempted to be resolved through good-faith negotiation between the parties.'),
          h2('10. SIGNATURES'),
        ]),
        body('By signing below, both parties agree to be bound by the terms of this Agreement.'),
        { kind: 'space' },
        { kind: 'signatures' },
  ]
  return renderAgreementPdf(c.businessName, blocks)
}

// ─────────────────────────────────────────────────────────────
//  DOCUMENT 2: Welcome Pack
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  DOCUMENT 3: Service-Specific Setup Instructions
// ─────────────────────────────────────────────────────────────

export const SETUP_ITEMS: Record<string, { section: string; items: string[] }[]> = {
  'web-design': [
    {
      section: 'Domain & Hosting Access',
      items: [
        'Login credentials for your domain registrar (e.g. GoDaddy, Namecheap)',
        'Login credentials for your hosting provider (if already set up)',
        'Confirmation of your preferred domain name (if new)',
      ],
    },
    {
      section: 'Brand Assets',
      items: [
        'Logo file(s) in PNG or SVG format (high-resolution)',
        'Brand colour codes (HEX or RGB) if you have them',
        'Brand font names if you have an existing style',
      ],
    },
    {
      section: 'Content',
      items: [
        'Written content for each page (Home, About, Services, Contact minimum)',
        'Professional photos or images you want used (high-resolution JPG/PNG)',
        'Any existing social media links to include',
      ],
    },
    {
      section: 'References',
      items: [
        'Links to 2–3 websites whose design or style you like',
        'Notes on what you like about each (layout, colours, feel)',
      ],
    },
  ],
  'digital-marketing': [
    {
      section: 'Facebook / Meta Access',
      items: [
        'Admin access to your Facebook Business Manager',
        'Admin access to your Facebook Page',
        'Access to your Meta Ads account (or confirm if we are creating one)',
      ],
    },
    {
      section: 'Ad Budget',
      items: [
        'Monthly ad spend budget (separate from the management fee)',
        'Preferred payment method for ads (credit card added to Meta Ads)',
        'Confirmation of primary campaign objective (leads / traffic / awareness)',
      ],
    },
    {
      section: 'Brand Assets',
      items: [
        'Logo and brand images for ad creatives',
        'Any existing ad creatives you want reused or refreshed',
      ],
    },
    {
      section: 'Target Audience',
      items: [
        'Describe your ideal customer (age, location, interests, profession)',
        'List your top 3 products or services to promote',
        'Any audiences or competitors you want to target',
      ],
    },
  ],
  'branding': [
    {
      section: 'Business Information',
      items: [
        'Full business name and any taglines you use',
        'Industry and main services/products',
        'Your target customer profile',
        'Key values and what makes you different from competitors',
      ],
    },
    {
      section: 'Visual Preferences',
      items: [
        'Colour preferences or colours to avoid',
        'Style preference (modern, classic, bold, minimal, playful)',
        '3–5 brand/logo examples you like and why',
        '3–5 brand/logo examples you dislike and why',
      ],
    },
    {
      section: 'Existing Assets',
      items: [
        'Any existing logo files (even if being replaced)',
        'Existing brand colours or fonts if known',
        'Photos of your physical space, products, or team (optional)',
      ],
    },
  ],
  'video-production': [
    {
      section: 'The Brief',
      items: [
        'What each video needs to do (sell a product, announce an offer, explain a service, build awareness)',
        'Who you are talking to and where the video will be posted (Instagram, TikTok, YouTube, WhatsApp Status)',
        'The offer or call to action you want at the end',
        'Any script, talking points or captions you have already written (or confirm you want us to write them)',
      ],
    },
    {
      section: 'Brand Assets',
      items: [
        'Logo file(s) in PNG or SVG format (high-resolution, transparent background if possible)',
        'Brand colour codes (HEX or RGB) and brand font names if you have them',
        'Product photos, the more angles and the higher the resolution the better',
        'Any music preferences (genre or mood), or confirm we should pick licensed tracks',
      ],
    },
    {
      section: 'Voice & Likeness',
      items: [
        'Whether you want an AI presenter on screen, a voiceover only, or captions only',
        'Preferred voice (accent, gender, energy) or an example video whose voice you like',
        'If you want your own face or voice used, a signed consent form and the reference photos or recordings (we send the form, nothing is used without it)',
      ],
    },
    {
      section: 'References',
      items: [
        'Links to 2-3 reels or ads whose style you like, with a note on what you like about each',
        'Anything you definitely do not want (styles, claims, competitors, words to avoid)',
        'Your social handles, so we can match what already works on your page',
      ],
    },
  ],
  'seo-paid-ads': [
    {
      section: 'Website Access',
      items: [
        'Access to your website CMS (WordPress admin, etc.)',
        'Google Search Console access (or confirm if we are setting up)',
        'Google Analytics access (or confirm if we are setting up)',
      ],
    },
    {
      section: 'Google Ads Access',
      items: [
        'Google Ads account access (or confirm if we are creating one)',
        'Monthly Google Ads budget (separate from management fee)',
        'Preferred billing method for Google Ads',
      ],
    },
    {
      section: 'Business & Audience',
      items: [
        'List of your top 5–10 products or services to prioritise',
        'Your main geographic target area (city, region, national)',
        'Top 3 competitors you know of',
        '3–5 keywords you believe your customers search for',
      ],
    },
  ],
  'social-media': [
    {
      section: 'Platform Access',
      items: [
        'Facebook Page admin access (add ernest@quademdigital.com as Editor)',
        'Instagram account login or add as collaborator',
        'LinkedIn Company Page admin access (if applicable)',
        'TikTok account login (if applicable)',
        'Google Business Profile access (if applicable)',
      ],
    },
    {
      section: 'Brand Assets',
      items: [
        'Logo in PNG format (transparent background preferred)',
        'Brand colour codes (HEX)',
        'Brand font names (if specific fonts are used)',
        'Any existing post templates or designs you want maintained',
      ],
    },
    {
      section: 'Content Direction',
      items: [
        'List of services/products you want to promote first',
        'Tone of voice (professional, friendly, bold, informative)',
        'Content topics to always include',
        'Content topics or themes to avoid',
        'Any upcoming events, promotions, or launches to plan content around',
      ],
    },
    {
      section: 'Approval Process',
      items: [
        'Confirm who approves content before posting',
        'Preferred approval method (WhatsApp, email, or content calendar link)',
        'Target response time for approvals (we recommend 48 hours)',
      ],
    },
  ],
  'multiple': [
    {
      section: 'General Setup',
      items: [
        'We confirm exactly what each service needs on our kick-off call',
        'Where we need access to an account, send an invitation to ernest@quademdigital.com rather than a password',
      ],
    },
    {
      section: 'Brand Assets (All Services)',
      items: [
        'Logo in PNG or SVG format (high-resolution)',
        'Brand colour codes (HEX)',
        'Brand font names',
        'Any brand guidelines document you already have',
      ],
    },
  ],
  'custom': [
    {
      section: 'Brand Assets',
      items: [
        'Logo file(s) in PNG or SVG format (high-resolution)',
        'Brand colour codes (HEX) and font names, if you have them',
      ],
    },
    {
      section: 'What We Agree on Our Kick-off Call',
      items: [
        'Anything we agree you will send: content, files, examples or account access',
        'Where we need access to an account, send an invitation to ernest@quademdigital.com rather than a password',
      ],
    },
  ],
}

export async function generateSetupInstructions(c: ClientData): Promise<Buffer> {
  const cx      = c.customizations ?? {}
  const service = SERVICE[c.service] ?? c.service

  // For social media: if specific platforms provided, filter the Platform Access
  // section to only list what's agreed
  let baseSections = SETUP_ITEMS[c.service] ?? SETUP_ITEMS['multiple']

  if (c.service === 'social-media' && cx.platforms) {
    const agreedPlatforms = cx.platforms.toLowerCase()
    const platformMap: Record<string, string[]> = {
      facebook:   ['Facebook Page admin access (add ernest@quademdigital.com as Editor)'],
      instagram:  ['Instagram account login or add as collaborator'],
      linkedin:   ['LinkedIn Company Page admin access'],
      tiktok:     ['TikTok account login'],
      google:     ['Google Business Profile access'],
    }
    const platformItems: string[] = []
    for (const [key, items] of Object.entries(platformMap)) {
      if (agreedPlatforms.includes(key)) platformItems.push(...items)
    }
    baseSections = baseSections.map(s =>
      s.section === 'Platform Access'
        ? { section: 'Platform Access', items: platformItems.length ? platformItems : s.items }
        : s
    )
  }

  // What was agreed to deliver is listed as what the client receives, never as
  // boxes for them to tick: it is our work, not something they send.
  const extraItems = cx.extraDeliverables
    ? cx.extraDeliverables.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  const sections: { section: string; items: string[]; receive?: boolean }[] = extraItems.length
    ? [...baseSections, { section: 'What You Will Receive', items: extraItems, receive: true }]
    : baseSections

  const checkRow = (text: string, mark = '☐') => new Paragraph({
    children: [
      new TextRun({ text: `${mark}  `, bold: true, color: NAVY, size: 22, font: 'Calibri' }),
      new TextRun({ text, size: 22, font: 'Calibri', color: DARK }),
    ],
    spacing: { before: 80, after: 80 },
    indent: { left: 360 },
  })

  const children: (Paragraph | Table)[] = [
    // Header
    new Paragraph({
      children: [new TextRun({ text: 'QUADEM DIGITAL ENTERPRISE', bold: true, color: WHITE, size: 28, font: 'Calibri' })],
      shading: { fill: NAVY }, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Setup Instructions', color: CYAN, size: 22, font: 'Calibri' })],
      shading: { fill: NAVY }, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 },
    }),

    new Paragraph({
      children: [new TextRun({ text: `Setup Instructions: ${service}`, bold: true, color: NAVY, size: 30, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Prepared for: ${c.businessName} | ${c.contactName}`, italics: true, color: NAVY, size: 20, font: 'Calibri' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${fmtDate()}`, italics: true, color: NAVY, size: 20, font: 'Calibri' })],
      spacing: { after: 320 },
    }),

    new Paragraph({
      children: [new TextRun({
        text: `To get started as quickly as possible, please gather and send us the items listed below. You can share files via WhatsApp, email (ernest@quademdigital.com), or Google Drive. Tick each box as you complete it.`,
        size: 22, font: 'Calibri', color: DARK,
      })],
      spacing: { after: 320 },
    }),
  ]

  // Add each section
  for (const { section, items, receive } of sections) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: section, bold: true, color: WHITE, size: 22, font: 'Calibri' })],
        shading: { fill: NAVY },
        spacing: { before: 280, after: 80 },
      })
    )
    for (const item of items) {
      children.push(checkRow(item, receive ? '•' : '☐'))
    }
  }

  // Deadline note
  children.push(
    new Paragraph({ spacing: { before: 320 } }),
    new Paragraph({
      children: [new TextRun({
        text: 'Please aim to send all items within 5 business days so we can begin on schedule. If anything is unclear or unavailable, just let us know and we can guide you through it.',
        size: 22, font: 'Calibri', color: DARK, italics: true,
      })],
      shading: { fill: LBLUE },
      spacing: { before: 160, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Ernest Avorwlanu  |  ernest@quademdigital.com  |  quademdigital.com', italics: true, color: NAVY, size: 18, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 320 }, shading: { fill: LBLUE },
    })
  )

  const doc = new Document({
    creator: 'Quadem Digital Enterprise',
    title:   `Setup Instructions: ${c.businessName}`,
    sections: [{ properties: {}, children }],
  })

  return Packer.toBuffer(doc)
}
