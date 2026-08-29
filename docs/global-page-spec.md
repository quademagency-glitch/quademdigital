# Prompt: reposition quademdigital.com for international clients

Paste everything below the line into Cursor, Claude Code, Lovable, v0, or whatever
tool builds your site. It is written to be handed over whole. Don't trim it.

---

## Context

You are working on **quademdigital.com**, the website of Quadem Digital, a
founder-led digital agency run by **Ernest**, based in Accra, Ghana. The agency
does web design and build, brand identity, SEO and content, AI video and reels,
AI automation, and sells an ERP product called QuadERP.

The site currently works well for Ghanaian buyers. It does not work for buyers in
the UK, US, Europe or the Gulf, and the agency is about to start cold outreach
into those markets. Your job is to fix that **without breaking what already
works locally**.

**Before you change anything:** detect the stack (framework, CMS, styling system,
routing, hosting) and follow the conventions already in the codebase. Do not
introduce a new framework, CSS system, or component library. Match the existing
code style.

---

## Hard rules you must not break

1. **Do not delete the Ghana positioning.** MoMo, WhatsApp, Paystack, Hubtel,
   local SEO and GHS pricing are winning local business. They get moved and
   scoped, never removed.
2. **Do not change the QuadERP section or the blog.** Out of scope.
3. **Do not invent case studies, client names, testimonials, awards, review
   scores, or statistics.** Where a proof asset doesn't exist yet, build the slot
   and leave a clearly marked placeholder. Never fabricate social proof.
4. **Keep every existing URL working.** If you move a page, add a redirect.
5. Ask before deleting anything you're unsure about.

---

## Task 1: fix the objective errors on the existing site

These are real problems on the live site right now. Fix each one.

### 1.1 Mixed currencies on the same page
The homepage shows packages in USD (`$425`, `$950`, `$1,350`) and AI video in
GHS (`GHS 1,500`). Two currencies on one page reads as unfinished.

Fix: detect the visitor's country and show **one** currency throughout. Ghana →
GHS. Everywhere else → USD. Put a small currency label next to the first price
("All prices in USD"). No conversion widget, no dropdown: just one consistent
currency per visitor.

### 1.2 Broken hero subheadline
Current text: *"You work directly with the person building your brand fast
turnarounds, honest pricing, and work designed to make you money, not just look
good."*

Two sentences are fused. Fix the punctuation.

### 1.3 The hero leads with the weakest thing
Current headline: *"Premium Websites that convert and help you grow!"*

Problems: "Premium" is a claim anyone can make, the exclamation mark undercuts
it, and websites are the most commoditised service on the menu.

Replace with:

> **Headline:** You work with the founder. Not an account manager.
>
> **Subheadline:** Websites, brand, AI video and automation: built by the person
> you actually talk to. Fast turnarounds, honest pricing, and work designed to
> make you money rather than just look good.

Keep both existing CTAs.

### 1.4 No physical address anywhere on the site
There is currently no postal address on any page. This is a problem for two
reasons: US anti-spam law requires a valid physical address in commercial email,
and a site with no address reads as evasive to a foreign buyer.

Fix: add a real street address to the site footer, alongside the existing email
and phone. Add an international-format phone number in addition to the WhatsApp
link, not instead of it.

### 1.5 Discounting undermines the international pitch
The `/offers` page runs "15% off your first project" and "1 month free social
media management". To a buyer in London or Dallas, discounts on an already-low
price signal risk, not value.

Fix: keep `/offers` exactly as it is, but make it visible only on the Ghana path.
Do not link to it from the new global page or from global navigation.

### 1.6 The founder story is buried
The About page has the strongest asset in the business (Ernest does the work
himself, no juniors, no account managers) and the homepage barely uses it.

Fix: promote "You Talk to the Founder" to directly below the hero, and add
Ernest's name and photo to it. A named human is worth more than any adjective.

---

## Task 2: build a new page at `/global`

This is the main deliverable. Every cold email, cold call and LinkedIn message
will point here. It must answer a stranger's objections before they ask.

Build it as a **standalone landing page**: its own hero, its own navigation
(logo, Services, Work, Pricing, Book a Call, and nothing else), its own footer.

**It must not contain**, anywhere on the page: MoMo, Mobile Money, MTN, Telecel,
AirtelTigo, Paystack, Hubtel, "Built for Ghana", GHS pricing, or WhatsApp as the
primary contact method. WhatsApp can appear as one option among several, never as
the default.

### Page structure and copy

Use this copy. Adjust wording to fit the design, but keep the meaning and the
order. The order is doing work.

**1. Hero**

> You get the founder. Not an account manager.
>
> A small studio building websites, brand identity, AI video and automation for
> growing businesses in the UK, US, Europe and the Gulf. One person on your
> project from first call to launch, and that person is me.
>
> [Book a 15-minute call] [See the work]

**2. Proof strip**: directly under the hero, before anything else.

Two slots, side by side. One for a sample AI video reel, one for a public website
teardown. Build both slots with clear placeholders marked
`TODO: replace with real asset`. This section carries the whole page: a stranger
judges you here in about eight seconds.

**3. What I build**: three cards, in this order.

> **AI video and reels**: Eight to twelve short videos a month for social. No
> shoot day, no crew, no studio. You film a handful of clips on your phone once a
> month, I turn them into a month of content.
>
> **AI automation**: Your enquiries answered in sixty seconds, day or night.
> Quotes, bookings and follow-ups handled without anyone typing.
>
> **Websites and brand**: Sites built to sell rather than to win design awards.
> Three to five weeks, fixed price, no surprises.

Video first, websites last. That order is deliberate: video is what a stranger
buys most readily.

**4. Why work with someone in Accra**: face the objection head on.

> **Your whole working day, covered.** I'm on GMT. That overlaps the entire UK
> and European working day and most of the Gulf's. You'll get replies while
> you're still at your desk.
>
> **No layers.** No account manager, no project coordinator, no junior doing the
> work while someone senior takes the call. You brief me, I build it.
>
> **Honest about the price.** I charge less than a London or New York agency
> because my costs are lower, not because the work is. Same output, different
> overheads.

**5. Pricing**: three tiers, in USD, clearly labelled.

| Tier | Price | What it is |
|---|---|---|
| Website build | from $3,000 | 3–5 weeks, fixed price, everything included |
| Video retainer | from $1,500/month | 8–12 videos a month, rolling monthly |
| Growth retainer | from $2,500/month | Video, SEO, content and site work combined |

State plainly underneath: **no long contracts, monthly retainers cancellable with
30 days' notice, 50% up front on project work.** Ghanaian pricing must not appear
on this page.

**Superseded 29 August 2026: the website build starts at $3,000, not $1,200.**
Ernest's call, and the reason is this table's own arithmetic. Setting up Fieldwork
is from $2,500 for two to three weeks, so at $1,200 the longest and largest job on
the list was the cheapest thing on it, and one month of the video retainer cost
more than a whole website. Across fifteen to twenty-five working days $1,200 is
$48 to $80 a day. It also contradicted section 4 of this document, which says the
price is lower because the overheads are lower and not because the work is. **Do
not restore $1,200.**

**6. Work**: case study slots. Use the existing Omek, SAN Collection and QuadERP
projects, but rewrite each summary so it doesn't rely on the reader knowing
anything about Ghana. Lead each one with the result, not the client's location.

**7. Questions people actually ask**: an FAQ. Answer these plainly and without
apology:

- *Where are you based?* → Accra, Ghana. I work with clients across the UK, US
  and Gulf, and my hours cover most of your day.
- *Who does the work?* → Me. Ernest. Every time.
- *How do I pay?* → Bank transfer, card, or Wise, in USD or GBP.
- *What if I need changes after launch?* → Two rounds included, then an hourly
  rate that's agreed up front.
- *Do I own the work?* → Yes. Full ownership transfers on final payment.
- *How fast can you start?* → Usually within a week.

**8. Booking**: a calendar embed showing times in the visitor's own timezone,
not yours. This matters more than it sounds.

**9. Footer**: logo, physical address, email, international phone, LinkedIn and
Instagram, privacy policy, terms. No WhatsApp-first framing.

---

## Technical requirements

Every one of these affects whether cold outreach works, so treat them as part of
the job rather than polish.

- `/global` must be **fast**. Target under 2 seconds on a mid-range phone on 4G.
  Compress images, serve modern formats, lazy-load anything below the fold.
- Unique `<title>` and `<meta name="description">` on `/global` and on every page
  you touch. No duplicates across the site.
- An Open Graph image on `/global`, sized 1200×630. Cold emails get forwarded and
  pasted into Slack; a link with no preview image looks broken.
- `<title>` under 60 characters so Google doesn't truncate it.
- A `viewport` meta tag on every page.
- Proper heading order: one `<h1>` per page, then `<h2>`, then `<h3>`. Don't
  skip levels.
- Real alt text on every image.
- Add `/global` to `sitemap.xml`. Do not block it in `robots.txt`.
- Add `LocalBusiness` structured data with the real address, and `FAQPage`
  structured data on the FAQ section.
- Every form and booking link must work on mobile Safari. Test it.
- Add UTM parameter capture on `/global` so campaign traffic can be tracked, and
  make sure the parameters survive through to the booking form.

---

## When you're done

Report back with:

1. A list of every file you changed and what you changed in it.
2. Confirmation that each of the six items in Task 1 is fixed.
3. Confirmation that none of these strings appear anywhere on `/global`:
   MoMo, Mobile Money, MTN, Telecel, AirtelTigo, Paystack, Hubtel,
   "Built for Ghana", GHS.
4. A list of every placeholder you left, and exactly what needs to replace it.
5. Lighthouse scores for `/global` on mobile: performance, accessibility, SEO.
6. Anything you found that I didn't mention and think should be fixed.

Do not mark this complete while any placeholder is still holding fabricated
content. Empty and clearly labelled is correct; invented is not.
