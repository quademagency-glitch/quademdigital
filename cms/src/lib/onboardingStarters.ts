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

  The migration 20261006_194500_onboarding_starters added the first ones, and
  each later migration adds only its own service's (`only`): one the founder
  has renamed must not come back as a second draft.
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
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We talk through your business, your customers and what the site has to do. We confirm the pages and the dates.'),
      step('Send your logo, photos and page wording', 'client', 'onboarding', 3, 'Everything on your setup checklist: your logo, the photos you want used, the words for each page (or ask us to write them) and links to two or three sites you like.'),
      step('Give access to your domain', 'client', 'onboarding', 3, 'An invitation to your domain account, or tell us if you need a new domain. Please never email a password.'),
      step('Homepage design for your review', 'quadem', 'design', 8, 'You see how the homepage will look before anything is built.'),
      step('Your feedback on the design', 'client', 'design', 10, 'Reply with what to change, all in one message. Clear notes keep the project on time.'),
      step('Build the full site', 'quadem', 'development', 18, 'Every page built and working on phones, with your contact form wired up and the basics for search in place.'),
      step('Speed, search and backup checks', 'quadem', 'development', 20, 'Before the client sees it: page speed, titles and descriptions, analytics, backups.', false),
      step('Review the finished site', 'client', 'review', 21, 'Go through every page on your phone and on a computer, and send one list of changes.'),
      step('Changes made and the site goes live', 'quadem', 'review', 25, 'We make your changes, connect your domain and put the site live.'),
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
      step('Choose a direction', 'client', 'review', 9, 'Pick the concept you want to take forward and tell us what to change.'),
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
      step('Posting starts', 'quadem', 'retainer', 10, 'Posts go out on schedule, and we keep an eye on comments and messages.'),
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
      step('Approve the scripts', 'client', 'review', 6, 'Tell us what to change before production starts.'),
      step('First cuts', 'quadem', 'development', 10, 'Each video edited with captions, music and your logo.'),
      step('Your changes', 'client', 'review', 12, 'One list of changes for each video.'),
      step('Final videos delivered', 'quadem', 'completed', 14, 'Ready-to-post files in the size each platform needs.'),
    ],
  },
  {
    name: 'SEO and content',
    service: 'seo-paid-ads',
    summary: 'Audit and set-up in the first two to three weeks, then monthly work and a monthly report.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'Your most important products or services, the areas you serve and the competitors you know.'),
      step('Access to your website, Search Console and Analytics', 'client', 'onboarding', 3, 'Invitations, not passwords. If you do not have Search Console or Analytics, we set them up.'),
      step('Site and keyword audit', 'quadem', 'design', 10, 'What is holding your site back in search, and the searches worth winning.'),
      step('Approve the plan', 'client', 'review', 12, 'The fixes we will make and the pages we will improve or write, for your yes.'),
      step('Fixes made', 'quadem', 'development', 17, 'Site fixes done and your Google Business Profile up to date.'),
      step('Monthly report', 'quadem', 'retainer', 30, 'Rankings, visits and enquiries, with next month’s plan.'),
    ],
  },
  {
    name: 'Growth & Performance Marketing',
    service: 'digital-marketing',
    summary: 'Ads on Facebook, Instagram and Google: growth plan, tracking and first campaigns in about ten days, then weekly checks and a monthly report on what each enquiry cost.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'What you want more of (enquiries, visits, sales), who your best customers are, what to promote first and your monthly ad budget.'),
      step('Access to your ad accounts', 'client', 'onboarding', 2, 'Admin access to your Facebook Business Manager, Page and ad account, and to Google Ads if we are using it, or tell us if we are creating them.'),
      step('Ad budget and payment method', 'client', 'onboarding', 2, 'Your ad budget is paid to Meta or Google directly, separate from our fee.'),
      step('Growth plan and tracking', 'quadem', 'design', 5, 'Who buys from you and why, who we will reach and what we will say, and tracking so every enquiry and sale from an ad is counted.'),
      step('Ads for your approval', 'quadem', 'design', 8, 'The designs and wording for your first ads.'),
      step('Approve the ads', 'client', 'review', 10, 'Approve or ask for changes.'),
      step('Campaigns go live', 'quadem', 'retainer', 11, 'Your ads start running.'),
      step('First results check', 'quadem', 'retainer', 18, 'Early numbers: what to keep and what to change. From here we check the ads every week.'),
      step('Monthly report', 'quadem', 'retainer', 30, 'What was spent, what each enquiry cost, what worked, and next month’s plan.'),
    ],
  },
  // AI automation and Fieldwork, added 20 October 2026 (migration 20261020_130100),
  // from what their service pages already tell clients.
  {
    name: 'WhatsApp assistant',
    service: 'ai-automation',
    summary: 'Paid once: planned and built in about two weeks, tested with real messages, then it answers on your WhatsApp. No monthly fee.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We look at where your enquiries arrive, what you ask every customer and what should happen next.'),
      step('The questions you always ask', 'client', 'onboarding', 2, 'The three questions you ask every new customer, what each answer should lead to, and who the enquiry goes to.'),
      step('Access to your WhatsApp Business', 'client', 'onboarding', 3, 'Access to the WhatsApp Business number the assistant will answer on, or tell us if we are setting one up. Please never email a password.'),
      step('The plan and replies for your approval', 'quadem', 'design', 5, 'The questions, the replies and where each enquiry is saved, for your yes.'),
      step('Approve the plan', 'client', 'review', 6, 'Approve it or ask for changes.'),
      step('Build and test', 'quadem', 'development', 12, 'We set it up on your WhatsApp and test it with real messages before it goes live.'),
      step('Try it yourself', 'client', 'review', 13, 'Send it a few messages the way a customer would, and tell us what to change.'),
      step('It goes live', 'quadem', 'completed', 14, 'It starts answering, and you get your enquiry list and a short guide to using it.'),
    ],
  },
  {
    name: 'Fieldwork lead lists',
    service: 'fieldwork',
    summary: 'The first list in two to three weeks, checked by hand, then a fresh list every month.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'Who your best customers are, where they are, and what makes a business worth contacting for you.'),
      step('Your last five customers', 'client', 'onboarding', 2, 'The last five customers you were really glad to get: who they are and why they bought.'),
      step('The written definition', 'quadem', 'design', 5, 'A written definition of the businesses you want, for you to sign off. Everything after it depends on this.'),
      step('Approve the definition', 'client', 'review', 7, 'Approve it or tell us what to change.'),
      step('First list, checked by hand', 'quadem', 'development', 18, 'Each business with a checked email, a phone number and one line on why to contact it now.'),
      step('Your feedback on the list', 'client', 'review', 21, 'Tell us which businesses were right and which were not, so the next list is better.'),
      step('Monthly list', 'quadem', 'retainer', 30, 'A fresh, re-checked list every month, with duplicates and dead ends taken out.'),
    ],
  },
  {
    name: 'Custom project',
    service: 'custom',
    summary: 'For work none of the other services cover. The days are a starting point: move them on each client once the plan is agreed.',
    steps: [
      step('Kick-off call', 'quadem', 'onboarding', 0, 'We go through exactly what you need, agree what the work covers, and confirm the dates.'),
      step('Check the request against the quotation', 'quadem', 'onboarding', 1, 'Anything asked for that the quotation does not cover gets a quote of its own.', false),
      step('Send what we agreed', 'client', 'onboarding', 3, 'The content, files, examples or account access we agreed on the call. Please never email a password.'),
      step('Plan and dates confirmed', 'quadem', 'onboarding', 5, 'A short written plan of the work and when you will see each part.'),
      step('First version for your review', 'quadem', 'design', 12, 'An early look at the work, so we can change direction before much is built.'),
      step('Your feedback', 'client', 'review', 14, 'One list of changes, all in one message.'),
      step('The rest of the work', 'quadem', 'development', 24, 'Everything else in the plan, with the changes you asked for.'),
      step('Final check', 'client', 'review', 27, 'Check that everything works as agreed before handover.'),
      step('Handover', 'quadem', 'completed', 30, 'Everything handed over, with what you need to use it. Your agreement says which changes after handover are included.'),
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
Ernest is your main contact from start to finish. Message us on WhatsApp, or email ernest@quademdigital.com.

Your project journey on this page shows each step, who it is waiting on, and when it is due.`

const sending = `## Sending files and access
- Big files: a Google Drive or WeTransfer link is best.
- Access to an account: send an invitation to ernest@quademdigital.com where the platform allows it.
- Please never send a password by email or WhatsApp.`

export const STARTER_GUIDES: StarterGuide[] = [
  {
    title: 'Your website project',
    service: 'web-design',
    description: 'How your website gets made, what we need from you, and what happens after launch.',
    writing: `${together}

## What we need from you
- Your logo, in the best quality you have.
- Photos you want used. Real photos of your work, team or space beat stock photos.
- The words for each page, or ask us to write them.
- Links to two or three websites you like, with a note on what you like.
- Access to your domain, or tell us if you need a new one.

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

## What we need from you
- Your business name and any tagline you use.
- Who your customers are, and what makes you different.
- Colours you like, and colours to avoid.
- A few logos you like and a few you dislike, with a note on why.
- Any logo files you already have, even if they are being replaced.

## How it works
We start with logo concepts, each shown on real things like a sign or a phone screen. You choose one, we refine it together, and then we prepare your files. Your agreement says how many concepts and rounds of changes are included.

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

## What we need from you
- Access to each page we agreed: add ernest@quademdigital.com as an editor.
- Your logo, brand colours and any post designs you want kept.
- Photos of your work, products or space. Phone photos are fine.
- What to promote first, and anything coming up: offers, events, launches.

## Each month
1. We send the month's posts, each with its date, caption and design.
2. You approve or ask for changes within two days.
3. Posts go out on schedule, and we keep an eye on comments and messages.
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

## What we need from you
- What each video has to do: sell a product, announce an offer, explain a service.
- Where it will be posted: Instagram, TikTok, YouTube or WhatsApp Status.
- Your logo, colours and product photos from as many angles as you have.
- Links to two or three reels you like.

## Your face and voice
Videos can use an AI presenter, a voiceover only, or captions only. If you want your own face or voice used, we send you a consent form first. Nothing of yours is used without it.

## How it works
1. We write a short script for each video for you to approve.
2. We make the videos with captions, music and your logo.
3. You send one list of changes.
4. You receive the final files, sized for each platform.

${sending}`,
  },
  {
    title: 'Your SEO',
    service: 'seo-paid-ads',
    description: 'How your search work is set up, done and reported each month.',
    writing: `${together}

## What we need from you
- Access to your website, Google Search Console and Google Analytics. If you do not have them, we set them up.
- Your most important products or services, the areas you serve, and the competitors you know.

## How it works
We start with an audit of your site and the searches worth winning, then send you the plan for approval. After that the work runs every month.

## Your monthly report
Each month you get a short report: where you rank, how many people visited and the enquiries that came in. It ends with next month's plan.

## Be patient with search
Search rankings usually take a few months to build, and then keep working without paying for each click.

${sending}`,
  },
  {
    title: 'Your growth and ads',
    service: 'digital-marketing',
    description: 'How your ads on Facebook, Instagram and Google are planned, tracked, run and reported.',
    writing: `${together}

## What we need from you
- Admin access to your Facebook Business Manager, Page and ad account, and to Google Ads if we are using it.
- Your monthly ad budget and a card added to your ad account. The budget is paid to Meta or Google directly, separate from our fee.
- Who your best customers are, and the products or services to promote first.
- Your logo and photos for the ads.

## How it works
We set up tracking so every enquiry and sale from an ad is counted, plan who to reach and what to say, then send you the first ads to approve. Once they run, we check them every week and keep improving them.

## Your monthly report
Each month you get a short report: what was spent, what each enquiry cost, what worked, and next month's plan.

${sending}`,
  },
  {
    title: 'Your WhatsApp assistant',
    service: 'ai-automation',
    description: 'How your WhatsApp assistant is planned, built and handed over.',
    writing: `${together}

## What we need from you
- The WhatsApp Business number the assistant will answer on, or tell us if we are setting one up.
- Admin access to the Meta Business account that number belongs to: an invitation to ernest@quademdigital.com.
- The three questions you ask every new customer, and what each answer should lead to.
- Who each enquiry should go to, your opening hours, and anything the assistant must never say.

## How it works
We plan the questions and replies with you and send them for your yes. Then we build it on your WhatsApp and test it with real messages. You try it yourself before it goes live.

## Once it is live
It replies the moment a message arrives, asks your questions, then hands the customer to you with the details filled in. Every enquiry is saved in a list you can sort and filter. It only replies to people who wrote first, and stops as soon as a person is needed.

${sending}`,
  },
  {
    title: 'Your lead lists',
    service: 'fieldwork',
    description: 'How your lead lists are defined, built, checked and delivered.',
    writing: `${together}

## What we need from you
- The last five customers you were really glad to get: who they are and why they bought.
- The towns, regions or countries to cover, and how many businesses you want each month.
- Any businesses, sectors or names to leave out.

## How it works
We write a definition of the businesses you want, and you sign it off. Then we search public information, check each business by hand and take out duplicates and dead ends. Your first list arrives in two to three weeks.

## Each month
A fresh list, everything re-checked. Each business comes with a checked email, a phone number and one line on why to contact it now. Tell us which ones were right, and the next list gets better.

${sending}`,
  },
  {
    title: 'Your custom project',
    service: 'custom',
    description: 'How your project runs, what we need from you, and how changes are handled.',
    writing: `${together}

## How it works
1. On our kick-off call we agree exactly what we will make, and the dates.
2. You send the content, files or access we agreed.
3. You see a first version early, so we can change direction before much is built.
4. We finish the work, you check it, and we hand everything over.

## What is included
Your agreement lists the work it covers. Anything not on that list is outside it, and we will quote for it separately if you would like it.

## How reviews work
Send your changes in one message each time. It is the quickest way to keep to the dates.

${sending}`,
  },
  {
    title: 'Working with Quadem Digital',
    service: 'multiple',
    isDefault: true,
    description: 'How your project runs, what we need from you, and how to reach us.',
    writing: `${together}

## What we need from you
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
export async function addStarters(payload: Payload, req?: PayloadRequest, only?: string[]) {
  const added = { templates: 0, guides: 0 }
  const wanted = (service: string) => !only || only.includes(service)
  for (const t of STARTER_TEMPLATES.filter((x) => wanted(x.service))) {
    const there = await payload.find({ collection: 'journey-templates', where: { name: { equals: t.name } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (there.totalDocs) continue
    await payload.create({ collection: 'journey-templates', data: { name: t.name, service: t.service, isDefault: t.isDefault === true, ready: false, summary: t.summary, steps: t.steps } as never, overrideAccess: true, req })
    added.templates += 1
  }
  for (const g of STARTER_GUIDES.filter((x) => wanted(x.service))) {
    const there = await payload.find({ collection: 'onboarding-guides', where: { title: { equals: g.title } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (there.totalDocs) continue
    await payload.create({ collection: 'onboarding-guides', data: { title: g.title, service: g.service, isDefault: g.isDefault === true, ready: false, description: g.description, content: writingToRichText(g.writing) } as never, overrideAccess: true, req })
    added.guides += 1
  }
  return added
}
