---
name: Quadem Digital Enterprise
description: The built MarketingLab composition with Quadem blue and original CMS imagery.
colors:
  lab-paper: "#f2efe8"
  lab-white: "#fbfaf8"
  lab-ink: "#0a0a0a"
  lab-blue: "#00aeef"
  lab-blue-dark: "#005477"
  lab-black: "#090909"
  lab-deep-blue: "#03111d"
  lab-photo-base: "#00447c"
  bg-surface: "#e9e4da"
  bg-inset: "#e7e2d9"
  bg-hover: "#e4ded3"
  text-muted: "#64635f"
  text-subtle: "#686660"
  border-color: "#d2cfc7"
  border-strong: "#a9a79f"
  accent-hover: "#40c5f8"
  text-on-accent: "#061c28"
  dark-text-muted: "#c1c4c9"
  dark-accent-text: "#6bd7ff"
  pure-white: "#fff"
  footer-text-muted: "#c1cbd4"
  footer-border: "#405060"
  footer-field: "#233444"
  dark-link: "#81deff"
typography:
  display: { fontFamily: "Urbanist, sans-serif", fontSize: "16.5vw", fontWeight: 700, lineHeight: 0.9, letterSpacing: "-.01em" }
  display-italic: { fontFamily: "Urbanist, sans-serif", fontSize: "12.7vw", fontWeight: 300, lineHeight: 1, letterSpacing: "-.03em" }
  headline: { fontFamily: "Urbanist, sans-serif", fontSize: "clamp(38px,4.5vw,64px)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-.025em" }
  body: { fontFamily: "Urbanist, sans-serif", fontSize: "18px", fontWeight: 400, lineHeight: 1.7 }
  action: { fontFamily: "Urbanist, sans-serif", fontSize: "16px", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-.015em" }
rounded:
  select: "8px"
  inset: "12px"
  card: "16px"
  capability-mobile: "18px"
  field: "12px"
  panel: "22px"
  capability: "24px"
  media: "25px"
  portrait: "26px"
  contact-field: "28px"
  large: "30px"
  pill: "999px"
spacing:
  grid-gap: "20px"
  gutter: "30px"
  gutter-mobile: "20px"
components:
  button-primary: { backgroundColor: "{colors.lab-blue}", textColor: "{colors.text-on-accent}", typography: "{typography.action}", rounded: "{rounded.pill}", padding: "15px 28px" }
  button-ghost: { backgroundColor: "transparent", textColor: "{colors.lab-ink}", typography: "{typography.action}", rounded: "{rounded.pill}", padding: "15px 28px" }
  contact-input: { backgroundColor: "{colors.bg-inset}", textColor: "{colors.lab-ink}", rounded: "{rounded.contact-field}" }
  footer-newsletter: { backgroundColor: "{colors.footer-field}", textColor: "{colors.lab-white}", rounded: "{rounded.pill}", padding: "5px", height: "56px" }
  navigation: { backgroundColor: "transparent", textColor: "{colors.lab-ink}", rounded: "0", padding: "28px 30px", width: "100%" }
  project-status: { backgroundColor: "{colors.lab-white}", textColor: "{colors.lab-ink}", rounded: "{rounded.pill}", padding: "7px 11px" }
  pricing-card: { backgroundColor: "{colors.lab-paper}", textColor: "{colors.lab-ink}", rounded: "{rounded.large}", padding: "30px 24px" }
---
## Homepage mobile overview, 21 September 2026

At widths up to 800px, and in short landscape windows up to 1000×500px, services
use a compact native disclosure list: all seven CMS service names are visible,
with one full illustrated story available at a time. The repeated directory is
replaced by one all-services link. Featured work shows all four projects as
thumbnail/title previews with their real project status and service category;
full case-study copy is reached through the image or title link. Previews use
one column below 600px and two columns on larger compact screens.

The mobile overview is about 84% shorter at 390×844. Desktop retains the paired
services and full project stories below. All original service artwork, evidence,
CMS ordering and automatic motion remain. Details:
`docs/homepage-mobile-density-2026-09-21.md`.

## Homepage service arrangement, 21 September 2026

Service cards follow the CMS order in consecutive pairs. Paired artwork and
captions share a row, titles begin together, and actions align at the bottom.
Only an unpaired final service spans the full row with artwork beside its copy;
no particular service is hardcoded to that position. Mobile now uses the compact
overview described above. Original artwork, source captions and evidence links remain.
Details: `docs/homepage-services-layout-2026-09-21.md`.

## Responsive behaviour, 21 September 2026

The public site's full navigation starts at 1200px. Smaller windows use the
mobile drawer with the booking action retained above 560px. Widening an open
drawer to desktop closes it and releases page scrolling. The footer uses two
columns through 1100px, with brand, newsletter and contact spanning the row;
long contact addresses wrap within their column. Verified across all 40 public
routes from 320px phones to 3440px desktops, plus motion through 3840px.

Motion starts automatically independently of the device preference, as the
user explicitly requested on 21 September. An explicit site pause persists.
Details: `docs/responsive-display-2026-09-21.md` and
`docs/automatic-motion-2026-09-21.md`.

## Current homepage image, 20 September 2026

Cinematic studio hero selected by the user: current Omek frontend on the dominant desktop display, QuajoSpeaks on the foreground laptop, original Quadem identity on stationery and a video camera. AI-assisted conceptual studio scene, with Omek in progress and QuajoSpeaks internal. Warm photographic lighting and navy copy space; this is not a claim about actual Quadem premises. Dedicated home-studio responsive image leaves service artwork unchanged. At 801–1100px copy narrows to protect the screen; below 800px the photograph and caption have their own space after the copy. Raised-card tilt, scroll parallax and reduced-motion controls remain.

The older hero descriptions below are historical. The active asset is the `home-studio` entry in `src/lib/workImageManifest.json`; only the homepage consumes it. Prompt and source provenance are recorded in `docs/cinematic-home-hero-prompt-2026-09-20.json`.

# Design System: Quadem Digital Enterprise

## Current work-based image system, 20 September 2026

The user's latest correction supersedes the generic four-image service family.
Use Quadem's actual work to explain each service. The current authority remains
`src/styles/visual-story.css`, `src/lib/serviceVisuals.ts` and
`src/components/home/ServiceStories.astro`, with `ServiceArtwork` and `WorkCaption`
keeping image treatment and provenance consistent across cards, heroes and the
directory.

All seven services have visual cards. Web design uses an explicitly labelled
AI-assisted device mockup based on the actual Omek and QuajoSpeaks designs.
The laptop now uses the live Omek frontend captured on 20 September 2026,
including its current logo, white navigation and dark living-room TV hero.
Omek remains in progress; QuajoSpeaks is an internal project. Branding uses the original Quadem identity presentation.
Search uses an unaltered capture of the published research figure, keeping its
Semrush source, dates and non-client-results qualification. Video and marketing
pair actual frames from the existing portfolio films, contained at their native
vertical proportions. These frames are creative work, not documentary photos.
AI Automation uses a labelled internal-workflow demo with sample messages based
on the implemented WhatsApp intake. Fieldwork uses the original redacted record
and links to the existing full-resolution evidence reader; never use generated
text as evidence.

The desktop seven-card grid has two columns, with the unpaired final card spanning the
row as image plus copy. Mobile uses the compact disclosure list above. Source captions and links
sit beside each image, while the service benefit, deliverables and action remain
together. Image/copy pairs keep the existing scroll motion. The header, Quadem
blue, founder portrait, honest project statuses, Ghana prices, CMS business data,
forms and explicit motion preference are preserved.

The homepage keeps its customer-outcome headline and booking CTA. Its device
mockup has a visible provenance line and a strengthened dark scrim behind the
copy. The mobile image sits below the copy. The sales sequence remains hero,
positioning, services, actual work, process, products, founder, prices, FAQ,
insights and contact. The same work imagery appears in the service directory
and corresponding heroes. Fieldwork's original hero and evidence gallery stay
intact.

Published image variants live in `public/images/work-based/`; largest files are
31–173 KB. `src/lib/workImageManifest.json` records their actual dimensions and
width descriptors. Prompts: `docs/work-based-image-prompts-2026-09-20.json`.
Sources, hashes and qualifications: `docs/work-based-image-assets-2026-09-20.json`.
The generated Fieldwork presentation is retained in output for review only;
the factual document is displayed directly. The older files in
`public/images/studio/` are historical and no longer used by public templates.

The remaining sections record earlier design iterations and are historical
where they differ from this section.

## Earlier reference baseline

**Creative North Star: "MarketingLab composition, Quadem blue"**

The confirmed world follows MarketingLab's composition and behaviour across the public website, with Quadem blue, the supplied logo and original CMS imagery. Monumental live Urbanist sits over a raised, full-image hero; cream editorial sections alternate with black process cards and deep-blue photographic sections. Wide navigation, large statements and native scroll sequences give the work room to be seen. The reference's imagery is adapted to Quadem's actual assets and factual founder-led story. This record covers the public website, not the portal, invoices or CMS.

**Key Characteristics:**

- Original CMS artwork and the supplied Quadem logo
- Oversized Urbanist with bold and thin italic contrast
- Deliberate cream, black and deep-blue section palettes
- Full-width disclosure rows and broad photographic fields
- Real work and visible native scroll choreography

Authority: the opening body contract in `src/layouts/BaseLayout.astro`, `src/styles/marketinglab.css`, the inner-page overrides in `src/styles/page-hero.css` and final image rules in `src/styles/media-presentation.css`, `src/styles/studio-motion.css` and `src/scripts/studio-motion.js`.

## Colors

**Primary:** Quadem blue fills actions, capability accents and the values progress line. Dark blue supplies readable accent text on paper; dark sections use a lighter readable blue. Dark ink remains on blue buttons.

**Neutral:** warm cream is the page and introduction field, soft white the raised work surface, and near-black the process field and values cards. Deep blue underlies original imagery in the hero, values, expanded services and lower footer. Muted warm-grey copy and thin borders support cream sections; cool light copy, slate borders and a dark input support the lower footer. The centred footer invitation remains cream and displays Quadem's actual logo.

**The Section Palette Rule.** Palettes belong to sections, not visitor-selected themes. Root tokens are explicitly identical for the old light preference; there is no theme toggle. Retain local dark-section tokens rather than restoring the former dark-base/light-switch design.

## Typography

Urbanist is self-hosted: normal variable weights 100–900 in `/fonts/urbanist/urbanist-latin.woff2`, and real italic weight 300 in `/fonts/urbanist/urbanist-italic-300.ttf`, both with swap display. WEB DESIGN occupies the first line; the thin italic AGENCY sits on a separate, right-aligned second line at every size. The first line uses the original Brands artwork clipped into semantic HTML text with a constant white overlay; unsupported browsers receive solid soft-white text. At 560px the first line becomes 15vw and the italic remains 12.5vw. The heading fits the reviewed 320px and 390px phone widths.

**The Original Artwork Rule.** Image-filled headline lettering is a deliberate reference treatment, not a colour-changing text gradient. Both stops of its white overlay are identical; preserve the original CMS image and the solid-colour fallback. The single gradient-text detector warning was reviewed against this implementation and the final hero screenshot.
Section headings reach 64px, or 86px on large desktops, usually weight 600; editorial body copy is commonly 19–22px at 1.35–1.5 line-height. Shared page titles use 550-weight Urbanist at 1.02 line height: editorial `clamp(58px,6.8vw,132px)`, visual-service `clamp(52px,5.6vw,112px)`, and long service titles `clamp(44px,4.1vw,82px)`. At 800px the heroes stack; titles reduce to 44–72px, with 35px minimum for long service titles on small phones. Offset introduction labels use 20px/1.4, weight 400, beside 34px/1.14 statements. There is no modular type ratio.

## Layout

Content centres within 1200px; at 1600px and wider the container grows through `clamp(1280px,80vw,1800px)`. Gallery images grow from 260px to 370px tall, with larger section type, copy and cards. Section padding is 110px 30px, becoming 70px 20px at 560px. Full-width hero, service rows and navigation extend beyond that container. The absolute header is inset at the top with no capsule, border, shadow or sticky scrolling. At 900px navigation links become a mobile menu; the header CTA stays visible until 560px. Mobile header padding is 22px 20px.

The home hero is a raised full-image card, explicitly requested by the user. Its paper ground has 8px top/side insets and 16px beneath, a card radius and a soft downward shadow. The card uses `clamp(752px,calc(100svh - 24px),1100px)`, with 148px 22px 46px padding. Below 560px the bottom ground is 12px, the card is at least `max(780px,calc(100svh - 20px))` and padding is 264px 12px 38px. Original Reels artwork covers the card under a dark lower scrim. Navigation and two title lines sit above bottom introductory copy and truthful location/working facts. Fine-pointer movement tilts the card by at most 4/5 degrees; native scroll reduces scale by up to 17% with an 8-degree rotation. The original image also shifts. A finite loop uses elapsed-time easing (110ms pointer and 85ms scroll time constants), snaps exactly to its resting target, and stops offscreen or when hidden. Headline size is constrained by viewport height as well as width and a 2200px content limit. Reduced motion leaves a static raised card.

A moving service ribbon follows the hero, then a cream introduction with a scroll-read statement. The four original image links belong in What we create after the introduction. They use the actual portrait aspect ratios inside the shared container, with 24px gaps and four columns. At 561–1000px they form two columns; below 560px they remain a 72%-width native horizontal swipe rail. Artwork is contained, with existing captions and service destinations.

Shared PageHero openings now follow the user's mixed direction: original artwork beside service copy, editorial titles for Projects, About, Blog, Contact, Offers and Calculator. Editorial titles and supporting copy share a 1.45:1 row with a bottom hairline; visual heroes use a 1.08:1 grid, 40–100px gap and 140–180px header clearance. Original service art is contained at its own aspect ratio, bounded by 74svh and 720px width, with a 24px radius and soft lift. Fieldwork shows its actual redacted delivered record and retains verbatim copy and its single enquiry action. Dynamic service pages share this component and retain their video slot. The homepage hero and bespoke Global, case-study, article and legal layouts retain their existing compositions.

Below 800px the copy, actions and image stack, with a 520px media limit and 18px radius; small-phone actions fill the column. Long titles use their own scale. Services keeps the Opportunity/triptych introduction after the visual hero. Contact's wizard and Ernest's original portrait follow its editorial opening. About keeps its original founder section, now reachable through Meet the founder. Existing filters, country pricing, enquiry fields and CMS copy stay connected.

**Process:** sticky choreography requires at least 1200px width, 700px height, full site motion and every card fitting with 24px bottom clearance. The heading and tallest card are measured together, centred in the viewport with a gap up to 64px. Portrait cards have a 455px minimum height and indexed vertical spacing, growing to 480–580px on large desktops. The heading sticks above the assembled row. Both measurements update after resize or content changes. Below 800px, the centred introduction leads to a keyboard-focusable horizontal swipe rail with 455px-high, square-cornered cards: 72% width at 561–800px and almost a full panel on phones. Other unpinned sizes use the ordinary grid. Unpinned cards receive one 700ms arrival with at most 180ms sibling delay. Reduced motion removes arrivals and sticky transforms while retaining the native swipe rail.

**Work:** stacking requires at least 1000px width, 760px height, full site motion and every visible card fitting beneath its sticky top with 24px clearance. Home sticky offsets clear the measured heading (minimum 240px), while project-library offsets clear the measured filters (minimum 110px); preceding cards scale down by at most 9%. Cards stack vertically at 800px. Focused panels return to full scale and rise above the stack.

## Elevation & Depth

The raised hero, image layering and overlapping work panels establish depth. The active raised hero shadow is `0 38px 70px -28px var(--lab-ink)`. Pointer tilt reaches 4°/5°; scrolling shrinks the card to .83, tilts it up to 8° and separates its title lines in opposite directions. Navigation is flat and transparent; pricing is defined by a substantial 10px frame, white normally and ink for the popular tier. Existing supporting shadows may remain on inherited cards and dropdowns; they are not the defining material. Process cards reuse the original CMS artwork under a dark scrim for text legibility. The invitation logo is contained at 150px. Values use a viewport-sized sticky original Brands backdrop beneath a dark scrim, so the image remains legible as cards pass. Expanded service rows repeat their assigned service artwork as a cover background under a scrim, alongside the contained foreground image. The lower footer uses the original Reels background.

## Shapes

Large work, values and pricing panels use the large radius. Desktop process uses the panel radius and the mobile rail uses square corners; capability tiles use the capability radius and become 18px on mobile. Introductory images use the media radius. Buttons and project labels remain pills; wide navigation and section boundaries are square. Disclosure and image-link controls are circular. The user-requested raised hero is the deliberate exception to the flat section boundaries; do not add browser chrome or a tilted note composition.

## Components

**Buttons:** 52px minimum height, 16px type and 15px 28px padding. Primary is blue; home navigation booking is white; ghost controls have a stronger outline. Anchor CTA labels roll vertically by 140% on pointer hover and keyboard focus over 350ms using `cubic-bezier(.16,1,.3,1)`. Duplicate text is hidden from assistive technology. Submit/loading labels are not duplicated. Preserve the inherited 2px focus outline with 5px offset.

**Inputs:** contact fields use the warm inset field and the contact-field radius, with functional labels, validation, consent and the existing blue focus treatment. The lower-footer newsletter is a dark pill with a thin slate border, 56px minimum height, 5px inset and a blue circular SVG-arrow submit control. Its field is transparent with light text; the form remains tied to the existing newsletter behaviour. Supporting standalone newsletter fields retain their soft-white treatment.

**Navigation:** broad textual Quadem Digital wordmark, central route links, All pages native disclosure and a right booking action. The actual Quadem logo image is visible beside the wordmark in the header and footer: 48px normally, 40px below 1100px; the global header uses 44px. Never hide the supplied mark to imitate the reference brand. The homepage version is white over deep blue; inner pages use ink on cream. Mobile uses the existing scripted drawer with inert state, expanded labels, focus management and Escape. All pages also supports keyboard operation and dismisses when focus leaves or the visitor clicks elsewhere.

**Service disclosures:** a numbered full-width row opens a photographic deep-blue panel using its actual CMS service image as the background, with explanatory copy, the same contained foreground artwork and cream capability tiles. Seven homepage rows follow the CMS promotion order, wording, CTA settings and corresponding service imagery. Images use contain; desktop heading columns clear the image by 32px. Start your project is an independent booking link outside summary, while the disclosure only expands content. Mobile places that CTA below the disclosure. Grouped panels animate between measured heights, 380ms open and 250ms closed, and interrupted motion keeps the selected state. Opening reveals the image over 800ms and the configured text, capability group and CTA over 650ms, staggered from 80ms. Interrupted toggles cancel obsolete child animations. Hash targets open their containing panel.

**Work and pricing:** work panels place text beside uncropped contained project imagery, with soft-white status labels. Keep Client project, Internal project, Concept project and In progress truthful. Pricing uses cream cards with heavy frames, 27px names, `clamp(31px,3.1vw,45px)` prices and blue actions. Preserve market groups, currency, cadence and distinct detail/booking links; mobile pricing stacks. Pricing follows the visitor’s detected country automatically, without a country selector or saved override. Africa uses the independently set GHS list converted into the local currency; all other continents use the independently set USD list converted into the local currency. Ghana and the US keep their set amounts. Development defaults to Ghana only when no edge location is available; production uses edge detection. Unknown location uses USD; unavailable conversion retains the selected list’s base currency with a matching currency note. Highlighted dark price cards use light readable feature text.

**Values and FAQ:** five alternating black commitment cards flank a vertical progress line; mobile puts the line left and the count above each card. Scroll fills the line in blue using scaleY and moves each card in from its alternating side through `--value-reveal`. Copy remains readable. The original Brands image fills a sticky 100svh background, not the entire multi-screen track stretched into one image. Reduced motion uses a static vertically repeated viewport-sized backdrop. FAQ uses native details/summary; open rows become blue, with an inline SVG plus rotating inside its circular control.

**Footer and controls:** the cream invitation leads into the original Reels photographic base. Brand and social links occupy the upper-left half; the newsletter occupies the upper-right half. Actual CMS link groups and contact form the lower four columns. At 800px the grid becomes two columns, with brand, newsletter and contact spanning the width. Preserve CMS ordering and Ghana-only offer visibility. Directional controls, FAQ symbols, checklist marks, modal close and back-to-top use stroke SVGs. The video overlay is hidden when closed and becomes a fixed dark overlay only in its active state.

**Section motion:** scroll position is the timeline, so motion replays forward and backward. Headings unfold word by word through clipped masks over 48% of the viewport, with original text nodes and nested links preserved. Above-fold inner titles also have a 1150ms opening sequence. Original gallery images fan from ±15° and .78 scale into a full-colour row; pricing, product, service-type, trust, article and About cards unfold from a viewport-scaled 72–150px lift, 14° depth rotation and alternating 4° tilt. Large surfaces complete over 72% of the desktop viewport, 52% on mobile. Image crops open, service titles slide from 65px left, and supporting copy rises by 54px. One shared frame batches geometry reads before effect writes; only nearby elements are sampled. Focused links and enquiry forms settle immediately. State is `data-story` plus `data-story-state`, and all wrappers, effects and observers are cleaned up on navigation or preference changes. The native process and project stacks keep their own geometry.

**The Native Flow Rule.** Scrolling stays native and the default HTML remains visible. The service ribbon travels for 32s per cycle, the hero image drifts over a 12s alternate cycle and its scroll arrow moves over 1.8s. These loops stop when their section is offscreen or the document is hidden. The cream introduction progresses from muted to ink with an 8px word lift. The bottom-left motion control follows the OS preference until the visitor chooses otherwise. With OS reduction enabled it offers Enable motion; that explicit choice enables this site's complete motion system and persists across navigation/reloads. Pause motion and Resume motion remain available, including for contact wizard transitions. CSS and JavaScript use the same resolved body state. Both modes remove word wrappers, hero transforms and pinned sequences, leave the values line full and its image static, retain native swipe rails and preserve exact text and typed form values. The control is absent without JavaScript. The original SEO and video illustrations remain service artwork; Ernest uses his actual portrait.

## Do's and Don'ts

- **Do** preserve the full MarketingLab composition and behaviour, Quadem blue, section palettes and self-hosted Urbanist.
- **Do** keep the full-image two-line hero, cream introduction, separate original-image gallery, mobile process rail and photographic lower footer in their built sequence.
- **Do** use the existing CMS hero and service assignments, preserve their alts and distinguish service artwork from real founder and client evidence. Current asset mapping lives in `docs/original-images-motion-2026-09-19.md`; `docs/marketinglab-assets.md` is historical provenance for superseded generated assets.
- **Do** retain native disclosures, independent booking links, fit-gated sticky sequences, keyboard access and reduced motion.
- **Do** use British spelling, factual work classifications, market-specific prices and transparent billing cadence.
- **Don't** restore the Web-De capsule header, small two-column sculpture hero, gallery inside the hero, dark introduction, plain values backdrop, Inter identity or theme toggle.
- **Don't** replace Quadem facts with template clients, ratings, revenue claims or invented impact metrics.

## Original settings restored, 19 September 2026

The original live site and all ten public CMS globals were compared with the rebuild. Desktop/mobile CMS menus, editable homepage promotions and CTAs, original product cards, the homepage enquiry form, About content, service hero fields, social links, certifications, newsletter copy and search metadata are connected again. The reference composition, original assets, blue accent and motion remain. CMS headline copy appears in the cream introduction; newsletter lives in the footer and the old calculator anchor points to the full calculator. Details and explicit environment limits: `docs/original-settings-parity-2026-09-19.md`.

## Expressive motion, 19 September 2026

The user rejected one-time, restrained entrances and explicitly requested much stronger movement throughout the website. The current treatment supersedes the earlier 850ms arrival controller: a 1650ms two-line hero opening, scroll-driven separation and raised-card recession, replayable word choreography, full-colour artwork fan, perspective card arrivals, image apertures and stronger alternating values motion. Original media, CMS settings, brand blue, Ghana prices and enquiry flows remain connected. The shared implementation is in `src/scripts/story-motion.js`, `src/scripts/studio-motion.js` and `src/styles/story-motion.css`. Browser evidence and limitations are recorded in `docs/expressive-motion-2026-09-19.md`.


## Inner-page hero direction, 20 September 2026

The user selected image-led service heroes and cleaner editorial titles elsewhere. `PageHero.astro` and `page-hero.css` implement that choice. Service artwork gets a finite 1400ms aperture/lift entrance, then a reversible native-scroll arrival/rest/recession timeline. The resting card is full size; exit moves up to 70px with 2-degree rotation and .95 scale. Word-mask title entrances remain shared. Default reduced motion and explicit Enable/Pause/Resume retain their existing precedence. See `docs/inner-page-heroes-2026-09-20.md`.


## Image presentation, 20 September 2026

The user requested an image pass across the whole public website. `src/styles/media-presentation.css` is now the final image-specific stylesheet in both public layouts. Service art and project screenshots retain the complete composition; editorial thumbnails use a deliberate 4:3 crop; founder portraits use 5:7 with a 560px maximum (440px on Global). The international portrait previously stretched to a square; the shared rules target the actual Picture child correctly. Artwork frames no longer invent an unrelated landscape or square shape. Project status labels sit outside the screenshot. Product images render consistently whether Picture outputs a picture element or a plain img. Article covers grow to their actual height. Promotional images remain fully visible without a hover crop or glow over the artwork.

`Picture.astro` uses CMS intrinsic dimensions, carries the actual aspect ratio and editor focal point, and keeps tiny marks on the smaller WebP ladder. `mediaPresentation.ts` centralises responsive image-size hints for the 1200–1800px container. Srcset descriptors use actual derivative widths. Optimised variants, lazy loading and original CMS assignments remain. Native gallery dialogs retain keyboard navigation and gain a link to the selected full-size original; service and CMS-block still-image galleries also link to the original. No assets were replaced or regenerated. See `docs/image-presentation-2026-09-20.md`.
