// ─────────────────────────────────────────────────────────────
//  QUADEM DIGITAL — Client Won Handler
//  Place at: src/pages/api/client-won.ts
//
//  Called by Payload CMS when a client status → "won"
//  Sends three documents to the client via Resend:
//    1. Service Agreement (contract)
//    2. Welcome Pack
//    3. Service-specific Setup Instructions
//
//  Also notifies Ernest with a summary + quick-reply links.
// ─────────────────────────────────────────────────────────────

import type { APIRoute } from 'astro'
import { escapeHtml } from '../../lib/html'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, TableBorders, BorderStyle,
  UnderlineType,
} from 'docx'

// ── Env vars ──────────────────────────────────────────────────
const RESEND_API_KEY  = import.meta.env.RESEND_API_KEY
const ERNEST_EMAIL    = import.meta.env.ERNEST_EMAIL    ?? 'ernest@quademdigital.com'
const RESEND_AUDIENCE = import.meta.env.RESEND_AUDIENCE_ID ?? '6f7f906d-e7ff-4217-b425-1e15eb61e099'
const WEBHOOK_SECRET  = import.meta.env.CMS_WEBHOOK_SECRET

// ── Email delivery timing ─────────────────────────────────────
// Documents are generated once but delivered at staggered times so
// the client can read each one before the next arrives.
// Override these in .env if you want different intervals.
const CONTRACT_DELAY_HOURS = Number(import.meta.env.CONTRACT_DELAY_HOURS ?? 2)    // default 2h
const SETUP_DELAY_HOURS    = Number(import.meta.env.SETUP_DELAY_HOURS    ?? 24)   // default 24h
const CHECKIN_DELAY_HOURS  = Number(import.meta.env.CHECKIN_DELAY_HOURS  ?? 168)  // default 7 days

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString()
}

// ── Colours ───────────────────────────────────────────────────
const NAVY  = '0D1B6E'
const CYAN  = '00B4D8'
const LBLUE = 'E8F6FB'
const WHITE = 'FFFFFF'
const DARK  = '1A1A1A'
const GREY  = 'F5F5F5'

// ── Service labels ────────────────────────────────────────────
const SERVICE: Record<string, string> = {
  'web-design':        'Web Design & Development',
  'digital-marketing': 'Digital Marketing',
  'branding':          'Branding & Identity',
  'video-production':  'Video Production',
  'seo-paid-ads':      'SEO & Paid Advertising',
  'social-media':      'Social Media Management',
  'multiple':          'Multiple Services',
}

interface Customizations {
  duration?:          number   // contract months — default 3
  revisions?:         number   // revision rounds — default 2
  platforms?:         string   // comma-separated e.g. "Facebook, Instagram"
  postsPerMonth?:     number   // for social media
  numberOfPages?:     number   // for web design
  extraDeliverables?: string   // newline-separated, appended to standard list
  paymentTerms?:      string   // overrides standard payment wording
  specialTerms?:      string   // extra clause appended to contract
  depositPercent?:    number   // e.g. 50 = 50% deposit required
}

interface EmailNotes {
  welcome?:  string   // personal note in Welcome Pack email
  contract?: string   // personal note in Service Agreement email
  setup?:    string   // personal note in Setup Instructions email
  checkin?:  string   // personal note in week-one check-in email
}

interface ClientData {
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
  portalUrl?:      string
  customizations?: Customizations
  emailNotes?:     EmailNotes
}

// ── Date helpers ──────────────────────────────────────────────
function fmtDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function addMonths(iso?: string, n = 3): string {
  const d = iso ? new Date(iso) : new Date()
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────
//  DOCUMENT 1 — Service Agreement (Contract)
// ─────────────────────────────────────────────────────────────
async function generateContract(c: ClientData): Promise<Buffer> {
  const cx         = c.customizations ?? {}
  const service    = SERVICE[c.service] ?? c.service
  const price      = c.price ? `GH₵ ${c.price.toLocaleString()}` : 'as mutually agreed'
  const startDate  = fmtDate(c.startDate)
  const duration   = cx.duration ?? 3
  const endDate    = addMonths(c.startDate, duration)
  const today      = fmtDate()
  const revisions  = cx.revisions ?? 2

  // Build payment wording
  const paymentWording = cx.paymentTerms
    ? cx.paymentTerms
    : cx.depositPercent
      ? `${cx.depositPercent}% deposit (GH₵ ${c.price ? Math.round(c.price * cx.depositPercent / 100).toLocaleString() : '—'}) is due before work commences. The remaining balance is due on completion. Thereafter, a monthly retainer of ${price}/month applies.`
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
      'Pre-production planning and scripting support',
      'Professional video shoot (agreed duration)',
      'Post-production editing including colour grading and music',
      `Up to ${revisions} revision round${revisions === 1 ? '' : 's'} on the final edit`,
      'Delivery in agreed format(s)',
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
      'Community management (comments and DMs — business hours)',
      'Monthly performance report',
    ],
    'multiple': [
      'Services as detailed in the agreed proposal document',
      'Monthly reporting covering all active services',
      'Dedicated point of contact throughout the engagement',
    ],
  }

  const serviceDeliverables = [
    ...(deliverables[c.service] ?? deliverables['multiple']),
    ...extraDeliverables,  // append any custom deliverables from CMS
  ]

  const h1 = (text: string) => new Paragraph({
    children: [new TextRun({ text, bold: true, color: NAVY, size: 28, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
  })

  const h2 = (text: string) => new Paragraph({
    children: [new TextRun({ text, bold: true, color: NAVY, size: 24, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
  })

  const body = (text: string, opts: { color?: string; italics?: boolean; bold?: boolean } = {}) =>
    new Paragraph({
      children: [new TextRun({
        text,
        size: 22,
        font: 'Calibri',
        color: opts.color ?? DARK,
        italics: opts.italics,
        bold: opts.bold,
      })],
      spacing: { before: 60, after: 100 },
    })

  const bullet = (text: string) => new Paragraph({
    children: [
      new TextRun({ text: '•  ', bold: true, color: CYAN, size: 22, font: 'Calibri' }),
      new TextRun({ text, size: 22, font: 'Calibri', color: DARK }),
    ],
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
  })

  const signatureRow = (label: string) => new TableRow({ children: [
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: NAVY })] })],
      shading: { fill: LBLUE },
      width: { size: 30, type: WidthType.PERCENTAGE },
    }),
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: '', size: 20, font: 'Calibri' })] })],
      width: { size: 70, type: WidthType.PERCENTAGE },
    }),
  ]})

  const doc = new Document({
    creator: 'Quadem Digital Enterprise',
    title:   `Service Agreement — ${c.businessName}`,
    sections: [{
      properties: {},
      children: [

        // Header banner
        new Paragraph({
          children: [new TextRun({ text: 'QUADEM DIGITAL ENTERPRISE', bold: true, color: WHITE, size: 28, font: 'Calibri' })],
          shading: { fill: NAVY }, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Service Agreement', color: CYAN, size: 22, font: 'Calibri' })],
          shading: { fill: NAVY }, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 },
        }),

        // Parties
        h1('SERVICE AGREEMENT'),
        body(`This Service Agreement ("Agreement") is entered into as of ${today} between:`),
        new Paragraph({ spacing: { before: 120, after: 60 } }),
        body('Quadem Digital Enterprise', { bold: true }),
        body('Ernest Avorwlanu, Founder'),
        body('Email: ernest@quademdigital.com | Website: quademdigital.com'),
        body('(hereinafter referred to as "Quadem Digital" or "Service Provider")'),
        new Paragraph({ spacing: { before: 120, after: 60 } }),
        body('AND'),
        new Paragraph({ spacing: { before: 60, after: 60 } }),
        body(c.businessName, { bold: true }),
        body(`Contact: ${c.contactName}`),
        body(`Email: ${c.email}${c.phone ? ` | Phone: ${c.phone}` : ''}`),
        body('(hereinafter referred to as "the Client")'),

        // Services
        h2('1. SERVICES'),
        body(`Quadem Digital agrees to provide the following services to the Client:`),
        body(service, { bold: true }),
        ...(c.package ? [body(`Package: ${c.package}`, { italics: true })] : []),
        new Paragraph({ spacing: { before: 80 } }),
        body('Scope of deliverables includes:', { bold: true }),
        ...serviceDeliverables.map(bullet),

        // Term
        h2('2. TERM'),
        body(`This Agreement commences on ${startDate} and continues for an initial term of ${duration} ${duration === 1 ? 'month' : 'months'}, ending on ${endDate}, unless terminated earlier in accordance with Section 6 below.`),
        body('After the initial term, this Agreement renews on a month-to-month basis unless either party provides 30 days written notice of termination.'),

        // Payment
        h2('3. PAYMENT'),
        body(paymentWording),
        body('Payment is due on the 1st of each month. Invoices are issued separately through the agreed billing system.'),
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
        body('Either party may terminate this Agreement by providing 30 days written notice to the other party.'),
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
          // No special terms — standard numbering
          h2('9. GOVERNING LAW'),
          body('This Agreement is governed by the laws of the Republic of Ghana. Any disputes shall first be attempted to be resolved through good-faith negotiation between the parties.'),
          h2('10. SIGNATURES'),
        ]),
        body('By signing below, both parties agree to be bound by the terms of this Agreement.'),
        new Paragraph({ spacing: { before: 240 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: TableBorders.NONE,
          rows: [
            signatureRow('Service Provider Signature'),
            signatureRow('Name'),
            signatureRow('Date'),
            signatureRow('Client Signature'),
            signatureRow('Name'),
            signatureRow('Date'),
          ],
        }),

        // Footer note
        new Paragraph({
          children: [new TextRun({ text: 'Quadem Digital Enterprise | ernest@quademdigital.com | quademdigital.com', italics: true, color: NAVY, size: 18, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 480 },
          shading: { fill: LBLUE },
        }),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

// ─────────────────────────────────────────────────────────────
//  DOCUMENT 2 — Welcome Pack
// ─────────────────────────────────────────────────────────────
async function generateWelcomePack(c: ClientData): Promise<Buffer> {
  const cx      = c.customizations ?? {}
  const service = SERVICE[c.service] ?? c.service
  const price   = c.price ? `GH₵ ${c.price.toLocaleString()}/month` : 'As agreed'

  // Build a concise scope line for the summary table
  const scopeParts: string[] = [service]
  if (cx.platforms)     scopeParts.push(cx.platforms)
  if (cx.postsPerMonth) scopeParts.push(`${cx.postsPerMonth} posts/month`)
  if (cx.numberOfPages) scopeParts.push(`${cx.numberOfPages} pages`)
  const scopeLine = scopeParts.join(' — ')

  const doc = new Document({
    creator: 'Quadem Digital Enterprise',
    title:   `Welcome Pack — ${c.businessName}`,
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'QUADEM DIGITAL ENTERPRISE', bold: true, color: WHITE, size: 28, font: 'Calibri' })],
          shading: { fill: NAVY }, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Client Welcome Pack', color: CYAN, size: 22, font: 'Calibri' })],
          shading: { fill: NAVY }, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 },
        }),

        new Paragraph({
          children: [new TextRun({ text: `Welcome, ${c.contactName}`, bold: true, color: NAVY, size: 32, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `Thank you for choosing Quadem Digital Enterprise. We are thrilled to partner with ${c.businessName} and help you grow your digital presence. This welcome pack has everything you need to hit the ground running.`,
            size: 22, font: 'Calibri', color: DARK,
          })],
          spacing: { after: 320 },
        }),

        // Summary table
        new Paragraph({
          children: [new TextRun({ text: 'Your Project Summary', bold: true, color: NAVY, size: 24, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 160 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: TableBorders.NONE,
          rows: [
            ['Business',    c.businessName],
            ['Contact',     c.contactName],
            ['Email',       c.email],
            ['Phone',       c.phone || 'Not provided'],
            ['Service',     scopeLine],
            ['Package',     c.package || service],
            ['Monthly Fee', cx.paymentTerms || (cx.depositPercent ? `${cx.depositPercent}% deposit then ${price}` : price)],
            ['Start Date',  fmtDate(c.startDate)],
          ].map(([label, value], i) =>
            new TableRow({ children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: WHITE, size: 20, font: 'Calibri' })] })],
                shading: { fill: i % 2 === 0 ? NAVY : '1A2B7A' },
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Calibri', color: DARK })] })],
                shading: { fill: i % 2 === 0 ? LBLUE : WHITE },
                width: { size: 70, type: WidthType.PERCENTAGE },
              }),
            ]})
          ),
        }),

        // Next steps
        new Paragraph({
          children: [new TextRun({ text: 'What Happens Next', bold: true, color: NAVY, size: 24, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 160 },
        }),
        ...[
          'Sign and return the enclosed Service Agreement at your earliest convenience.',
          'Complete the Setup Instructions document (also attached) and send back the required access and assets.',
          'We will schedule an onboarding call within 48 hours to walk you through the process.',
          'You will be added to our client WhatsApp group for quick communication.',
          'Work begins on your agreed start date.',
        ].map((step, i) =>
          new Paragraph({
            children: [
              new TextRun({ text: `${i + 1}.  `, bold: true, color: CYAN, size: 22, font: 'Calibri' }),
              new TextRun({ text: step, size: 22, font: 'Calibri', color: DARK }),
            ],
            spacing: { before: 80, after: 80 },
          })
        ),

        // Contact
        new Paragraph({
          children: [new TextRun({ text: 'Your Point of Contact', bold: true, color: NAVY, size: 24, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 160 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Ernest Avorwlanu  |  Founder, Quadem Digital Enterprise', bold: true, size: 22, font: 'Calibri', color: NAVY })],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'ernest@quademdigital.com  |  quademdigital.com', size: 20, font: 'Calibri', color: DARK })],
          spacing: { after: 320 },
        }),

        new Paragraph({
          children: [new TextRun({ text: 'We look forward to doing great work together.', italics: true, color: NAVY, size: 22, font: 'Calibri' })],
          alignment: AlignmentType.CENTER, spacing: { before: 480 }, shading: { fill: LBLUE },
        }),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

// ─────────────────────────────────────────────────────────────
//  DOCUMENT 3 — Service-Specific Setup Instructions
// ─────────────────────────────────────────────────────────────

const SETUP_ITEMS: Record<string, { section: string; items: string[] }[]> = {
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
      section: 'Pre-Production',
      items: [
        'Purpose of the video (promo, testimonial, explainer, event coverage)',
        'Target audience and where the video will be published',
        'Desired video length',
        'Key messages or talking points to include',
        'Script or talking points (or confirm if scriptwriting is included)',
      ],
    },
    {
      section: 'Logistics',
      items: [
        'Shoot location (your premises, our studio, or on-location)',
        'Preferred shoot dates and times',
        'Number of people appearing on camera',
        'Any props, products, or materials needed on set',
      ],
    },
    {
      section: 'Brand Assets',
      items: [
        'Logo file for intro/outro branding',
        'Brand colours for lower thirds and graphics',
        'Any music preferences (genre/mood) or existing licensed tracks',
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
        'Please refer to the individual setup instruction sheets for each service in your package',
        'Your account manager will send service-specific requirements within 24 hours of onboarding',
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
}

async function generateSetupInstructions(c: ClientData): Promise<Buffer> {
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

  // Append extra deliverables as a checklist section if present
  const extraItems = cx.extraDeliverables
    ? cx.extraDeliverables.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  const sections = extraItems.length
    ? [...baseSections, { section: 'Additional Requirements', items: extraItems }]
    : baseSections

  const checkRow = (text: string) => new Paragraph({
    children: [
      new TextRun({ text: '☐  ', bold: true, color: NAVY, size: 22, font: 'Calibri' }),
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
      children: [new TextRun({ text: `Setup Instructions — ${service}`, bold: true, color: NAVY, size: 30, font: 'Calibri' })],
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
  for (const { section, items } of sections) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: section, bold: true, color: WHITE, size: 22, font: 'Calibri' })],
        shading: { fill: NAVY },
        spacing: { before: 280, after: 80 },
      })
    )
    for (const item of items) {
      children.push(checkRow(item))
    }
  }

  // Deadline note
  children.push(
    new Paragraph({ spacing: { before: 320 } }),
    new Paragraph({
      children: [new TextRun({
        text: 'Please aim to send all items within 5 business days so we can begin on schedule. If anything is unclear or unavailable, just let us know — we can guide you through it.',
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
    title:   `Setup Instructions — ${c.businessName}`,
    sections: [{ properties: {}, children }],
  })

  return Packer.toBuffer(doc)
}

// ─────────────────────────────────────────────────────────────
//  Send onboarding email to client (3 docs attached)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  Three staggered client emails
//  Email 1 — Welcome Pack (immediate)
//  Email 2 — Service Agreement (CONTRACT_DELAY_HOURS later, default 2h)
//  Email 3 — Setup Instructions (SETUP_DELAY_HOURS later, default 24h)
// ─────────────────────────────────────────────────────────────

// Renders a personal note block if the note has content, otherwise returns empty string.
// Appears as a warm amber highlight so it visually reads as a personal message
// from Ernest rather than boilerplate.
function personalNote(note?: string): string {
  if (!note?.trim()) return ''
  return `
    <div style="background:#fffbf0;border-left:4px solid #f5a623;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#7a4f00;font-size:13px;font-weight:bold;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">A personal note</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">${note.trim()}</div>
    </div>`
}

function header(c: ClientData) {
  return `
<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0D1B6E;padding:28px 32px;border-radius:8px 8px 0 0;">
    <div style="color:#00B4D8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Quadem Digital Enterprise</div>`
}

function footer() {
  return `
    <p style="color:#1A1A1A;font-size:15px;">
      Questions? Reply to this email or reach us on WhatsApp.<br><br>
      Warm regards,<br>
      <strong>Ernest Avorwlanu</strong><br>
      Founder, Quadem Digital Enterprise<br>
      <a href="https://quademdigital.com" style="color:#00B4D8;">quademdigital.com</a>
    </p>
  </div>
</div>`
}

/**
 * Portal credentials, inside the welcome email.
 *
 * The access code was generated on client creation and then never delivered —
 * the only way a client could learn it was Ernest reading it out of the admin
 * panel, so the portal went largely unused. It ships with the welcome email now.
 *
 * Rendered only when a code is present, so an older client record that predates
 * this never emails an empty box.
 */
function portalBlock(c: ClientData): string {
  if (!c.accessCode) return ''
  const url = c.portalUrl || 'https://quademdigital.com/portal/'
  return `
    <div style="background:#F4F7FB;border:1px solid #dde3f0;padding:20px;border-radius:8px;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:6px;">Your client portal</div>
      <p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 14px;">
        Track your project, view your documents and pay invoices in one place.
      </p>
      <div style="color:#333;font-size:14px;margin-bottom:4px;">Your access code</div>
      <div style="font-family:monospace;font-size:20px;font-weight:bold;color:#0D1B6E;letter-spacing:2px;background:#fff;border:1px dashed #00B4D8;padding:12px 16px;border-radius:6px;display:inline-block;">${escapeHtml(c.accessCode)}</div>
      <p style="color:#666;font-size:13px;line-height:1.6;margin:14px 0 16px;">
        Keep this private — anyone with it can open your portal.
      </p>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#0D1B6E;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:bold;">Open your portal</a>
    </div>`
}

// Email 1 — Welcome Pack (sent immediately)
function sendWelcomeEmail(c: ClientData, filename: string, base64: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Welcome aboard, ${c.contactName}!</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      We are thrilled to welcome <strong>${c.businessName}</strong> to the Quadem Digital family.
      Your <strong>${service}</strong> engagement starts now and we are excited to get to work.
    </p>
    ${personalNote(c.emailNotes?.welcome)}
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Attached is your <strong>Welcome Pack</strong> — it contains your project summary,
      your dedicated contact, and a clear picture of what happens next.
    </p>
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">What to expect next</div>
      <div style="color:#333;font-size:14px;line-height:2;">
        In a couple of hours — your <strong>Service Agreement</strong> to review and sign<br>
        Tomorrow — your <strong>Setup Checklist</strong> with the items we need from you<br>
        Within 48 hours — we will reach out to schedule your onboarding call
      </div>
    </div>
    ${portalBlock(c)}
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Take a few minutes to read through the Welcome Pack at your convenience.
      There is no action required right now — just sit back and let us get things ready.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Welcome to Quadem Digital, ${c.contactName}!`,
      html,
      attachments: [{ filename, content: base64 }],
    }),
  })
}

// Email 2 — Service Agreement (sent after CONTRACT_DELAY_HOURS)
function sendContractEmail(c: ClientData, filename: string, base64: string, scheduledAt: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Your Service Agreement is ready</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Hi ${c.contactName}, your <strong>Service Agreement</strong> for your
      <strong>${service}</strong> engagement with Quadem Digital is attached.
    </p>
    ${personalNote(c.emailNotes?.contract)}
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">Action required</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        Please read through the agreement, sign the signature block on the last page,
        and return a signed copy to this email address at your earliest convenience.
        We cannot begin work until the signed agreement is received.
      </div>
    </div>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      If you have any questions about the agreement or would like to discuss any
      of the terms, simply reply to this email and we will sort it out together.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Your Service Agreement — ${c.businessName} x Quadem Digital`,
      html,
      attachments: [{ filename, content: base64 }],
      scheduledAt,
    }),
  })
}

// Email 3 — Setup Instructions (sent after SETUP_DELAY_HOURS)
function sendSetupEmail(c: ClientData, filename: string, base64: string, scheduledAt: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Here is what we need from you</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Hi ${c.contactName}, we are almost ready to kick off your <strong>${service}</strong> project.
      Before we can begin, there are a few things we need from your side.
    </p>
    ${personalNote(c.emailNotes?.setup)}
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Attached is your <strong>Setup Checklist</strong> — a short list of access credentials,
      assets, and information specific to your service. The sooner we receive these,
      the sooner we can get started.
    </p>
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">How to send us what we need</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        Simply reply to this email with the items listed in the checklist.
        If you have files to share (logos, documents), attach them directly to your reply
        or send a Google Drive or Dropbox link.
      </div>
    </div>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      If anything on the list is unclear, do not hesitate to ask. We are here to help.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Getting started — what we need from ${c.businessName}`,
      html,
      attachments: [{ filename, content: base64 }],
      scheduledAt,
    }),
  })
}

// Email 4 — Week-one check-in (sent after CHECKIN_DELAY_HOURS, default 7 days)
function sendCheckinEmail(c: ClientData, scheduledAt: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Checking in — how is everything going?</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Hi ${c.contactName}, it has been a week since you came aboard and we wanted to
      check in. Your <strong>${service}</strong> project is underway and things are
      moving on our end.
    </p>
    ${personalNote(c.emailNotes?.checkin)}
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">A quick reminder</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        If you have not yet returned your signed <strong>Service Agreement</strong>, please do so
        at your earliest convenience so we can keep things moving without delays.<br><br>
        If you have not yet sent through your <strong>onboarding items</strong> (brand assets,
        access credentials, etc.), a quick reply to that email with what you have so far is
        all we need to get started.
      </div>
    </div>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      If you have already taken care of both — thank you, we are all set!
      You will be hearing from us shortly with your first updates.
    </p>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Any questions at all, just hit reply. We are always happy to help.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Quick check-in — ${c.businessName} x Quadem Digital`,
      html,
      scheduledAt,
    }),
  })
}

// ─────────────────────────────────────────────────────────────
//  Fire client.won event to Resend
// ─────────────────────────────────────────────────────────────
async function fireResendEvent(c: ClientData) {
  await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE}/contacts`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:        c.email,
      first_name:   c.contactName.split(' ')[0],
      last_name:    c.contactName.split(' ').slice(1).join(' ') || '',
      unsubscribed: false,
    }),
  })

  await fetch('https://api.resend.com/contacts/events', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audience_id:   RESEND_AUDIENCE,
      contact_email: c.email,
      event_name:    'client.won',
    }),
  }).catch(() => console.log('[client-won] client.won event skipped'))
}

// ─────────────────────────────────────────────────────────────
//  Notify Ernest
// ─────────────────────────────────────────────────────────────
async function notifyErnest(c: ClientData) {
  const service   = SERVICE[c.service] ?? c.service
  const waLink    = c.phone
    ? `https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(c.contactName)}%2C%20welcome%20to%20Quadem%20Digital%21`
    : null

  const rows = [
    ['Business',   c.businessName],
    ['Contact',    c.contactName],
    ['Email',      c.email],
    ['Phone',      c.phone || 'Not provided'],
    ['Service',    service],
    ['Package',    c.package || '—'],
    ['Monthly Fee', c.price ? `GH₵ ${c.price.toLocaleString()}/month` : '—'],
    ['Start Date', fmtDate(c.startDate)],
  ]

  const html = `
<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,110,0.12);">
  <div style="background:#0D1B6E;padding:28px 32px;">
    <div style="color:#00B4D8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Quadem CMS</div>
    <div style="color:#fff;font-size:22px;font-weight:bold;">New Client Won</div>
    <div style="color:#E8F6FB;font-size:13px;margin-top:4px;">Contract, Welcome Pack & Setup Instructions sent automatically</div>
  </div>
  <div style="background:#fff;padding:32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr>
        <td style="padding:10px 14px;background:${i % 2 === 0 ? '#0D1B6E' : '#1a2b8a'};color:#fff;font-weight:bold;font-size:13px;width:35%;">${label}</td>
        <td style="padding:10px 14px;background:${i % 2 === 0 ? '#E8F6FB' : '#fff'};color:#1A1A1A;font-size:13px;">${value}</td>
      </tr>`).join('')}
    </table>
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <strong style="color:#0D1B6E;">Staggered delivery scheduled:</strong><br>
      <span style="color:#333;font-size:13px;line-height:2;">
        📋 <strong>Welcome Pack</strong> — sent immediately<br>
        📄 <strong>Service Agreement</strong> — ${CONTRACT_DELAY_HOURS}h from now<br>
        ✅ <strong>Setup Instructions</strong> — ${SETUP_DELAY_HOURS}h from now (${service}-specific)<br>
        💬 <strong>Week-one check-in</strong> — 7 days from now
      </span>
    </div>
    <div>
      <a href="mailto:${c.email}?subject=Welcome%20to%20Quadem%20Digital" style="display:inline-block;background:#0D1B6E;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:bold;margin-right:8px;">Reply by Email</a>
      ${waLink ? `<a href="${waLink}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:bold;">WhatsApp ${c.contactName}</a>` : ''}
    </div>
  </div>
  <div style="background:#0D1B6E;padding:14px 32px;text-align:center;">
    <span style="color:#E8F6FB;font-size:11px;">Quadem CMS &bull; cms.quademdigital.com</span>
  </div>
</div>`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Quadem CMS <ernest@quademdigital.com>',
      to:      [ERNEST_EMAIL],
      subject: `New client won: ${c.businessName} — ${service}`,
      html,
    }),
  })
}

// ─────────────────────────────────────────────────────────────
//  API Route Handler
// ─────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  // Verify secret
  const incomingSecret = request.headers.get('x-quadem-secret')
  if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { event: string; client: ClientData }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.event !== 'client.won' || !body.client) {
    return new Response(JSON.stringify({ ok: false, error: 'Expected event: client.won' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const client = body.client
  const safeName = client.businessName.replace(/[^a-zA-Z0-9]/g, '-')

  try {
    // Generate all three documents in parallel (in memory — no temp files needed)
    const [contractBuf, welcomeBuf, setupBuf] = await Promise.all([
      generateContract(client),
      generateWelcomePack(client),
      generateSetupInstructions(client),
    ])

    const welcomeFile  = `Quadem-Welcome-Pack-${safeName}.docx`
    const contractFile = `Quadem-Service-Agreement-${safeName}.docx`
    const setupFile    = `Quadem-Setup-Instructions-${safeName}.docx`

    // Calculate scheduled delivery times
    const contractAt = hoursFromNow(CONTRACT_DELAY_HOURS)  // e.g. +2h
    const setupAt    = hoursFromNow(SETUP_DELAY_HOURS)     // e.g. +24h
    const checkinAt  = hoursFromNow(CHECKIN_DELAY_HOURS)   // e.g. +168h (7 days)

    // Fire all six async calls at once:
    //   • Email 1 to client (immediate — no scheduledAt)
    //   • Email 2 to client (scheduled +2h)
    //   • Email 3 to client (scheduled +24h)
    //   • Email 4 to client (scheduled +7 days)
    //   • Resend audience event
    //   • Ernest notification
    const [welcomeRes, contractRes, setupRes, checkinRes, , ernestRes] = await Promise.all([
      sendWelcomeEmail(client,  welcomeFile,  welcomeBuf.toString('base64')),
      sendContractEmail(client, contractFile, contractBuf.toString('base64'), contractAt),
      sendSetupEmail(client,    setupFile,    setupBuf.toString('base64'),    setupAt),
      sendCheckinEmail(client,  checkinAt),
      fireResendEvent(client),
      notifyErnest(client),
    ])

    if (!welcomeRes.ok)  console.error('[client-won] Welcome email failed:',      await welcomeRes.json())
    if (!contractRes.ok) console.error('[client-won] Contract email failed:',     await contractRes.json())
    if (!setupRes.ok)    console.error('[client-won] Setup email failed:',        await setupRes.json())
    if (!checkinRes.ok)  console.error('[client-won] Check-in email failed:',     await checkinRes.json())
    if (!ernestRes.ok)   console.error('[client-won] Ernest notification failed:', await ernestRes.json())

    console.log(`[client-won] Staggered delivery scheduled for: ${client.businessName}`)
    console.log(`  Email 1 (Welcome Pack)       — immediate`)
    console.log(`  Email 2 (Contract)           — ${contractAt}`)
    console.log(`  Email 3 (Setup Instructions) — ${setupAt}`)
    console.log(`  Email 4 (Week-one check-in)  — ${checkinAt}`)

    return new Response(JSON.stringify({
      ok:      true,
      message: `Documents scheduled for ${client.businessName}`,
      delivery: {
        welcomePack:       'immediate',
        serviceAgreement:  contractAt,
        setupInstructions: setupAt,
        weekOneCheckin:    checkinAt,
      },
      sent: {
        welcome:            welcomeRes.ok,
        contract:           contractRes.ok,
        setup:              setupRes.ok,
        checkin:            checkinRes.ok,
        ernestNotification: ernestRes.ok,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[client-won] Error:', err)
    return new Response(JSON.stringify({ ok: false, error: 'Internal error', detail: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
