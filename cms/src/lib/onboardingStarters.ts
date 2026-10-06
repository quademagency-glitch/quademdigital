import type { Payload, PayloadRequest } from 'payload'

/*
  Starter journeys and guides, one of each per service plus a general one for
  anything that matches none. They are drafts for the founder to correct, so
  they arrive with `ready` off: nothing here is picked for a client, or shown
  to one, until he has read it and switched it on in the portal.

  Written from what clients are already told: the setup checklist and the
  Welcome Pack (src/pages/api/client-won.ts, src/lib/welcomePackPdf.ts on the
  site) and the site's own answers (most websites go live in 2 to 4 weeks, a
  brand identity takes about 2 weeks, progress every week). Due days count
  from the client's start date.

  The migration 20261006_194500_onboarding_starters adds any that are missing,
  by name, and never touches one that is already there.
*/

type Owner = 'quadem' | 'client'
type Stage = 'onboarding' | 'design' | 'development' | 'review' | 'completed' | 'retainer'
export type StarterStep = { title: string; detail: string; owner: Owner; stage: Stage; dueOffsetDays: number; clientVisible?: boolean }
export type StarterTemplate = { name: string; service: string; isDefault?: boolean; summary: string; steps: StarterStep[] }
export type StarterGuide = { title: string; service: string; isDefault?: boolean; description: string; writing: string }

const step = (title: string, owner: Owner, stage: Stage, dueOffsetDays: number, detail: string, clientVisible = true): StarterStep => ({ title, detail, owner, stage, dueOffsetDays, clientVisible })

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: 'Website build',
    service: 'web-design',
    summary: 'A business website from kick-off to launch in about four weeks. A one-page site moves faster: pull the dates in.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We talk through your business, your customers and what the site has to do. I confirm the pages and the dates.'),
      step('Send your logo, photos and page wording', 'client', 'onboarding', 3, 'Everything on your setup checklist: your logo, the photos you want used, the words for each page (or ask me to write them) and links to two or three sites you like.'),
      step('Give access to your domain', 'client', 'onboarding', 3, 'An invitation to your domain account, or tell me if you need a new domain. Please never email a password.'),
      step('Homepage design for your review', 'quadem', 'design', 8, 'You see how the homepage will look before anything is built.'),
      step('Your feedback on the design', 'client', 'design', 10, 'Reply with what to change, all in one message. Clear notes keep the project on time.'),
      step('Build the full site', 'quadem', 'development', 18, 'Every page built and working on phones, with your contact form wired up and the basics for search in place.'),
      step('Speed, search and backup checks', 'quadem', 'development', 20, 'Before the client sees it: page speed, titles and descriptions, analytics, backups.', false),
      step('Review the finished site', 'client', 'review', 21, 'Go through every page on your phone and on a computer, and send one list of changes.'),
      step('Changes made and the site goes live', 'quadem', 'review', 25, 'I make your changes, connect your domain and put the site live.'),
      step('Handover', 'quadem', 'completed', 28, 'You get your logins and a short guide to updating the site. Your agreement says which changes after launch are included.'),
    ],
  },
  {
    name: 'Brand identity',
    service: 'branding',
    summary: 'Logo and brand kit in about two weeks. The number of concepts and rounds of changes is in each agreement.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We talk about your business, your customers and what makes you different.'),
      step('Send your brand brief', 'client', 'onboarding', 2, 'Colours you like or want to avoid, a few logos you like and dislike with a note on why, and any logo files you already have.'),
      step('Logo concepts', 'quadem', 'design', 7, 'Your logo directions, each shown on real things: a sign, a phone screen, a business card.'),
      step('Choose a direction', 'client', 'review', 9, 'Pick the concept you want to take forward and tell me what to change.'),
      step('Refine the chosen logo', 'quadem', 'design', 12, 'Your changes made, with colours and fonts chosen to go with it.'),
      step('Approve the final logo', 'client', 'review', 13, 'A last look before the files are prepared.'),
      step('Brand files delivered', 'quadem', 'completed', 14, 'Your logo in every format you need, your colours and fonts, and a short guide to using them.'),
    ],
  },
  {
    name: 'Social media management',
    service: 'social-media',
    summary: 'Monthly. The first month is set-up, then the calendar, approval, posting and report repeat every month.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We agree your goals, the platforms, your tone of voice and what to post about first.'),
      step('Give access to your pages', 'client', 'onboarding', 2, 'Add ernest@quademdigital.com as an editor on each platform we agreed. Please never email a password.'),
      step('Send your logo, colours and photos', 'client', 'onboarding', 3, 'Your logo, brand colours, any post designs you want kept, and photos of your work, products or space.'),
      step('Scheduling and post templates set up', 'quadem', 'onboarding', 5, 'Scheduling tool connected, brand templates built.', false),
      step('Your first month of posts', 'quadem', 'design', 7, 'Every post for the month with its date, caption and design, for your approval.'),
      step('Approve the month', 'client', 'review', 9, 'Approve or ask for changes within two days so posts go out on time.'),
      step('Posting starts', 'quadem', 'retainer', 10, 'Posts go out on schedule, and I keep an eye on comments and messages.'),
      step('Monthly report', 'quadem', 'retainer', 30, 'What went out, what worked, and the plan for next month.'),
    ],
  },
  {
    name: 'AI video and reels',
    service: 'video-production',
    summary: 'A set of short videos in about two weeks. On a monthly plan, scripts to delivery repeat each month.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'What each video has to do, who it is for and where it will be posted.'),
      step('Send your brand files and product photos', 'client', 'onboarding', 2, 'Your logo, colours, product photos from as many angles as you have, and links to two or three reels you like.'),
      step('Consent form, if your own face or voice is used', 'client', 'onboarding', 2, 'Only if you want yourself in the videos. Nothing of yours is used without it.'),
      step('Scripts for your approval', 'quadem', 'design', 4, 'A short script and shot plan for each video.'),
      step('Approve the scripts', 'client', 'review', 6, 'Tell me what to change before production starts.'),
      step('First cuts', 'quadem', 'development', 10, 'Each video edited with captions, music and your logo.'),
      step('Your changes', 'client', 'review', 12, 'One list of changes for each video.'),
      step('Final videos delivered', 'quadem', 'completed', 14, 'Ready-to-post files in the size each platform needs.'),
    ],
  },
  {
    name: 'SEO and paid ads',
    service: 'seo-paid-ads',
    summary: 'Audit and set-up in the first two to three weeks, then monthly work and a monthly report.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'Your most important products or services, the areas you serve and the competitors you know.'),
      step('Access to your website, Search Console and Analytics', 'client', 'onboarding', 3, 'Invitations, not passwords. If you do not have Search Console or Analytics, I set them up.'),
      step('Google Ads access and budget', 'client', 'onboarding', 3, 'Your monthly ad budget is paid to Google directly, separate from my fee.'),
      step('Site and keyword audit', 'quadem', 'design', 10, 'What is holding your site back in search, and the searches worth winning.'),
      step('Approve the plan and first ads', 'client', 'review', 12, 'The fixes I will make and the ads I will run, for your yes.'),
      step('Fixes made and ads live', 'quadem', 'development', 17, 'Site fixes done and your first campaigns running.'),
      step('Monthly report', 'quadem', 'retainer', 30, 'Rankings, visits, enquiries and ad spend, with next month’s plan.'),
    ],
  },
  {
    name: 'Digital marketing',
    service: 'digital-marketing',
    summary: 'Meta ads: set-up and first campaigns in about ten days, then monthly management and reports.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'What you want more of (enquiries, visits, sales), who your best customers are and what to promote first.'),
      step('Access to your Facebook Business Manager', 'client', 'onboarding', 2, 'Admin access to your Business Manager, Page and ad account, or tell me if we are creating one.'),
      step('Ad budget and payment method', 'client', 'onboarding', 2, 'Your ad budget is paid to Meta directly, separate from my fee.'),
      step('Audience and offer plan', 'quadem', 'design', 5, 'Who we will reach and what we will say to them.'),
      step('Ads for your approval', 'quadem', 'design', 8, 'The designs and wording for your first ads.'),
      step('Approve the ads', 'client', 'review', 10, 'Approve or ask for changes.'),
      step('Campaigns go live', 'quadem', 'retainer', 11, 'Your ads start running.'),
      step('First results check', 'quadem', 'retainer', 18, 'Early numbers: what to keep and what to change.'),
      step('Monthly report', 'quadem', 'retainer', 30, 'Spend, results and next month’s plan.'),
    ],
  },
  {
    name: 'General project',
    service: 'multiple',
    isDefault: true,
    summary: 'For several services together, and the fallback for a service with no template of its own.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We agree priorities, who does what and the first milestones.'),
      step('Send what is on your setup checklist', 'client', 'onboarding', 3, 'The brand files, content and access listed in your setup email. Please never email a password.'),
      step('Plan and dates confirmed', 'quadem', 'onboarding', 5, 'The plan for each service, with dates.'),
      step('First work for your review', 'quadem', 'design', 10, 'The first designs or drafts.'),
      step('Your feedback', 'client', 'review', 12, 'One list of changes, all in one message.'),
      step('Finished work delivered', 'quadem', 'completed', 21, 'Everything handed over, with what you need to keep it going.'),
    ],
  },
]

const together = `## How we work together
I am your one point of contact from start to finish. Message me on WhatsApp, or email ernest@quademdigital.com.

Your project journey on this page shows each step, who it is waiting on, and when it is due.`

const sending = `## Sending files and access
- Big files: a Google Drive or WeTransfer link is best.
- Access to an account: send an invitation to ernest@quademdigital.com where the platform allows it.
- Please never send a password by email or WhatsApp.`

export const STARTER_GUIDES: StarterGuide[] = [
  {
    title: 'Your website project',
    service: 'web-design',
    description: 'How your website gets made, what I need from you, and what happens after launch.',
    writing: `${together}

## What I need from you
- Your logo, in the best quality you have.
- Photos you want used. Real photos of your work, team or space beat stock photos.
- The words for each page, or ask me to write them.
- Links to two or three websites you like, with a note on what you like.
- Access to your domain, or tell me if you need a new one.

## How reviews work
You see the homepage design before anything is built, then the finished site before it goes live. Each time, send your changes in one message. It is the quickest way to launch on time.

## How long it takes
Most business websites go live in 2 to 4 weeks. The biggest thing that moves the date is how quickly the content and your feedback arrive.

${sending}

## After launch
You get your logins and a short guide to updating the site. Your agreement says which changes after launch are included.`,
  },
  {
    title: 'Your brand identity',
    service: 'branding',
    description: 'How your logo and brand are made, and what you will receive.',
    writing: `${together}

## What I need from you
- Your business name and any tagline you use.
- Who your customers are, and what makes you different.
- Colours you like, and colours to avoid.
- A few logos you like and a few you dislike, with a note on why.
- Any logo files you already have, even if they are being replaced.

## How it works
I start with logo concepts, each shown on real things like a sign or a phone screen. You choose one, we refine it together, and then I prepare your files. Your agreement says how many concepts and rounds of changes are included.

## What you receive
- Your logo in every format: for print, for the web and for social media.
- Your colours and fonts.
- A short guide to using them, so everything you make looks like you.

${sending}`,
  },
  {
    title: 'Your social media',
    service: 'social-media',
    description: 'How your posts are planned, approved and published each month.',
    writing: `${together}

## What I need from you
- Access to each page we agreed: add ernest@quademdigital.com as an editor.
- Your logo, brand colours and any post designs you want kept.
- Photos of your work, products or space. Phone photos are fine.
- What to promote first, and anything coming up: offers, events, launches.

## Each month
1. I send the month's posts, each with its date, caption and design.
2. You approve or ask for changes within two days.
3. Posts go out on schedule, and I keep an eye on comments and messages.
4. At the end of the month you get a short report and next month's plan.

## Keeping it real
The posts that do best show your actual work and people. Send photos whenever you have them, even quick ones.

${sending}`,
  },
  {
    title: 'Your videos',
    service: 'video-production',
    description: 'How your reels are scripted, made and delivered.',
    writing: `${together}

## What I need from you
- What each video has to do: sell a product, announce an offer, explain a service.
- Where it will be posted: Instagram, TikTok, YouTube or WhatsApp Status.
- Your logo, colours and product photos from as many angles as you have.
- Links to two or three reels you like.

## Your face and voice
Videos can use an AI presenter, a voiceover only, or captions only. If you want your own face or voice used, I send you a consent form first. Nothing of yours is used without it.

## How it works
1. I write a short script for each video for you to approve.
2. I make the videos with captions, music and your logo.
3. You send one list of changes.
4. You receive the final files, sized for each platform.

${sending}`,
  },
  {
    title: 'Your SEO and ads',
    service: 'seo-paid-ads',
    description: 'How your search and Google Ads work is set up and reported.',
    writing: `${together}

## What I need from you
- Access to your website, Google Search Console and Google Analytics. If you do not have them, I set them up.
- Access to Google Ads, or tell me if we are creating an account.
- Your monthly ad budget. It is paid to Google directly, separate from my fee.
- Your most important products or services, the areas you serve, and the competitors you know.

## How it works
I start with an audit of your site and the searches worth winning, then send you the plan and your first ads for approval. After that the work runs every month.

## Your monthly report
Each month you get a short report: where you rank, how many people visited, the enquiries that came in and what the ads spent. It ends with next month's plan.

## Be patient with search
Ads can bring visits from the first week. Search rankings usually take a few months to build, and then keep working without paying for each click.

${sending}`,
  },
  {
    title: 'Your digital marketing',
    service: 'digital-marketing',
    description: 'How your Facebook and Instagram ads are planned, run and reported.',
    writing: `${together}

## What I need from you
- Admin access to your Facebook Business Manager, Page and ad account.
- Your monthly ad budget and a card added to your ad account. The budget is paid to Meta directly, separate from my fee.
- Who your best customers are, and the products or services to promote first.
- Your logo and photos for the ads.

## How it works
I plan who to reach and what to say, then send you the first ads to approve. Once they run, I check the results after the first week and keep improving them.

## Your monthly report
Each month you get a short report: what was spent, what it brought in, and next month's plan.

${sending}`,
  },
  {
    title: 'Working with Quadem Digital',
    service: 'multiple',
    isDefault: true,
    description: 'How your project runs, what I need from you, and how to reach me.',
    writing: `${together}

## What I need from you
Your setup email lists what each service needs: usually your brand files, the content to use and access to your accounts. The sooner those arrive, the sooner the work starts.

## How reviews work
You see the work at each stage before it is finished. Send your changes in one message each time. It is the quickest way to keep to the dates.

${sending}`,
  },
]

/* Plain writing to the CMS's rich text: ## headings, - and 1. lists, paragraphs. */
const text = (t: string) => ({ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
const block = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({ direction: 'ltr', format: '', indent: 0, version: 1, ...extra, type, children })

export function writingToRichText(writing: string) {
  const children: unknown[] = []
  for (const chunk of writing.trim().split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
    const heading = /^(#{2,3})\s+(.*)$/.exec(lines[0] ?? '')
    if (heading) {
      children.push(block('heading', [text(heading[2])], { tag: heading[1].length === 2 ? 'h2' : 'h3' }))
      lines.shift()
      if (!lines.length) continue
    }
    const bullets = lines.every((l) => /^-\s+/.test(l))
    const numbers = lines.every((l) => /^\d+[.)]\s+/.test(l))
    if (bullets || numbers) {
      const kind = bullets ? 'bullet' : 'number'
      children.push(block('list', lines.map((l, i) => block('listitem', [text(l.replace(/^(-|\d+[.)])\s+/, ''))], { value: i + 1 })), { listType: kind, start: 1, tag: bullets ? 'ul' : 'ol' }))
    } else {
      children.push(block('paragraph', [text(lines.join(' '))], { textFormat: 0 }))
    }
  }
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

/**
 * Add any starter that is not there yet, by name, as a draft. One the founder
 * already has (or has renamed) is left alone, so running it twice adds nothing.
 */
export async function addStarters(payload: Payload, req?: PayloadRequest) {
  const added = { templates: 0, guides: 0 }
  for (const t of STARTER_TEMPLATES) {
    const there = await payload.find({ collection: 'journey-templates', where: { name: { equals: t.name } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (there.totalDocs) continue
    await payload.create({ collection: 'journey-templates', data: { name: t.name, service: t.service, isDefault: t.isDefault === true, ready: false, summary: t.summary, steps: t.steps } as never, overrideAccess: true, req })
    added.templates += 1
  }
  for (const g of STARTER_GUIDES) {
    const there = await payload.find({ collection: 'onboarding-guides', where: { title: { equals: g.title } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (there.totalDocs) continue
    await payload.create({ collection: 'onboarding-guides', data: { title: g.title, service: g.service, isDefault: g.isDefault === true, ready: false, description: g.description, content: writingToRichText(g.writing) } as never, overrideAccess: true, req })
    added.guides += 1
  }
  return added
}
