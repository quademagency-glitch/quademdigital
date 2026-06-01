# Quadem Digital Enterprise — Website Implementation Plan

> **Goal:** A dark & premium, attention-grabbing single-page website for a full-service digital agency.
> 5 services · Case studies · All CTAs · 12 replaceable image slots · Free hosting.

---

## Business Brief

| Item | Detail |
|------|--------|
| Business name | Quadem Digital Enterprise |
| Type | Full-service digital agency (solo operation) |
| Services | Web Design & Development · Digital Marketing & Social Media · Branding & Graphic Design · Video Production & Content Creation · SEO & Paid Ads |
| Target audience | General public — mixed audience |
| Primary CTAs | Book a call · Buy a package · Subscribe · View portfolio |
| Vibe | Dark & premium — sleek, high-end feel |
| Inspiration | yuyu.ng — bold storytelling, strong CTAs, personal brand energy |

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Markup | HTML5 | Single file, no build step, deployable anywhere |
| Styling | CSS3 + CSS Custom Properties | Dark theming, easy to update, no framework needed |
| Scripting | Vanilla JavaScript | Typewriter, scroll animations, stat counters — zero dependencies |
| Fonts | Google Fonts | Space Grotesk (display/headings) + Inter (body) |
| Animations | CSS @keyframes + IntersectionObserver | Scroll-reveal, hover effects, counter animations |
| Hosting | Netlify or GitHub Pages | Free, drag-and-drop deploy |

---

## Design System

### Colour Tokens
> Confirm accent colour from your existing brand style guide and update the CSS variable `--accent`.

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#09090F` | Root background |
| Card surface | `#111118` | Cards, sections, inputs |
| Primary text | `#FFFFFF` | Headings, bold text |
| Muted text | `#9B9B9B` | Body copy, labels |
| Border | `rgba(255,255,255,0.08)` | Card borders, dividers |
| Accent | *(from brand guide)* | CTAs, highlights, hover glows |

### Typography Scale

| Role | Font | Weight | Size |
|------|------|--------|------|
| Hero headline | Space Grotesk | 700 | 64–80px |
| Section heading | Space Grotesk | 600 | 40px |
| Card title | Space Grotesk | 500 | 20px |
| Body copy | Inter | 400 | 16px / 1.7 line-height |
| Labels / tags | Inter | 500 | 12px, uppercase |
| CTA buttons | Space Grotesk | 600 | 15px |

---

## Attention-Grabbing Features

These visual and interactive techniques make the site stand out on first load, inspired by yuyu.ng's energy:

- **Typewriter hero text** — cycles through all 5 services automatically
- **Animated gradient border** — subtle accent glow on the hero CTA button
- **Scroll-reveal animations** — every section fades/slides in on scroll using IntersectionObserver
- **Card hover lift + border glow** — premium micro-interaction on service and case study cards
- **Animated stat counters** — numbers count up when the stats strip enters the viewport
- **Sticky blur-glass navbar** — backdrop-filter blur on scroll, transparent at top
- **Smooth anchor scroll** — scroll-behavior: smooth with JS offset for fixed nav
- **Dark mode native** — the entire site is built dark-first

---

## Page Sections (Top → Bottom)

### Section 1 — Sticky Navbar
- Logo on the left
- Nav links in the centre: Services · Work · Process · Testimonials · Contact
- "Book a Call" pill button on the right (accent coloured)
- Frosted-glass blur effect activates on scroll
- Mobile: hamburger icon opens a full-width slide-down drawer

---

### Section 2 — Hero
📸 **Replaceable image:** `images/hero.jpg`

- Full-viewport height
- Background: hero image with dark overlay OR pure dark with subtle noise texture
- **Typewriter text** cycling through: "We build websites · We grow brands · We create content · We run your ads · We design identities"
- Bold tagline below the typewriter
- Two CTA buttons:
  - "Book a Free Call" — filled, accent colour
  - "See Our Work" — outlined, ghost style
- Subtle CSS noise/grain overlay for premium texture

---

### Section 3 — Social Proof Strip
- Thin full-width horizontal band (slightly lighter dark surface)
- 4 animated stat counters (count up on scroll-enter):
  - Projects Delivered
  - Happy Clients
  - Services Offered
  - Years Active
- Thin vertical divider lines between each stat

---

### Section 4 — Services
📸 **Replaceable images:** `images/service-[1-5].jpg` *(optional — cards work without images)*

5 service cards in a responsive grid (3-2 layout on desktop, 1 column on mobile):

| # | Service | Key deliverable |
|---|---------|----------------|
| 1 | Web Design & Development | Custom websites, landing pages, e-commerce |
| 2 | Digital Marketing & Social Media | Strategy, content calendar, page management |
| 3 | Branding & Graphic Design | Logo, brand kit, visual identity |
| 4 | Video Production & Content Creation | Reels, ads, promos, thumbnails |
| 5 | SEO & Paid Ads | Google Ads, Meta Ads, organic ranking |

Each card contains: icon, service name, 2-line description, deliverable tags, hover border glow.

---

### Section 5 — Case Studies
📸 **Replaceable images:** `images/case-study-[1-3].jpg`

2–3 featured case study cards. Each card shows:
- Cover image (replaceable)
- Client industry tag
- Challenge summary (1–2 sentences)
- Key result metric (e.g. "300% increase in website traffic")
- "Read Case Study" link

> Placeholder content is included. Swap images and copy when real case studies are ready.

---

### Section 6 — How We Work (Process)
4-step horizontal timeline on desktop, vertical on mobile:

1. **Discover** — We learn your business, goals, and audience
2. **Strategy** — We build a tailored roadmap for your project
3. **Execute** — We design, build, and deliver at high standard
4. **Deliver** — You get results, reports, and ongoing support

Connected by an animated dashed line that draws from left to right as the section scrolls into view.

---

### Section 7 — Packages / Pricing
3 pricing tiers to enable direct purchase CTA:

| Tier | Highlight | CTA |
|------|-----------|-----|
| Starter | Entry-level, single service | "Get Started" |
| Growth | Most popular, 2–3 services bundled | "Book a Call" (accent highlighted) |
| Premium | Full agency retainer | "Let's Talk" |

- Middle (Growth) card is accent-highlighted as "Most Popular"
- Each card: plan name, price (or "Custom"), feature list with checkmarks, CTA button
- WhatsApp link as a secondary CTA below the grid: "Not sure which plan? Chat with us →"

---

### Section 8 — Testimonials
📸 **Replaceable images:** `images/avatar-[1-3].jpg`

3 mockup review cards in a horizontal scroll carousel:
- Avatar photo (replaceable), client name, company/role
- Star rating (5 stars)
- Short quote (1–3 sentences)

> These are clearly labelled as placeholder content in the code comments. Replace when real client reviews are available.

---

### Section 9 — About / Founder Story
📸 **Replaceable image:** `images/founder.jpg`

Inspired by yuyu.ng's personal storytelling approach:
- Left column: large founder photo with accent border frame
- Right column: bold first-person narrative
  - Who is behind Quadem?
  - Your vision and mission
  - Why clients should choose you over a larger agency
  - Personal, direct, and confident tone

> Copy is provided as a template. Personalise with your real story.

---

### Section 10 — Newsletter / Community
- Bold headline: "Get weekly digital growth tips for free"
- Email input + "Subscribe" button (inline on desktop, stacked on mobile)
- Optional secondary link: Join WhatsApp community or Telegram channel
- Micro-copy: "No spam. Unsubscribe anytime."

---

### Section 11 — Contact / Book a Call
4-field contact form: Name · Email · Service (dropdown) · Message
- Large "Chat on WhatsApp" button (pre-filled message via wa.me/ link)
- Email address (mailto link)
- Social media icons (LinkedIn, Instagram, Twitter/X, Facebook)
- Personal sign-off: "Let's build something great together — Quadem Digital"
- Optional: Calendly embed for direct calendar booking

---

### Section 12 — Footer
- Logo + one-liner tagline
- Quick navigation links
- Social media icons
- Copyright line
- Link back to top

---

## Replaceable Image Slots

All images live in the `images/` folder. Each has a comment in the HTML: `<!-- REPLACE: filename.jpg -->`.
The hero background is controlled by a single CSS variable: `--hero-bg: url('images/hero.jpg')`.

| File | Dimensions | Section |
|------|-----------|---------|
| `logo.png` | 400×150px (transparent PNG) | Navbar + footer |
| `hero.jpg` | 1920×1080px | Hero background |
| `founder.jpg` | 800×900px (portrait) | About section |
| `case-study-1.jpg` | 1200×700px | Case studies |
| `case-study-2.jpg` | 1200×700px | Case studies |
| `case-study-3.jpg` | 1200×700px | Case studies |
| `avatar-1.jpg` | 200×200px (square) | Testimonials |
| `avatar-2.jpg` | 200×200px (square) | Testimonials |
| `avatar-3.jpg` | 200×200px (square) | Testimonials |
| `service-1.jpg` | 600×400px | Services (optional) |
| `service-2.jpg` | 600×400px | Services (optional) |
| `service-3.jpg` | 600×400px | Services (optional) |

A `README.md` in the project folder lists every slot with instructions in plain English — no coding knowledge required to swap images.

---

## File Structure

```
quadem-website/
├── index.html                  # Main page (single file)
├── css/
│   ├── style.css               # Design tokens, layout, dark theme, components
│   └── animations.css          # Scroll-reveals, hover effects, keyframes
├── js/
│   └── main.js                 # Typewriter, stat counters, scroll nav, mobile menu
├── images/
│   ├── logo.png                # <- REPLACE: your logo (transparent PNG)
│   ├── hero.jpg                # <- REPLACE: hero background
│   ├── founder.jpg             # <- REPLACE: your photo
│   ├── case-study-1.jpg        # <- REPLACE: project cover
│   ├── case-study-2.jpg        # <- REPLACE: project cover
│   ├── case-study-3.jpg        # <- REPLACE: project cover
│   ├── avatar-1.jpg            # <- REPLACE: testimonial avatar
│   ├── avatar-2.jpg            # <- REPLACE: testimonial avatar
│   ├── avatar-3.jpg            # <- REPLACE: testimonial avatar
│   ├── service-1.jpg           # <- optional service image
│   ├── service-2.jpg           # <- optional service image
│   └── service-3.jpg           # <- optional service image
└── README.md                   # Plain-English image swap guide
```

---

## Build Phases

### Phase 1 — Foundation (~20 min)
- HTML boilerplate with semantic structure
- Dark CSS custom properties (all colour + font tokens in :root)
- Space Grotesk + Inter fonts via Google Fonts
- CSS reset + base typography
- Sticky navbar with blur effect and mobile hamburger

**Files:** `index.html`, `css/style.css`

---

### Phase 2 — Hero + Social Proof Strip (~25 min)
- Full-viewport hero section with background image + dark overlay
- Typewriter JS animation cycling through 5 services
- Dual CTA buttons with hover micro-interactions
- Animated stat counter strip with IntersectionObserver trigger

**Files:** `js/main.js`, hero section in `index.html`

---

### Phase 3 — Services + Case Studies (~30 min)
- 5-card service grid with icons, hover glow effects
- Optional image slot per service card
- 3 case study cards with cover image slots, result metrics, and links

**Image slots created:** `service-[1-5].jpg`, `case-study-[1-3].jpg`

---

### Phase 4 — Process + Pricing (~25 min)
- 4-step horizontal process timeline with animated dashed connector
- 3-tier pricing section with featured middle card accent highlight
- WhatsApp secondary CTA below pricing grid

---

### Phase 5 — Testimonials + About + Newsletter (~25 min)
- Mockup review carousel (horizontal scroll on mobile)
- Founder story section with portrait image slot
- Newsletter subscription CTA band with email input

**Image slots created:** `founder.jpg`, `avatar-[1-3].jpg`

---

### Phase 6 — Contact + Footer + Responsive (~30 min)
- Contact form with service dropdown
- WhatsApp deep-link (wa.me/ with pre-filled message)
- Social media icons and email link
- Footer with logo, links, and copyright
- Full mobile-responsive CSS media queries across all 12 sections

---

### Phase 7 — Polish + Deploy (~20 min)
- Scroll-reveal IntersectionObserver applied to all sections (animations.css)
- Hover micro-interactions on all interactive elements
- Test all links: WhatsApp, mailto, anchor scroll, form
- Write README.md image swap guide
- Upload folder to Netlify (drag & drop) or push to GitHub Pages

---

## Summary

| Item | Detail |
|------|--------|
| Total estimated build time | ~3 hours |
| Number of HTML/CSS/JS files | 4 files |
| Replaceable image slots | 12 named slots |
| CTAs covered | Book a call · Buy a package · Subscribe · WhatsApp · Contact form |
| Sections | 12 (Navbar to Footer) |
| Mobile responsive | Yes — full CSS breakpoints at 768px and 480px |
| Hosting cost | Free (Netlify / GitHub Pages) |
| Dependencies | None — plain HTML, CSS, JS only |
