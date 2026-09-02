# Handoff: quademdigital.com

Read this file before writing any code. Written 21 August 2026, rewritten 25 August 2026
after a session that built most of what the previous version described as outstanding.

You are working on the website for **Quadem Digital**, a one-person agency in Accra,
Ghana, run by **Ernest**. The site sells web builds, SEO, AI automation and short-form
video to clients in the UK, Europe and the Gulf.

**If you read nothing else, read "Deploy runbook" below.** Several pieces built on
25 August are finished in the repo and deliberately not yet live, and the order they go
live in matters.

---

## Hard rules

1. **No em dashes.** Not in copy, not in comments, not in commit messages. Rewrite the
   sentence rather than swapping the character. There is already a guard for this:
   run `pnpm check:copy` before you consider any copy task done.
2. **First person is Ernest.** The site speaks as one person, not a company. Never use
   the name Edem.
3. **Invent nothing.** No placeholder clients, no sample testimonials, no made-up
   figures. If you need a number you do not have, leave a visible `TODO` and say so.
4. **No hardcoded colours.** Use the theme tokens. `pnpm check:theme` enforces this, and
   the baseline is zero, so a single new dark literal fails.
5. **British spelling**, matching the existing site and the UK target market.

---

## What this repo actually is

- **Astro 6.4**, React 19 for islands, `@astrojs/vercel` adapter, **pnpm**, Node >=22.12.
- **Content lives in Payload CMS**, in `cms/`. It has its own `cms/CLAUDE.md`. Read it.
  In particular: any field added to a collection or global needs a matching migration in
  the same commit, because schema push is inert outside development.
- The Astro site reads the CMS through `src/lib/payload.ts`: `payloadFetch`,
  `payloadFetchGlobal`, `getPayloadImageSize`, `getPayloadImageSrcset`. There is a 60
  second in-memory cache in that file, added deliberately because the CMS is a single
  small instance that was being overloaded. Do not remove it without reading the
  comment at the top of the file.
- **`studio/` is legacy Sanity and is not what the site renders.** Ignore it.
- Pages are in `src/pages`, layout in `src/layouts/BaseLayout.astro`.
- Specs live in `docs/`. Put any new spec you write there, not in the root.

### The layout structure, changed 25 August 2026

`BaseLayout` used to hold everything. Two pieces were lifted out of it so a second shell
could exist without copying them:

```
src/components/SiteHead.astro     the whole <head>, shared by both layouts
src/components/SiteScripts.astro  the deferred third-party loader, shared by both
src/layouts/BaseLayout.astro      the site's normal shell
src/layouts/GlobalLayout.astro    the shell for /global only, its own nav and footer
```

`BaseLayout` gained three props, all of which are used:

- `noindex` emits `<meta name="robots" content="noindex, nofollow, noarchive">`.
- `suppressExitPopup` removes the exit-intent modal. `AnalysisLayout` always sets it.
- `ogImageSize` declares the card dimensions, so a page shipping its own Open Graph
  image does not silently lose them.

**Hiding a page from search takes three things, not one.** `noindex` on the page, a
`Disallow` in `public/robots.txt`, and an entry in `UNLISTED` in `src/pages/sitemap.xml.ts`.
Leaving a route out of the sitemap is the absence of a signal, not a signal. Fieldwork was
the worked example until it was published on 28 August 2026, and undoing all three at once
is what publishing it took. `UNLISTED` is now empty and kept for the next page that needs
it. `/wardrobe/` still uses the robots half.

### Guard scripts, all of them worth running

```
pnpm check:copy       # em dashes, in the repo AND the CMS AND the Resend templates
pnpm check:theme      # hardcoded colour literals, baseline zero
pnpm check:csp        # off-site assets the content policy would refuse
pnpm check:cdn        # the CDN allowlist
pnpm check:blog       # every bespoke blog route has a matching CMS document
pnpm check:global     # the banned Ghana strings, checked on rendered /global
pnpm check:booking    # every Calendly URL the site can serve actually resolves
pnpm check:migrations # every migration is registered, and every import parses
pnpm check:handoff    # this document still matches the repo
pnpm check:images     # image weight
pnpm charts:analysis  # regenerate an analysis chart from its numbers
pnpm optimize:video -- <file>
```

`check:copy` has three exit codes and they are not interchangeable. 0 is clean, 1 means
real em dashes were found, and 2 means it could not reach the CMS or Resend and has
therefore not checked most of the copy on the site. **Exit 2 is not a pass.**

`check:blog` and `check:global` follow the same convention: exit 2 means it could not
check, which is not a pass either.

`check:booking` exists because the Calendly account the whole site linked to had been
deleted, and Calendly answers a dead link with HTTP 200 and a page titled "404". A status
check alone would have called it healthy. It checks the title too.

`check:migrations` exists because the same fault broke the CMS deploy three times. This
drive is exFAT, which scatters invisible `._` sidecar files next to real ones, and the
migrations index is built by scanning that folder. It picks one up and writes an import
that is not valid JavaScript, pointing at a file that is gitignored and so never reaches
Railway. It builds on this machine and dies on the server. The guard fails on an import
that cannot parse, an import with no file behind it, and a migration on disk that nobody
registered.

### The analysis format

The look of the UK aesthetics teardown is a reusable system in this repo. Use it for
anything data-led. Do not restyle a page from scratch.

```
src/styles/analysis.css              design system, on this site's tokens
src/layouts/AnalysisLayout.astro     shell, dateline, Report schema for citation
src/components/analysis/             SectionHead, StatTiles, Figure, Callout
scripts/build-analysis-charts.mjs    chart geometry, computed from the numbers
docs/analysis-format.md              how to use it, and the rules that make it work
```

Read `docs/analysis-format.md` before writing an analysis page. Three additions were made
to the system on 25 August, all additive: the table rules now also apply inside
`.tablewrap` so a table can be used outside a full analysis page, `.checks` and `.foot`
style the ending every piece shares, and `rect.s-1/2/3` plus `.value` and `.cat` support
bar charts. `AnalysisLayout` also gained `seoTitle`, for when the headline is an argument
and far too long for a search result.

**Chart numbers are computed, not drawn.** `scripts/build-analysis-charts.mjs` holds the
data and prints SVG. If a figure changes, regenerate rather than nudging a coordinate.

### Images and video

Both are optimised on upload and nothing needs running by hand for the normal case.
Read `docs/media-optimization.md` before touching anything that renders media.

- **Upload a video and it plays heavy for a minute, then gets light.** `videoStatus` on
  the media doc says where it is.
- **Audio is removed by default.** Set `videoUsage` to "plays with sound" for a showreel.
- **Never write a bare `<img>` or `<video>` for CMS media.** Use `src/components/Picture.astro`
  and `src/components/Video.astro`.

### One gotcha

The project sits on an external drive, so macOS scatters `._*` AppleDouble files
everywhere. `.gitignore` covers them. Never commit one, and ignore them when listing
directories.

---

# Deploy runbook

Nothing below has been deployed. Ernest deploys. The order matters, because three CMS
scripts write content that points at routes which do not exist on the live site yet.

**Step 0. Open one shell and set it up.** Both lines matter, and an earlier version of
this runbook omitted them and wasted a run.

```
cd "/Volumes/QUADEM/VIBE CODING/Quadem Digital Enterprise"
export PATH="/Users/macbookpro/.nvm/versions/node/v24.16.0/bin:$PATH"
```

`pnpm` is installed under Node v24.16.0 only. The default `node` on this machine is
v24.18.1, which has no `pnpm` at all, so without that line step 1 fails with
`command not found` before anything runs.

**Every command below is written from the repo root and must be run from there.** The
step 1 command is wrapped in brackets on purpose: that is a subshell, so it enters `cms`,
runs, and leaves the shell where it started. Writing it as `cd cms && ...` moves the
shell, and then every `node cms/scripts/...` line afterwards looks for that path nested
inside cms a second time, and fails.

**Step 1. Deploy the CMS (Railway), so the four new migrations run.**

```
( cd cms && pnpm migrate && pnpm smoke-test )
```

- `20260825_105216_add_case_study_metrics` adds the `case_studies_metrics` table and four
  columns to `case_studies`.
- `20260825_110148_add_site_settings_address` adds `site_settings.address` and seeds it
  with `18th Ahmadiyyah Avenue, Lakeside, Accra, Ghana`. The seed is guarded with
  `WHERE address IS NULL OR btrim(address) = ''`, so a later edit in the admin always
  wins and a Railway replay cannot put the old address back.
- `20260827_090000_set_contact_email_to_ernest` moves `site_settings.email` from
  `info@` to `ernest@`, guarded to the one value it was written to move.
- `20260827_093000_add_pricing_plan_market` adds `pricing_plans.market`, defaulting to
  `ghana` so the three existing rows keep meaning what they mean today.

All four are additive and guarded, and every data change carries a `WHERE` clause narrow
enough that a Railway replay cannot undo a later edit.

**Step 2. Deploy the site (Vercel).** Nothing in the repo depends on step 3 having run:
every new field is read defensively, so a missing value renders nothing rather than
breaking a page.

**Step 3. Run the CMS content scripts.** Every one of them takes `--dry-run` and every
one has been dry-run already. Run them in this order:

Run each with `--dry-run` first and read what it says it will change. From the repo root:

```
node cms/scripts/fix-homepage-copy.mjs             # after step 2, needs the new hero CSS
node cms/scripts/seed-international-pricing.mjs    # after step 1, needs pricing_plans.market
node cms/scripts/seed-services.mjs                 # publishes 2 pages the moment it runs
node cms/scripts/seed-analysis-blog-posts.mjs      # after step 2, not before
node cms/scripts/seed-omek-case-study.mjs          # after steps 1 and 2
node cms/scripts/add-prospect-privacy-section.mjs  # safe any time, backs up first
```

`seed-analysis-blog-posts` is the one with the sharpest ordering trap. It puts two cards
into the live blog index and two items into the live RSS feed. If the routes are not
deployed yet, both advertise a URL that answers 404 for as long as the deploy takes.

`seed-international-pricing` writes `market`, a column step 1 creates. Run it against a
database without that column and Payload drops the unknown field silently, leaving every
plan on the default, which puts the Ghana packages in front of international visitors and
the international tiers in front of nobody.

`seed-services` is a one-way door. `Services` has no draft state and the sitemap maps every
document, so Fieldwork and AI Automation are public and advertised for indexing the moment
it runs.

`fix-homepage-copy` is the first thing ever to write `heroSubheadline`, which turned out to
need nothing from the deploy: `HeroSection.astro` has always styled it. It is the first thing ever to write
`heroSubheadline`, and the `.hero-subheadline` rule that styles it ships with step 2, so
running it against the old build puts a third hero paragraph on the live homepage at
unstyled body defaults. Nothing breaks, it just looks wrong until the deploy lands.

**Step 4. Verify.**

```
node scripts/check-blog-routes.mjs                                      # must exit 0
node scripts/check-global-exclusions.mjs --url=https://quademdigital.com/global/
node scripts/check-csp.mjs --url=https://quademdigital.com/global/
pnpm check:copy                                                         # must exit 0
```

Then run PageSpeed Insights against `https://quademdigital.com/global/`. Local Lighthouse
is too noisy on this machine to be worth reading.

**Step 5. One thing only Ernest can do.** Point the cold email sequences at
`https://quademdigital.com/global/` **with the trailing slash**. `trailingSlash` is
`always`, so a link without it takes a 308 redirect before the function runs, on the
single most performance-sensitive URL in the business, and some sending platforms drop
query parameters across a redirect, which would lose the campaign attribution.

---

# What was built on 25 August 2026

## Job I: the em dash audit. DONE.

`pnpm check:copy` ran in full for the first time, with the CMS and Resend both reachable
and all three keys present. **Exit 0.** Zero em dashes in the repo, zero across 15 CMS
collections and 10 globals, zero in the Resend templates, and no template sitting on an
unpublished draft. The "27" reported on 22 August was a dead network, exactly as the
previous version of this document suspected.

## Job E: the UK aesthetics teardown. LIVE.

Route: `src/pages/blog/uk-aesthetics-search.astro`, on `AnalysisLayout`.

Rebuilt from `docs/uk-aesthetics-teardown-source.html` rather than ported: the source's
CSS was left behind, so the page inherits the site's light and dark themes, the site nav
and footer, and the `Report` structured data that makes a claim citable. Sections 01 to
06 in order, three inline SVG charts, every figure keeping its "Semrush UK estimates"
label, section 05's five checks and section 06's method paragraph verbatim.

**One thing was dropped in the port and you should know about it:** the source had a
hover crosshair that tracked across all three charts. It was the only client-side script
on an otherwise inert page, `analysis.css` has no support for it, and the hot-zone
rectangles that drove it were roughly half the weight of each chart. Say the word and it
can come back.

The exit-intent popup does not fire on this page or the next one. That is deliberate and
`AnalysisLayout` enforces it: `docs/analysis-format.md` says a piece that ends in a sales
pitch gets read once and never linked, and a modal offering a free audit on the way out
is that pitch.

## Job F piece 01: the crawl study. LIVE.

Route: `src/pages/blog/small-business-website-crawl-2026.astro`.

Every figure from `docs/crawl-findings-2026-08-21.md` and nothing recomputed. The four
approved wordings are used verbatim, all six caveats are in a method callout near the
top rather than at the bottom, and every claim carries its own denominator and "August
2026" inline. Three stat tiles: 42.9%, 15.6%, 15.9%.

Three charts, all computed by `scripts/build-analysis-charts.mjs` from the counts. It is
worth knowing why that script exists: the first version of the geometry was written in a
throwaway script, and porting it to the repo's own conventions caught a real defect,
where "2.0%" was being printed as "2%" among neighbours quoted to one decimal.

The piece mentions that the same machine is available as a service without linking
Fieldwork, which was `noindex` and disallowed when it was written. Fieldwork is public as
of 28 August 2026, so that link can now be added, and should be: the crawl study is this
service running, and section 07 of the Fieldwork copy asks for the link in both
directions.

**Slug not confirmed with Ernest.** `small-business-website-crawl-2026` was chosen. If he
wants a different one, change it before `seed-analysis-blog-posts.mjs` runs, because the
CMS document and the filename must match exactly and `check:blog` fails if they drift.

## Job A: the Omek case study. THE TABLE IS LIVE, ON THE PUBLISHED STUDY.

The schema gap is closed. `CaseStudies` now has `metricsTitle`, `metricsBeforeLabel`,
`metricsAfterLabel`, `metricsSource` and a `metrics` array of
`{ section, label, before, after, highlight }`, rendered by
`src/components/MetricsComparison.astro` between the narrative and the gallery.

Three decisions inside it worth not undoing:

- `before` and `after` are text, not numbers. The values are "19.3s", "300ms", "0.001".
  A number type would force formatting at render time, and that is where rounding creeps
  in.
- An empty value renders **"not recorded"**, never a blank cell and never a dash. Five of
  the July desktop sub-metrics were genuinely never captured.
- The tiles use the neutral default, not the series colours. Colouring before red and
  after green reads as marketing rather than measurement.

**The narrative is written from evidence.** The omek-storefront repo is on this drive and
its git history dates the work: image domains repointed to `api.omekgh.com` on 6 July;
LCP image priority, ScrollReveal removed from the shop page and server-side fetching
parallelised on 9 July; brand and payment logos set to lazy, analytics and the Meta pixel
moved from `afterInteractive` to `lazyOnload`, and the Jetpack Photon CDN bypassed for
AVIF and SVG on 10 July. **Ernest should read the body copy before it publishes**, since
this was reconstructed rather than dictated.

**Blocker 2, measurement parity, is closed.** It was that the July run's throttling was
never recorded, so the two runs were not confirmed like for like. Ernest confirmed on
29 August 2026 that both were taken with pagespeed.web.dev, which runs Lighthouse on fixed
settings and exposes no throttling control at all: every mobile run gets the same emulated
Moto G Power on Slow 4G, so the setting could not have differed. The only control it offers
is mobile or desktop, and 19.3s for the main picture is a throttled-mobile figure. The
source note under the table says so.

**There were two Omek case studies and they are the same client.** "Omek Storefront" is
published, has a cover image, has an indexed URL and already tells the speed story in
prose. "Omek Gigs Appliance" was built to carry the fifteen measured rows and has no cover
image and no gallery. Publishing it would have put a second card for one client on a grid
of seven, with a hole where every other card has a picture.

What the live page was missing was the table, not a page.
`cms/scripts/move-omek-metrics-to-storefront.mjs` copies the five metrics fields onto the
published study and touches nothing else, so its prose, cover image, gallery and URL are
unchanged. **It has been run.** The table is live on `/projects/omek-storefront/`, which is
where `/global` sends anyone who clicks "19.3s to 3.5s".

The unpublished document is left in place rather than deleted. Deleting it is Ernest's
call and nothing depends on it being gone.

**The other five case studies carry no metrics, and that is correct.** The table is for
measured before-and-after work, and nothing else in the portfolio has a before. Inventing
one would break the first rule in this document.

**A leak was closed on the way.** `src/pages/projects.astro` and `src/pages/projects/[slug].astro`
did not filter on `published`. It did not show while all six live case studies happened
to be published, and it would have shown the moment this entry existed. The grid now
filters, and the detail page carries `noindex` plus a visible unpublished banner. It is
deliberately not a 404: `CaseStudies` has no drafts, so 404ing would mean Ernest could
not review the page he asked for.

**Settled: there is one Omek study, and it is the published one.** For a few days there
were two, both for the same client. The second, omek-gigs-performance, existed only to
carry the measured table. On 29 August the table moved onto the published study, then the
published study was rewritten to tell the whole story including the audit and the rebuild,
which left the second one with nothing of its own. Ernest deleted it.

The URL now 302s to `/projects/`, which is what `src/pages/projects/[slug].astro` does for
any slug the CMS does not know, so no old link dead-ends. The full document as it stood at
deletion is saved next to the scripts as omek-gigs-performance-deleted-backup.json. That
file is gitignored, so it exists on Ernest's machine and in no clone.

`cms/scripts/seed-omek-case-study.mjs` is the script that made it, and re-running it would
put the duplicate straight back. It now refuses to run without `--recreate` and says why.
`cms/scripts/move-omek-metrics-to-storefront.mjs` fails safe on its first check and its
error no longer points anyone at the seed script.

## Job H: the legal groundwork. BUILT.

- **Postal address.** `siteSettings.address`, seeded by migration because the global is
  admin-only to write and the site's API key is the editor account. Rendered in the footer
  as a semantic `<address>` with **no hardcoded fallback**: if the CMS read fails, show
  nothing, because a stale address after a move is worse than an absent one. The street
  line also now appears in the homepage `PostalAddress` schema.
- **Prospect data section.** `cms/scripts/add-prospect-privacy-section.mjs`, copy verbatim
  from `docs/outreach-legal-copy.md`. It appends to the existing text block's lexical tree
  rather than adding a second block, sets `_status: "published"` explicitly, and writes a
  backup first.
- **`/privacy/outreach/`.** Built at `src/pages/privacy/outreach.astro`. Copy verbatim.
  Its body contains exactly three links: two mailtos and one to the privacy policy. No
  booking link, no pitch, and the exit popup is suppressed.

**One inconsistency Ernest has to resolve, not a developer.** `siteSettings.email` is
`info@quademdigital.com`, but `docs/outreach-legal-copy.md` tells recipients to write to
`ernest@quademdigital.com` to be removed. The privacy policy currently points at a mailbox
the footer does not. Pick one.

**Still outstanding and outside this repo:** the two cold-outreach domains are not bought,
and the Resend sending domain and DNS are not set up.

## Job G: Fieldwork. BUILT, HIDDEN, THEN PUBLISHED ON ERNEST'S CALL.

`src/pages/services/fieldwork.astro`, copy verbatim from `docs/fieldwork-page-copy.md`.

**The previous version of this document was wrong about how to build it**, and following
it would have defeated the job. It said "a CMS entry with an unchecked publish flag". The
`Services` collection has no `published` field, and `sitemap.xml.ts` maps every services
document to `/services/{slug}/` with no filter, so creating one would have published the
URL immediately. It is a bespoke route instead.

It was hidden by all three mechanisms: `noindex` on the page, a `Disallow` in
`public/robots.txt`, and an entry in `UNLISTED` in the sitemap. **All three are undone as
of 28 August 2026.** Ernest lifted the gate, which was his own and was about proof rather
than readiness: the spec wanted Fieldwork run for Quadem and two or three clients won
before it was sold. It is a service like the others now.

Section 07, Proof, is still absent, and publishing early makes it more conspicuous rather
than less. It is the next thing worth writing, and `docs/crawl-findings-2026-08-21.md` is
the obvious first entry, because that study is this service running.

**It is sold in Ghana too**, decided the same day. The page carries two price ladders and
reveals one after the geo lookup, the same mechanism as the homepage tiers. The cedi
ladder is not a conversion: converting the dollar prices would put setting it up near
GH₵ 29,000, more than twice the most expensive thing Quadem sells locally. It sits inside
the range a Ghanaian buyer already sees, GH₵ 2,500 to 11,500.

| Tier | International | Ghana |
|---|---|---|
| Setting it up | from $2,500 | from GH₵ 6,000 |
| Leads only | from $300 a month | from GH₵ 900 a month |
| Done for you | from $1,500 a month | from GH₵ 4,000 a month |

**"From" prices, not the ranges the spec wrote**, changed the same day. Fieldwork was the
only thing on the site priced as a two-ended range while everything else anchors on one
number. A range invites the reader to anchor on its floor, so every real quote above it
feels like being moved on, and a spread as wide as $2,500 to $5,000 reads as not having
decided what the work is worth. The framing line above the tiers already says the price
moves and why. Both spec docs record the change so nobody restores the ranges later
thinking it was a transcription slip.

**Section 07 is now "Where you can watch it run."** The client proof the spec waits for is
still absent and still must not be invented, and the section opens by saying so. What it
carries is the crawl study, which is this service running at full size with its method
published: 3,928 businesses found, 2,828 websites checked, 42.9% with no HTTPS. The copy
doc asked for that link in both directions and both now exist, the study's closing section
naming Fieldwork.

**The call to action now lands somewhere it can be answered.** It reads "Tell me about
your last five customers" and pointed at `/contact/?enquiry=fieldwork`, a parameter nothing
read. Visitors arrived at a wizard asking "What do you need help with?" over a box saying
"Tell me more about your goals...". The button made a specific promise and the page it
landed on had nowhere to keep it.

`contact.astro` now reads `?enquiry=<slug>`. It ticks that service, skips the service
picker, and makes the question the button asked the heading of the screen they land on.
Any service slug works; Fieldwork gets its own wording because its question is a real one
rather than a form field. The starting step is passed to the wizard as `data-start-step`,
because `initProjectWizard` keeps its own step counter and would otherwise disagree with
what is on screen.

Read on the server, not in the browser: the query string is part of the edge cache key, so
`/contact/?enquiry=fieldwork` caches separately and cannot reach the wrong visitor. Geo
cannot be done that way, which is why that is JavaScript and this is not. A hidden
`services[]` input covers the window between deploying and running the seed, when Fieldwork
has no checkbox to tick, and it is exclusive with the checkbox so the value cannot be
submitted twice.

**The hero and the button.** The hero was bare type on a flat background, which reads as a
document rather than as something built, on a page whose job is to be convincing. It has a
token gradient ground and the eyebrow is a chip rather than a floating line. The button had
no focus ring at all, so a keyboard user could reach it and not see it, and its tap target
was big only because the label is long. It now has a sized target, a hover lift, a moving
arrow, a reduced-motion path and full width on a phone. Still exactly one button, repeated,
which the file asks for in capitals.

**The page also declares what it is.** It carried only FAQ schema, which was right while it
was unlisted. It now has a `Service` node alongside, reusing the homepage's `@id` for the
provider so it reads as one business, with the tier minimums as `PriceSpecification`
rather than fixed prices the page contradicts two paragraphs later.

The page keeps its bespoke route. Astro sorts static route segments ahead of dynamic ones,
so that file serves `/services/fieldwork/` and `services/[slug].astro` never does. The CMS
document exists only to put Fieldwork into the lists that read the collection.

Prices are plain text ranges with the mandatory framing line above them. No ticks, no
badges, no highlighted tier. Section 07, Proof, is absent rather than faked, and the
four-step publish checklist is in a comment at the top of the file.

## Job D: /global. LIVE.

`src/pages/global.astro` on `src/layouts/GlobalLayout.astro`.

It has its own shell because `BaseLayout` unconditionally renders four things the spec
forbids: the exit-intent popup pointing at `/offers/free-seo-audit/`, the WhatsApp float,
a footer offers column, and an Offers nav item. `GlobalLayout` reads a fixed navigation
rather than `siteSettings.navLinks`, which is what keeps `/offers` off the page
structurally rather than by vigilance.

Verified on the rendered page: one `<h1>`, heading order h1 to h2 to h3 with no skipped
levels, a 52 character title, an Open Graph card at 1200x630 with its dimensions declared,
`LocalBusiness` and `FAQPage` in one `@graph` sharing the homepage's `@id`, present in
the sitemap, not blocked in robots, zero `/offers` links, zero `wa.me` links, no exit
popup, and two images on the whole page (both the logo). No hero image, deliberately:
text is the fastest Largest Contentful Paint available.

`node scripts/check-global-exclusions.mjs` passes. It reads **rendered HTML**, not source,
because with `output: 'server'` the page compiles into shared chunks and CMS content never
appears in a build artifact at all. It was also tested against the homepage, where it
correctly finds 17 legitimate occurrences.

**UTM capture** is inline in `<head>` before paint, into both `sessionStorage` and a 30
day cookie. The Calendly widget URL is rewritten client side **before** the Calendly
script is appended, because the page is edge cached and the server cannot bake the
parameters in. `src/pages/api/submit-form.ts` reads the cookie into `Leads.metadata`,
which is a `json` field and needed no migration. It deliberately does **not** write to
`Leads.source`: that is a Postgres enum, and an unknown value makes Payload reject the
whole document while the notification email still sends, which has already cost this
project a run of leads once.

**The proof strip has one real slot and one honest placeholder.** The teardown slot links
the real page. The reel slot says `TODO: replace with real asset` in a dashed box and
must not be filled with the existing spec reel, which carries a different honesty label
and would make the copy untrue.

## Job D Task 1: the six existing-site fixes. ALL SIX DONE.

The heading said "five done, one needs Ernest" while the list below it said DONE six
times. The list was right. Item 1 had one loose end, closed on 2 September 2026: the
cedi figure came out of the CMS copy but stayed in two places in the repo. See
"The cedi price that outlived its own fix" below.

1. **Mixed currencies. DONE.** Most of this was already built: `initDynamicPricing` in
   `src/scripts/main.js` already switched to cedis for Ghanaian visitors from CMS fields.
   Two things were missing. A label saying which currency you are looking at, now revealed
   after the geo lookup rather than server-rendered, because public pages are edge-cached
   for 60 seconds and baked-in HTML would be served to the wrong country. And the AI Video
   promo card, which ended "from GHS 1,500" in prose sitting directly above dollar prices.
   The cedi figure comes out rather than being converted, because there is no verified USD
   price for the video service anywhere in the CMS or repo.
2. **Broken hero subheadline. DONE**, in `cms/scripts/fix-homepage-copy.mjs`. The site's
   own code fallback was already correct; only the CMS value had the fused sentence.
3. **Hero leads with the weakest thing. DONE**, in `cms/scripts/fix-homepage-copy.mjs`.
   See below, because the shape of the fix is not the shape the spec asked for.
4. **No physical address. DONE.** See Job H.
5. **Discounting undermines the international pitch. DONE.** `/offers` is untouched and
   still exactly as it was. Links into it are marked `data-ghana-only` in `BaseLayout`
   and removed by `initGhanaOnlyLinks` for a visitor outside Ghana, along with the
   exit-intent popup, which is itself a discount offer. Verified with a mocked geo
   response: Ghana keeps all seven links, the UK and US see zero. It fails open to showing
   them, which is the safe direction.
6. **Founder story buried. DONE.** It was ninth on the page, below pricing. It now sits
   directly under the hero.

### The hero headline, and why the fix is shaped differently to the spec

The spec gives a replacement headline verbatim, "You work with the founder. Not an
account manager.", and quotes the current one as "Premium Websites that convert and help
you grow!".

**That quote is a frame of an animation, not a stored value, and finding out where each
half of it actually lives is what determined the fix.** The stored headline is
"Premium | for businesses ready to grow.". The pipe is a slot for a rotating service
word, so the H1 renders as three lines and cycles through four services. The exclamation
mark is not in that field at all: it is the `suffix` on the first `heroServices` entry,
so slide one read "Premium / Websites / that convert and help you grow!" while the other
three fell back to the shared closing phrase. Slide one is the frame the page loads on,
which is why the spec quoted it.

The spec's headline cannot go in `heroHeadline`. It has no pipe, and
`src/pages/index.astro` discards any headline without one and substitutes a hardcoded
fallback, so pasting it in would have silently replaced the CMS copy with "I design ...
that grow your business.". Giving it a pipe is worse: a rotating service word would land
in the middle of the sentence. The rotation also drives the `hero-slide-change` event
that advances the hero background carousel, so retiring it costs the carousel too.

What was done instead, all five changes in one script, none of them applied yet:

- `heroHeadline` loses the word "Premium", the spec's one surviving objection to it,
  leaving "| for businesses ready to grow.". An empty first segment is falsy in
  `HeroHeadline.tsx`, so line 1 is simply not drawn.
- The exclamation-mark `suffix` on the "Websites" rotation entry is cleared, dropping
  that slide onto the same closing phrase as the other three.
- `heroTagline` becomes the spec's founder line. It is the prominent paragraph directly
  under the H1, which is where the spec wanted the differentiator.
- `heroSubheadline` takes the services and terms sentence. The field has always been
  rendered by `HeroSection` and never filled, and its own admin hint reads "Supporting
  sentence beneath the tagline. Founder-led, honest tone."
- Its "built by the person you actually talk to" clause is dropped, because the tagline
  now makes that point one line above it.

`heroSubheadline` needed no CSS work. `HeroSection.astro` has styled `.hero-subheadline`
in its own scoped block all along. A duplicate rule was briefly added to
`src/styles/style.css` on the mistaken belief that the field was unstyled, found on
29 August 2026 and removed. The lesson is small and repeatable: grep the components as
well as the stylesheets before concluding a class has no rule, because Astro scoped styles
live next to the markup and win on specificity anyway.

All four slides now read "[service] / for businesses ready to grow." and the
screen-reader H1 is "Websites for businesses ready to grow.".

## Job C: the work page. CLOSED AS SUPERSEDED.

The standalone `work.html` held two pieces: a spec reel and a published search analysis.
The search analysis is now Job E on this domain, and the spec reel belongs to Job B. There
is no second route to build and no content left in that file that is not already covered.
`/projects` remains the one place proof lives, CMS driven and editable without a developer.

If the two pieces should also exist as `/projects` entries once the reel exists, that is
two CMS entries with a shared tag and no code. Keep the honesty label ("Spec piece, fully
AI generated") exactly as written.

---

# Still outstanding

## Job B: the video production page. DONE, 31 August 2026.

Unblocked and shipped. The blocker was never the page, which has had a showreel slot and a
work gallery all along. It was that the CMS held 113 media documents and not one video, and
nothing on the drive could be identified as Quadem's without guessing.

Ernest picked the files on 31 August from a listing of every video on the drive.
`cms/scripts/upload-video-work.mjs` holds the manifest, the alt text and the reasoning.
23 files uploaded, all under the 200MB the CMS transcodes on its own, so no
`pnpm optimize:video` pass was needed. All 23 came back `videoStatus: ready`, zero
failures.

- **Showreel:** `Quadem Digital.mov`, landscape, 53 seconds. It lives in the Style All
  Clothing folder on the drive, which is misleading: its own on-screen title is "AI Video
  & Reels" and it is the Quadem brand reel. `showreel.isComingSoon` is now false.
- **Gallery, 22 items:** four Quadem brand pieces, the four-cut Enter Vex Consult campaign,
  the Style All Clothing campaign (concept cut, five clips, end card), and seven QuadERP
  vertical cuts.

Every file was watched before it was published. A frame was pulled from each and looked at,
which is the only reason the exclusion below was caught.

**One file on Ernest's list was NOT published: `Ads/The_Quadem_Blueprint.mp4`.** Two
reasons, either sufficient:

1. It carries a **NotebookLM watermark on every frame**. That is Google's tool. A page
   selling video production is the worst place on the internet to advertise someone else's
   product as your own work.
2. Its headline graphic is **"300%"**. That is the exact class of figure this site spent a
   day removing: the old case study cards carried "300% increase in website traffic" for
   clients who never reported it. Putting it back inside an MP4 is worse than leaving it in
   text, because no guard in this repo can read inside a video.

It is also 8 minutes 31, which is not a reel. If it is ever wanted, it needs the watermark
removed and the number sourced, and it is a different kind of asset from everything else
here.

**Measured cost of the page.** 23 videos, every one `preload="none"` with `controls`, so
not a single video byte is fetched until a visitor presses play. The poster frames are the
whole initial cost: 762KB across 23 of them, correctly sized at the 1280 max edge. That is
the content on a video portfolio rather than waste, but it is the number to watch if the
gallery grows. Posters are not deferred, because `<video poster>` has no lazy attribute;
deferring them means rendering an `<img loading="lazy">` tile and building the `<video>` on
click, which is a change to `src/components/Video.astro` and was not worth bundling with
this.

One thing worth Ernest's eye: `quadem_01_founder_intro.mp4` is in the gallery as AI video
work, which is what it is. If it reads to him as claiming to be a real recording of
himself, it should come out.

## Job F piece 02: who AI recommends. PROTOCOL WRITTEN, NOT RUN.

**The instrument is now in `docs/piece-02-ai-answers-protocol.md`.** It holds the twenty
questions, the three engines, the sixty-row recording sheet, the screenshot naming, the
five counts to take at the end, and the rules that keep the piece defensible. Scope is
aesthetics clinics in Manchester, chosen so it compounds with piece 01, which is already
about UK aesthetics search.

What it cannot do is run itself. The evidence is sixty screenshots of real answers, and
those have to be taken by a person, logged out, in one day. That is the whole reason the
piece is worth doing: a tool-generated chart is easy to dismiss and sixty screenshots are
not.

Read the "Rules that make it defensible" section before starting. The one that matters
most is one run per question and no reruns. A reader will assume the answers were run
until they said something interesting unless the method says plainly that they were not.

**Semrush could not be reached** while the protocol was written, so the one automatable
number, `serp_ai_overview_keywords` for each named business, is unrun. It is one
`domain_overview` call per domain once the connector is available.

The trap, found the hard way on 26 August 2026: **turning the connector on does not reach
a session that is already running.** A session fixes its connector list at startup, so
enabling Semrush and then asking again in the same conversation fails exactly as it did
before, however many times you try. Start a fresh session, then ask. In an interactive
terminal, `/mcp` reconnects without a full restart.

Ahrefs is not an alternative: every Ahrefs endpoint on this account returns "Insufficient
plan", Brand Radar included, checked 21 August 2026.

## One service list, two price lists. DONE, NEEDS THE MIGRATION AND TWO SCRIPTS.

Raised by Ernest on 27 August 2026, after looking at `/global`. Four separate
problems, all the same underlying one: the site kept the same facts in several
places and they had drifted apart.

**The contact form could not take the enquiry.** Its service checkboxes were
four values written into the page: Web Design, Digital Marketing, Branding, SEO.
The services collection has held five for months, so AI Video & Reels was
missing. The service with its own homebrew promo section on the homepage, its
own page, and top billing on the international page had no box to tick.
`src/pages/contact.astro` now reads the collection, so adding a service in the
admin adds it to the form. A "Something else" box is appended and always
present. `servicesInterested` is free text on the lead, not an enum, so the
labels can change without a migration.

**Two prices for the same work, both live.** The homepage showed USD prices that
were straight conversions of the cedi ones, so a website was $425. `/global`
sells a website build from $3,000, raised from the spec's $1,200 on 29 August
2026 (see below). Anyone who read the landing page and clicked through to the site found
the same work at a third of the price. Roughly a thousand cold emails point at
that page.

Ernest's decision: Ghana keeps cedi prices, everyone else sees the international
rates, on the main site and on `/global` alike, so the two can never disagree.

The two markets do not share a tier structure and are not one offer at two
exchange rates. Ghana buys packages (Starter, Growth, Premium). Everyone else
buys service lines (website build, video retainer, growth retainer). There is no
honest mapping: Video retainer has no Ghana equivalent, because the Premium
package explicitly excludes video production. So `pricingPlans` gained a
`market` field and holds both lists. Both render, one carries `hidden`, and
`initDynamicPricing` reveals the right one after the geo lookup, for the same
reason the currency note works that way: public pages are edge-cached for 60
seconds, so the server cannot decide. International is the visible default, so
the cached copy a stranger gets is the international one and a failed geo lookup
shows international prices rather than cedis.

`showMarket` leaves the visible list alone if the market it is asked for is not
on the page. Before the seed runs there is only one list, and hiding it would
show a stranger an empty pricing section.

**`/global` was an island.** It named three services and three prices, all
written into the file. It now reads both from the CMS, with the old hardcoded
lists kept only as a build-time fallback. `check:global` still passes, which is
the thing to re-run whenever CMS copy starts feeding that page.

**The website build was the cheapest thing on its own list.** The spec priced it at
"from $1,200" for three to five weeks while Fieldwork setup is "from $2,500" for two to
three, so the longest and largest job cost half as much as a shorter one, and a single
month of the video retainer cost more than an entire website. Across fifteen to twenty-five
working days $1,200 is $48 to $80 a day, for design, build, search-ready copy, a fixed
price and a month of changes afterwards.

It also contradicted the page carrying it. Section 04 of `/global` says "I charge less than
a London or New York agency because my costs are lower, not because the work is." $1,200
does not read as the same work with lower overheads. It reads as lesser work, and it
selects for the buyer who shops on price.

**It is from $3,000 as of 29 August 2026**, on Ernest's call, which puts the biggest job at
the top of the ladder. `docs/global-page-spec.md` records the change in place so nobody
restores $1,200 from the original table.

**Premium carved out the service the business leads with.** It sold itself as
"everything I do, on retainer" while its own feature list read "All services
included except video production". Ernest's decision on 28 August 2026: fold
video in and adjust the price.

Premium is now **GH₵ 11,500 a month**, which is the GH₵ 8,000 package plus the
GH₵ 3,500 Growth video tier from `src/pages/services/video-production.astro`,
added rather than discounted. Both halves were already published prices, so the
new one is arithmetic on Ernest's own numbers. It brings that tier's allowance
with it: six short-form videos and twenty branded posts a month.

Its dollar figure moves to $1,955 at the 5.882 rate the other two Ghana plans
already imply. Premium is a Ghana plan so that number is never displayed;
leaving $1,350 beside GH₵ 11,500 would only mislead whoever reads the record
next.

The international side needed no change. Growth retainer at $2,500 a month is
already "video, SEO, content and site work combined".

**The pricing fallback would have reintroduced the bug.** The static tiers that
render when the CMS returns nothing were the Ghana packages at their converted
prices, headed by "From $425". A CMS outage is the worst possible moment to put
that number back: nobody is watching, and the campaign is pointed at the page it
contradicts. The fallback is now the international tiers, matching the visible
default, so an outage changes where the prices come from and not what they say.

**The homepage calculator was the last place quoting converted cedis.** It priced Web
Design at $425 while the pricing card directly below it says a website build starts at
$3,000: seven times apart, on one screen, to one visitor. It is a third pricing taxonomy on
top of the Ghana packages and the international service lines, and it was the only one
never fixed.

Its cedi column was always right and is untouched. Web design becomes $3,000, matching the
build tier. Branding and SEO have no international price anywhere on the site, so Ernest
set them on 29 August 2026 at the ratio the cedi prices already use: $3,000 and $2,400.
`cms/scripts/seed-international-pricing.mjs` writes all three.

The total now reads "from $6,000" rather than "$6,000". Every price on the site is a floor
that a real quote moves, and a calculator answering with a bare number reads as a promise
the rest of the site does not make. The calculator also gained the currency label the
pricing section already had, so nobody has to guess which money it is counting in.

**Still open on the calculator:** it offers three services while the site now sells seven.
Adding the rest needs prices that do not exist yet, so it was left rather than guessed.

**A monthly retainer displayed as a flat price.** `billingCycle` on the Premium
plan reads `month`, and both the Ghana price switch and the pricing component
concatenate it straight on to the number, so a visitor in Ghana was shown
`GH₵ 8,000month` and everyone else saw `$1,350` with no cycle at all. Normalised
at render by `formatCycle`, so a tidy-up in the admin is welcome rather than
required, and the seed script fixes the stored value too.

**AI Automation was never in the CMS.** It is sold on `/global`, named in the
homepage tagline and priced as one of the three international service lines, and
it has never existed as a service document. That was invisible while `/global`
carried its own hardcoded list, and it appeared the moment that page started
reading the collection. `cms/scripts/seed-services.mjs` adds it, along with Fieldwork,
which puts it on the services index, the contact form, `/global` and its own
page in one write. It publishes immediately: `Services` has no published flag
and the sitemap maps every services document unfiltered. It also ships with no
body, which matches the live Digital Marketing service, and is still the
thinnest page on the site until someone writes it.

### Run order for this piece

```
pnpm migrate                                          # adds pricing_plans.market
node cms/scripts/seed-international-pricing.mjs --dry-run
node cms/scripts/seed-international-pricing.mjs       # after the migration, not before
node cms/scripts/seed-services.mjs --dry-run
node cms/scripts/seed-services.mjs                    # publishes on write
```

The script writes `market`, which the migration adds. Against a database without
that column Payload drops the unknown field silently, every plan keeps the
default, and the Ghana packages go in front of international visitors.

## The contact email is ernest@, everywhere. DONE.

`siteSettings.email` was `info@quademdigital.com` while the outreach pages and
the privacy copy told recipients to write to `ernest@quademdigital.com` to be
removed. Those had to agree before a single cold email went out: the removal
address is a legal promise, and one pointing at an unmonitored inbox looks like
compliance while swallowing the requests.

Changed in three places in code, plus a migration for the CMS value, because
`siteSettings` is admin-only to write and the site's API key is the editor
account. Migration `20260827_090000_set_contact_email_to_ernest`, guarded so a
Railway replay cannot drag a future change back.

One of the three was a latent bug rather than a copy problem:
`src/pages/invoice/[id].astro` read `siteSettings?.contactEmail`, a field that
does not exist on the global. Every invoice ever issued therefore showed the
hardcoded fallback and the CMS value was never used.

## The founder photograph. DONE.

The real photograph was in the CMS the whole time: `about.founderImage`, media
66, `founder-portrait.webp`, alt "Ernest Avorwlanu, founder of Quadem Digital".
Both the homepage founder section and `/about` already preferred it and both
render it. Nothing was ever wrong on the live site, and an earlier note in this
file claiming otherwise was mistaken.

What was wrong was the fallback behind it. The deleted founder-mock.webp, which
lived in the images folder, was a stock portrait of a different person, a white
man, with garbled text baked into
the background ("TECH INNOVAT..."), and it rendered whenever the CMS image
failed to resolve. On the section that introduces the one person you deal with,
that is worse than an empty frame, and it would have appeared exactly when the
CMS was unreachable and nobody was watching. Same shape as the pricing fallback
that still held the converted cedi prices.

Both call sites now render nothing when the CMS image is missing, and the file
is deleted, so it cannot come back through a third call site later.

**`/global`'s hero now uses this portrait**, changed 29 August 2026. It held the abstract
brand form, chosen while the belief was that the only portrait in the project was the stock
one, and that reason evaporated the moment the CMS image was found. It matters more on that
page than anywhere else: the headline is "You get the founder. Not an account manager.", a
stranger arriving from a cold email has no reason to believe it, and an abstract shape
beside that sentence proves nothing. The brand form stays as the fallback, because it
claims nothing, and an empty column would be worse.

## What the Ghana price switch actually did, tested from Ghana

Tested against the live site from an Accra connection on 29 August 2026, with a real
browser rather than by reading the markup. The switch itself was right: the international
grid hides, the Ghana grid shows GH₵ 2,500 / 5,500 / 11,500, and the note reads "All prices
in Ghana cedis."

**The calculator beside it stayed in dollars**, which is two currencies on one page, the
first problem the global spec lists. `updateLabels` in `src/scripts/main.js` bailed on
`config.rate === 1`, meaning "still on the USD default". The Ghana config also has rate 1,
because cedi prices are exact rather than converted, so Ghana returned early every time.
It now skips only when the currency is the USD the server already rendered.

Two more found in the same pass, both created by there being two grids where there was one:

- The price line broke after "from" on the two retainers, because 40px could not fit
  "from $2,500/mo" in a 350px card. Prices became "from" prices this week, so the string
  outgrew the size it was set at. It is now clamped and `nowrap`.
- The carousel arrows called `document.querySelector('.pricing-grid')`, which returns the
  first match. A visitor in Ghana pressed them and scrolled the hidden international grid
  while nothing on screen moved. They target `:not([hidden])` now.

Cards are also a flex column with the button pushed to the bottom, so a four-bullet tier
and an eight-bullet tier line their buttons up instead of leaving half a card empty.

## The pricing cards, reworked 29 August 2026

How often you pay is its own line under the amount now, rather than "/mo" glued to the
number. That distinction is the most important fact on the card, and at a glance
"from $3,000" and "from $1,500/mo" looked like the same kind of thing. Every card carries
it, so a one-off reads as "one off" rather than as an absence. It also stopped the price
being the longest string on the card, so the amount went back up to full size.

The Growth retainer is the marked tier. The Ghana set highlights its middle option and the
international set highlighted nothing, so all three read as equally weighted. This one
rather than the cheapest because it is the only tier that contains another, it is the
relationship the campaign is trying to start, and marking the dearest makes the two beside
it read as reasonable. `isPopular` in the admin moves it.

## The project write-ups, redesigned 29 August 2026

`src/pages/projects/[slug].astro` was the plainest page on the site and the reason was
one missing stylesheet. The CMS body is rendered into a div with class
`portable-text-body`, and that class had no rules anywhere in the repo. Every write-up
was raw h2 and p tags in the body font at the body size, under a centred hero and a full
width cover image that repeated what the hero was already doing.

`src/styles/case-study.css` is the format now, and it deliberately borrows the vocabulary
of `src/styles/analysis.css`. The teardowns and the case studies make the same kind of
argument, and a project page that looked nothing like a teardown read as a different site.
Numbered sections, mono labels, tabular figures, hairline rules.

What changed on the page:

1. The hero is asymmetric. Copy on the left, the cover framed on the right, over a soft
   accent bloom and a masked dot grid. The cover moved into the hero, so the page no
   longer shows a big centred block of text followed by a big centred image.
2. A fact rail under the hero: Focus, Outcome, Evidence. Every cell is a field that exists
   on the document, and under two cells there is no rail at all. That is why
   `/projects/quadem-brand-identity/` has none: it has a tag and nothing else, and three
   quarters of a rail looks like a bug.
3. Body sections number themselves, 01, 02, 03, from a CSS counter. An editor adding a
   fourth heading in the admin gets 04 without knowing the rule exists, and reordering
   sections renumbers them.
4. Lists, quotes, code, rules, inline images and links all have rules now. They had none.
5. The result figure is a panel rather than an inline style, and its accent tint is a
   `color-mix` over `--accent` rather than a fixed rgba, so it follows the token and
   survives the light theme.
6. The gallery gives its first shot two columns when the count is odd, and every shot
   opens in a native `<dialog>` lightbox with arrow keys. Native, so Escape, focus
   trapping and the top layer come from the browser rather than from script.
7. The page ends with an invitation and the two projects either side of this one, rather
   than a lone "back" link. Unpublished entries are excluded from that pager, so it can
   never leak a draft.
8. A two pixel reading progress line. The scroll listener is bound once behind a module
   flag, because this site uses view transitions and one listener per navigation is a
   leak that only shows up after a visitor has clicked around for a while.

Not touched: `portable-text-body` is also the body class on the blog, the service pages
and the client portal, and it is still unstyled there. Same defect, three more places.

## The five write-ups, rewritten 29 August 2026

Giving the pages a design exposed what was on them. Five of the six published studies
carried the same three headings, The Challenge, The Solution and The Results, over copy
nobody could source: "a massive boost in sales", "a substantial increase in
direct-to-consumer online sales", "a fully booked speaking calendar". None of it was
measured. The descriptions on the same documents were already true and specific, which is
what made it obvious once the description became the page's opening paragraph: an honest
lede, then three paragraphs of nothing under it.

`cms/scripts/rewrite-case-study-write-ups.mjs` replaced all five and corrected
`projectType` at the same time. It backs the old bodies up to a gitignored file first,
touches nothing but `body` and `projectType`, and reads both values back off the response
rather than trusting a 200, because Payload drops fields the deployed app does not
declare.

Every claim in the new copy traces to something on this drive, and the script's header
says which source backs which page. In short: the Omek audit report dated 3 July 2026 plus
the omek-storefront and omek-admin commit histories; the quaderp-landing-wt commits for
the 1.3MB to 150KB cut, the 549px layout shift and the GA4 events that were never
arriving; sans-bag-web's Prisma schema, route tree and package list; quajospeaks' README,
site config and its 92 to 100 accessibility commit; brandengine's plan, routes and
dependency list. No figure appears that was not already written down somewhere.

`projectType` was `concept` on five real projects, and the field's own admin text defines
concept as no real client relationship. It is now `client` on omek-storefront and
san-collection, and `self` on quaderp-landing, quajo-speaks and quadbrand. Ernest
confirmed QuajoSpeaks is his own brand and San Collection is a real client on 29 August
2026. Still nothing on the site renders this field. The values are right now so that
whatever renders it first does not have to be the thing that discovers they were wrong.

One consequence, since dealt with. The rewrite left the unpublished duplicate entirely
redundant, and it still carried the old caveat saying the July throttling could not be
proven, which the corrected source note on the published page no longer says. That made it
the one place on the site where two versions of the same claim disagreed. Ernest deleted
it the same day. See the end of Job A above for what that touched.

There are six case studies now, all published, all correctly typed.

## The booking link was dead, and the global funnel leaked. Both fixed 29 August 2026

Ernest reported two things on the same day. Both were live, both were costing the
campaign, and neither showed up in any guard.

**The booking link went nowhere.** `https://calendly.com/quadem-agency/free-strategy-call`
is not a Calendly account. It answers 404. It was hardcoded on `/global`, which is the page
roughly a thousand cold emails point at, and under the homepage price calculator, which is
the most qualified click on the main site: someone who has just totalled up what they want
to spend. Both went to a Calendly error page. `/contact/` worked the whole time, because
its URL came from `contactPage.calendlyUrl` in the CMS and that value was right.

The real account is `quademdigitalenterprise`. The reason the wrong one reads as correct is
that `quadem_agency` IS the handle on X. Handles differ per platform and nobody re-reads a
booking URL once it is written down.

`src/lib/booking.ts` is now the only place that answers the question. It reads the CMS
value, validates that it is a calendly.com URL, and falls back to the verified account.
`/global`, the price calculator and `/contact/` all resolve through it.
`scripts/check-booking-links.mjs` opens every Calendly URL the site can serve and fails if
any is dead, which includes the case Calendly answers 200 for: an account that exists with
no such event, which returns a 404 page with a 200 status. `pnpm check:booking`, exit 1 is
a real finding, exit 2 means it could not check.

**hello@quademdigital.com was still the fallback in four places.** The repo already
documents that it hard-bounced on 2026-06-05 and is not a mailbox, in
`src/lib/mailFrom.ts`. It was the printed address on `/global` and the default in
`src/pages/index.astro`, `src/pages/contact.astro` and `src/layouts/BaseLayout.astro`. All
four now fall back to ernest@, which is the settled address everywhere else.

**The global funnel leaked into the Ghana site.** `/global`'s work cards linked straight
to `/projects/<slug>/`, which is BaseLayout: the main nav, the WhatsApp float, the exit
popup, and the Start a conversation button pointing at `/contact/` and its price
calculator. An international prospect at the most interested moment in the sequence was
handed the Ghana site.

The work cards now carry `?from=global`, and `src/pages/projects/[slug].astro` reads it:
GlobalLayout instead of BaseLayout, the call to action goes to `/global/#book` rather than
`/contact/`, back goes to `/global/#work`, and the previous and next links keep the marker
so the reader cannot fall out of the funnel by paging sideways.

A query string rather than a cookie, because the page is edge cached and a cookie would be
read after the cached HTML had already been served. Query strings are part of the Vercel
cache key, so the two variants cache separately. Canonical is built from the pathname in
both layouts, so there is no duplicate URL for Google to index.

`GlobalLayout` also had to stop assuming it was only ever used on `/global/`. Its nav is
anchors, so `#work` on a case study scrolled nowhere. Anchors now resolve against
`/global/` unless the page IS `/global/`.

**The exclusions guard now sweeps the whole funnel, and learned a distinction.**
`scripts/check-global-exclusions.mjs` checked one URL. It now checks `/global/` plus the
three case studies it links, and splits its patterns in two. Cedi pricing, "Built for
Ghana" and any link into `/offers` are fatal everywhere. The Ghana payment names are fatal
on `/global`, where naming one is offering it, and reported but allowed on a case study,
where naming one is describing a client's shop. The Omek study says the checkout takes
Paystack and Hubtel because it does, and an international reader learns from that that
local payment stacks get integrated. Scrubbing it would make the evidence vaguer, which is
the opposite of what a case study is for.

**The teardown was the last leak, and it is closed too.** `/global` links
`/blog/uk-aesthetics-search/` as its proof, and that page is `src/layouts/AnalysisLayout.astro`
wrapping BaseLayout, so it still handed over the main site chrome. The same switch is in
that layout now, which covers every analysis piece rather than one page.

No call to action was added, in either context. That is the format's rule, not an
oversight: `docs/analysis-format.md` says a piece that ends in a sales pitch gets read once
and never linked, which is the entire reason four of the five email sequences can link one
on day 9. Inside the funnel the way back is the nav, which GlobalLayout already resolves
to `/global/`.

Note that these pieces are reached two ways and both have to keep working. A cold email
links the clean URL and the reader gets the main site. `/global` links it with the marker
and the reader stays in the funnel. Canonical is pathname-based, so the two collapse to one
address for search.

**The guard now discovers its own targets.** `scripts/check-global-exclusions.mjs` had a
hardcoded list of funnel pages, which would have gone stale the moment somebody added a
link to `/global`, and gone stale silently, which is the exact failure this guard exists to
catch. It now reads `/global` and follows every link carrying `?from=global`. Add a funnel
link and it is checked on the next run with nobody remembering to update the script. Five
pages are covered today. If it ever finds none it exits 2 rather than reporting clean,
because no funnel links means the marker has been dropped, not that the funnel is tidy.

## Two services were selling a "coming soon" page. Fixed 30 August 2026

Seven services exist. Five have hand-built pages under `src/pages/services/`. Two fall
through to the CMS template at `src/pages/services/[slug].astro`, and that template printed
"Detailed service content coming soon" whenever the body was empty. Both were live saying
exactly that, at 688 words and one heading each:

- `/services/ai-automation/`, which was added to the CMS on 29 August and is now offered on
  the contact form, in the services grid and in the footer.
- `/services/digital-marketing-social-media/`, linked from the homepage, the services grid
  and the contact form.

Both were being sold and both told the buyer to come back later.

**The stylesheet had to come first.** The template renders the body into
`.text-block-section > .portable-text-body`, and neither class had a single rule anywhere
in this repo, so a service body was raw browser defaults inside a 1200px container.
`src/styles/prose.css` is that missing sheet. It is scoped to an explicit `.prose` class
rather than to `.portable-text-body`, because that name is also on the blog post body,
which IS already styled by `.blog-post-content` descendant rules at the same specificity.
Styling the shared name would have let stylesheet order decide the appearance of eight
published posts. Opting in per page changes only the pages that were broken.

Correcting the record from the note above about the write-ups: the blog is NOT unstyled. It
has headings, paragraphs, lists, quotes and figure captions. What it lacks is rules for
links, bold, code and rules, and a check of all eight posts shows they contain none of
those, only h2, paragraphs, lists and quotes. So there is nothing there worth building yet.
The service pages were the real instance of the defect.

**The copy is sourced, and says so.** `cms/scripts/write-service-bodies.mjs` holds it, with
the provenance in its header. AI Automation comes from the quadem-whatsapp-intake repo on
this drive: the three-question flow, the 64 second first live run, the two to three second
replies, the refusal to guess an unrecognised city, the permanent stop once a human is
involved, and the 24 hour service window that means Meta charges nothing for the replies.
The page says plainly that this runs on Quadem's own enquiries rather than implying a
roster of deployments. Digital Marketing comes from the Omek Meta ads campaign strategy,
six written buyer profiles with income bands, purchase triggers and fears, and it states
outright that no reach, engagement or return figure appears because none was recorded.

The script refuses to overwrite a body somebody has already written, backs up what it
replaces, and reads the heading count back off the response rather than trusting a 200.

**The empty-body fallback is no longer a dead end.** When a service genuinely has no
write-up, the template now says so and offers the one thing that does answer the question,
which is asking Ernest, rather than telling a buyer to come back later.

**Known duplication.** `src/styles/prose.css` and `src/styles/case-study.css` carry an
almost identical set of typography rules. case-study.css shipped hours earlier and adds the
numbered-section signature on top. Merging them into one base is worth doing and was not
worth doing in the same change as a fix to live pages.

## The site was quoting cedis to buyers who do not pay in cedis. FIXED 31 August 2026.

Found by pulling on a one-line question: can the forms ask for a budget. They already did,
and the bands were wrong, and that led somewhere worse.

**All four hand-built service pages showed cedi prices to everyone.** Web design read GH₵
2,500 and GH₵ 5,000. SEO read GH₵ 1,500 and GH₵ 3,500 a month. Branding GH₵ 1,000 and GH₵
2,500. AI Video GH₵ 1,500 to GH₵ 8,000. GH₵ 2,500 is about $425, and `/global` says
websites start at $3,000. Two live pages disagreeing by three and a half times, and the
cheap one is the one a stranger finds from search.

Each tier now carries `priceUsd` beside `price`, and the page shows the one that matches the
visitor's country. **Where no dollar price is set the tier says "Get a quote"** rather than
showing a cedi figure to someone who does not pay in cedis. No dollar amounts were invented,
which is why every tier says that today. Filling them in is Ernest's, in the admin, once the
CMS is redeployed.

**The budget question had one ladder and it was wrong at both ends.** It started at "under
$2,000", below the cheapest thing sold internationally, so the first option a buyer read
implied a price that never existed. In Ghana the entire ladder, GH₵ 2,500 to GH₵ 11,500, is
roughly $425 to $1,955, so every Ghanaian lead landed in that one bottom band and the
question collected nothing about the site's primary market. There are two ladders now,
switched by country. The four original values stay in the enum: Postgres cannot drop one and
existing leads carry them.

**And the switch was not running at all.** `initDynamicPricing` returned early unless the
page had a `.dynamic-price` element or the calculator. `/services/fieldwork/` has six
`[data-market]` blocks and neither of those, so `showMarket()` never ran there and its Ghana
price ladder has never once been shown to a visitor in Ghana. That bug is older than this
change and the new budget bands would have inherited it. The guard now also fires when a
page's only geo need is a market block.

## Service pages have their own enquiry form. FULLY LIVE, 1 September 2026.

The half that was missing was the CMS redeploy. Once that landed, the questions were
seeded and read back: all seven pages, twenty one questions, every key derived. The
section below was written while it was half done and is kept for the reasoning.

Every service page sent people to `/contact/`, whose first question is "what do you need
help with?". Someone reading the SEO page answered that by being on it, and being asked
again is where a lot of them stop. The form is now on the page with that step filled in,
and spends it on questions only that service needs. Ernest chose CMS-editable questions and
a qualifying-length form, six to seven fields, over a short one.

**What is live right now.** All seven service pages carry a working form, each posting its
own service, `source: cms-page`, name, email, message and budget. The homepage and
`/contact/` are untouched, which is what was asked: they stay general.

**What is not live yet, and why.** The questions need one manual step. The migration has
been applied to production Postgres, so the columns exist. The Payload app on Railway has
NOT picked up the schema: a push to this repo does not redeploy it, which was confirmed by
polling the API for ten minutes after the push. Until someone redeploys the CMS service on
Railway, `enquiryForm` is absent from the API and from the admin, and
`cms/scripts/seed-service-enquiry-forms.mjs` will refuse to report success.

The order matters and was followed: migrate first, then deploy. The reverse boots an app
that queries columns which do not exist.

    1. Redeploy the CMS service on Railway.
    2. node cms/scripts/seed-service-enquiry-forms.mjs --dry-run
    3. node cms/scripts/seed-service-enquiry-forms.mjs

Until step 1, every service page shows the general form: name, email, message, budget. That
is the documented fallback rather than a broken state, and it is why shipping ahead of the
CMS deploy was safe.

**The bug that would not have announced itself.** Every payload builder on this site works
from a fixed list of field names. An extra question would have been dropped on the way out:
request succeeds, lead saves, answers gone. Exactly the shape of the `Leads.source` enum
bug documented in that collection. It is fixed in all three places, the two in
`src/scripts/main.js` and the one in `src/pages/api/submit-form.ts`, behind one shared
helper so they cannot drift.

**Where answers go.** Posted as `q_<key>`, stored in `Leads.metadata.answers`, which is a
`json` column, so adding or rewording a question never needs another migration. The key is
derived from the question text but stored in its own column, so rewording a question does
not orphan answers already collected under the old wording. Leave a key alone once it has
collected anything.

That derivation could not use `makeSlugHook`. Inside an array row that hook reads `data`,
which is the whole service document rather than the row, so it would never find `label`,
the key would stay empty, and the front end drops questions without a key. Every question
would have silently failed to render. The replacement reads `siblingData`.

**Redirects.** Every redirect in `submit-form.ts` was hardcoded to `/contact/`, so a
submit without JavaScript from `/services/seo/` landed on a different page explaining
nothing. It now honours a same-origin `returnTo`, refusing anything absolute or
protocol-relative, and the form renders its own sent and error state on the server for that
path.

## Why the CMS deploy kept failing, 31 August 2026

Two faults, both shipped in the same commit (`fbd8edab`), both invisible from the site
because only the CMS build breaks and the site builds fine either way.

**1. An AppleDouble import.** This drive is exFAT and scatters `._name` sidecars beside
real files. `cms/src/migrations/index.ts` is generated by scanning that directory, so the
generator picked one up and wrote:

    import * as migration_._20260831_162045_... from './._20260831_162045_...'

Two things wrong at once. `migration_._2026...` is not a valid JavaScript identifier, and
the file it imports is gitignored so it never reaches Railway. Locally the sidecar exists
and nothing looks broken. On Railway the import resolves to nothing and the build dies.

This has now shipped three times: `4b314b52`, `36a07527`, and `fbd8edab`. The npm scripts
already delete `._*` before running a migration, which does not help, because the sidecar
is recreated afterwards and the damage is in the committed index rather than on disk.

`scripts/check-migrations.mjs` is the guard, `pnpm check:migrations`. It fails on an import
that cannot parse, an import with no file behind it, and a migration on disk that nobody
registered, which is the quieter half of the same mistake. Run it before any commit that
touches migrations.

**2. `migrate.ts` lost track of a required field.** `PricingPlans.market` became required on
27 August when one pricing list became two. `cms/src/migrate.ts`, the one-off Sanity import,
still created plans without it. It stayed quiet until `payload-types.ts` was regenerated on
31 August, at which point the generated type made `market` required and the file stopped
compiling. It is not imported by the app, but it lives under `src/`, so Next type-checks it
and the whole build fails.

Worth knowing for next time: regenerating `payload-types.ts` can break code that was already
wrong but not yet contradicted. If a build fails right after a `migrate:create`, look for a
`payload.create` missing a field that became required earlier.

**Both fixed, CMS build verified green locally before pushing.** Anything still pending is
just the redeploy itself.

## Three services had no card on the front page. Fixed 1 September 2026.

The homepage draws its service cards from `homepage.promoSections`. It held four:
AI Video, Web Design, Brand Identity, SEO. Three live services had none, so the only
route to them from the front page was the Services list in the footer, which is the last
thing anyone reads. It is seven now.

**On `/services/` the two newest were worse than absent.** That card renders
`service.iconSvg || <a plain circle>`, so AI Automation and Fieldwork showed an empty
outlined circle where the other five show their own mark. It reads as a bug, not as
missing content. The "Highlights:" list is wrapped in a length check, so with no `tags`
it vanished entirely: five services listed three things they do and those two listed
nothing. Both fixed in `cms/scripts/add-service-icons-and-highlights.mjs`. The highlights
are taken from what each service already says about itself, not invented.

**Digital Marketing was being sent to the SEO page.** Its card carried a hardcoded
override to `/services/seo/`, with a comment explaining it: "Routing digital marketing to
SEO & Content page as it covers marketing". True when written, because there was no
Digital Marketing page. There is one now, with 2,400 words about buyer profiles built for
a real client and, since 31 August, its own enquiry form. So the live behaviour was: read
about social media, click Learn More, land on search, get asked for a web address and a
target keyword. Both branches of the override are gone from `src/pages/services.astro`
and the default `/services/<slug>/` stands. All seven checked.

**Adding a card is a four step job, and step three is the one that bites.**
`promoSections.visual` is a Payload select, so in Postgres it is an enum:

1. Write the component in `src/components/home/`.
2. Register it in `PROMO_COMPONENTS` in `src/pages/index.astro`, and in the no-CMS
   fallback below it, which must list every card or it silently disagrees with the CMS.
3. Add the option in `cms/src/globals/Homepage.ts` **and** a migration adding the enum
   value. Then redeploy the CMS. Until that redeploy Payload does not know the value and
   drops it from the write without erroring.
4. `node cms/scripts/add-homepage-promo-cards.mjs`, which reads every card back and
   compares the artwork it asked for against the artwork it got, because of step 3.

**The artwork is drawn in bars, never in words.** That matters most on Fieldwork, where
the real deliverable is a sheet of named businesses with their phone numbers on it.
Anything legible would either put a real company on the homepage or invent a fake one.
The three new cards take their tints from `color-mix` over `var(--accent)` rather than
rgba literals; the four older ones predate that and still carry hex.

**A layout fault in all seven, found on the sixth.** Each card lays words and artwork side
by side and centres them, so the moment the paragraph is taller than the artwork the panel
floats with page colour above and below it. On the AI Video card, whose panel is a
photograph, the photo stopped short of the rounded corners and read as broken. Measured
with a plausible paragraph: 66px of dead space on AI Video and SEO, 18px on Web Design and
Brand Identity. `align-self: stretch` on the visual column takes all four to 2px, which is
the card's own border. Nothing moved at the copy lengths that are live.

## The cedi price that outlived its own fix. Closed 2 September 2026.

Job D Task 1 item 1 said the cedi figure "comes out rather than being converted". It came
out of the CMS on 27 August. It stayed in two places in the repo, and one of them was
live to the whole world.

- `src/components/home/VideoPromoSection.astro` still ended its **fallback** paragraph
  "from GHS 1,500". Nobody saw it, because the CMS value wins. That is the trap: it is the
  copy served if the CMS is ever empty or unreachable, so an outage would have quoted cedis
  to every visitor including the ones `/global` exists to reach.
- `src/pages/services/video-production.astro` had it in the **meta description**, which is
  not a fallback at all. It was the Google snippet, served to everyone. GHS 1,500 is about
  $125 beside the $3,000 `/global` sells a build from.

A meta description is server rendered into an edge cached page, so unlike the price ladder
further down the same page it cannot switch on the visitor's country. Removing the number
is the only option that works for both markets. Not converted, because there is still no
verified USD price for video anywhere in the CMS or the repo.

Swept the rest: no other fallback or meta description on the site carries a price. The
`GH₵` strings left in the two service pages are the Ghana halves of `data-market` pairs and
are correct.

**Still open, and it is a positioning call rather than a bug:** that page's title is
"AI Video & Reels for Ghanaian Brands". `/global` does not link to it, but the homepage
does, twice, and the homepage is served worldwide. Left alone deliberately.

## Every route to a generated image is at zero. Blocked 2 September 2026.

AI Automation and Fieldwork are the only two services with no photograph. On `/services/`
they fall back to a grey box with their new icon in it, beside five that show one.

`cms/scripts/generate-service-photographs.mjs` has the prompts written, in the house look
taken from the five that exist: near black and deep navy, one cool blue light source,
shallow depth of field, Black subjects, 3:2 to match their 1600x1063. Two options per
service. It will not run:

| | |
|---|---|
| Bloom | 0 credits |
| Higgsfield | 0 credits, and `nano_banana_pro` costs 2 an image |
| `GEMINI_API_KEY` | free tier. Not a rate limit: `limit: 0`, no image generations at all |
| `GEMINI_IMAGE_API_KEY` | billing IS configured, prepaid, balance empty |

The two Gemini walls read identically from the outside and have different fixes, so the
script names which one it hit. `GEMINI_IMAGE_API_KEY` is the near one: top it up at
https://ai.studio/projects and it runs unchanged, for well under a dollar. The key is kept
separate from `GEMINI_API_KEY` on purpose, because `cms/src/utils/aiEmailGenerator.ts`
uses that one to write emails and paying for pictures should not quietly move a live CMS
feature onto a different Google account.

Generating and uploading are two commands, and the pictures land in a gitignored folder.
These models still slip letters onto screens and paper, and no artwork on this site
carries words or numbers. Somebody looks before anything reaches the CMS.

## Semrush is out of units, and OpenRush replaced it. 2 September 2026.

**Semrush** is reachable now, so the old note saying it "could not be reached" is no longer
the reason. It answers with a subscription-active, units-exhausted message pointing at
https://www.semrush.com/mcp-access .

**Ahrefs is not an alternative and the reason is worth knowing.** Re-checked, and even
`subscription-info-limits-and-usage`, documented as free and consuming no units, returns
"Insufficient plan". The account is locked entirely, not just its expensive endpoints. Do
not spend time probing individual Ahrefs tools.

**OpenRush is the one that works, and for this job it is better than what it replaced.** It
carries two tools built for exactly this question rather than inferred out of a SERP feature
table:

```
inspect_ai_visibility   how a domain is cited in AI answers, vs named competitors
discover_ai_citations   which domains AI cites across a category
```

Competitors are batched into one call, so comparing three domains costs the same as one.

That closed the cross-check `docs/piece-02-ai-answers-protocol.md` asks for in its own
words. The Semrush column mapping there is **inferred**, and an earlier version had the
wrong field and would have overstated presence in AI answers by roughly ten times. Rather
than confirm the inference, OpenRush measures the quantity directly. Both sources put the
three domains in the same order, and both put Dr Leah at roughly twice SKN's citation rate
for its size, which is the finding the piece rests on. Full table in the protocol.

**The protocol had never recorded which three domains were queried**, only brand names, so
its figures could not be reproduced from the page. They are now written down.

**Neither source retires the hand-collected work.** Both cover Google AI Overview only. The
piece is about three engines, two of which nothing here can see. Sixty screenshotted
answers is still the substance.

## The privacy policy lives in the CMS, and only there

Settled 29 August 2026 after a parallel session wrote a second one.

The live policy is Payload `pages` document 7, slug `privacy-policy`, served by
`src/pages/[slug].astro`. It carries eleven sections including "Businesses we contact who
have not contacted us", which the outbound campaign legally depends on and which
`cms/scripts/add-prospect-privacy-section.mjs` added.

A hardcoded route existed in the working tree at a privacy-policy directory under
src/pages, and was never deployed. **Deploying it would have broken the policy silently.** Astro sorts
static route segments ahead of dynamic ones, so that file would have served
`/privacy-policy/` and the CMS document would never have rendered, dropping the outreach
section plus Artificial Intelligence, Cookies and Tracking, and Where Your Information Is
Stored. The page would still have answered 200, so nothing would have reported it.

The route is removed. Its copy is preserved in `docs/privacy-policy-alternate-draft.md`,
because the register is better than the live policy's in three places and worth porting by
hand: "The short version", "What I never do", and "How to ask". Porting them is a copy
decision on a legal page, so it is Ernest's rather than a developer's.

**Do not add a static route for a page the CMS already serves.** Check
`src/pages/[slug].astro` and the `pages` collection first. The same trap applies to
`/terms`, which is also a CMS document.

## The measurement baseline

Frozen in `docs/baseline-2026-08-21.md`, taken before any of this was published: 1 ranking
keyword, 0 organic traffic, Authority Score 2, 50 referring domains. **Never edit that
file.** Add a new dated one when re-measuring. Referring domains is the honest metric.

---

## Things not to do

- Do not add analytics, tag managers, cookie banners or third-party scripts. Ask first.
- Do not add testimonials. There are none yet, and inventing them is the exact thing this
  site's positioning is built against.
- Do not remove the cache in `src/lib/payload.ts`.
- Do not edit `studio/`. It is legacy.
- Do not deploy. Ernest deploys.
- Do not add urgency, superlatives or growth language to the case study or the analysis
  pieces. The restraint is the point.
- Do not link `/offers` from `/global`, and do not undo the `data-ghana-only` marking.
- Do not remove a caveat from an analysis piece to make a claim sound stronger.

## When you are done

Report: what you built, which route, whether it is publicly reachable, what you had to
guess, every `TODO` you left, and which blockers are still outstanding. State guard
results as exit codes, not as the word "passing".

Then run the guards, and update this document, **last**, because `check:handoff` compares
its modification time against everything under `src/` and `docs/`.

---

## Keeping this document honest

Three times now this handover has described a repo that had already moved on. Two of those
were caught by a human. There is a check for it.

```
node scripts/check-handoff.mjs
```

It fails if this document references a file that does not exist, or if anything under
`src/` or `docs/` is newer than this document. The second one is blunt on purpose: a false
alarm costs you thirty seconds of re-reading, a missed one costs somebody a day building
the wrong thing.

The 21 August version of this file was stale in two ways that mattered, and both are worth
remembering as failure modes. It told you to edit a privacy-policy page file
under src/pages that had been deleted three days earlier, when the privacy policy moved
into the CMS. The path is written out here without backticks on purpose: check-handoff
reads inline code spans as claims that a file exists, and this one is a claim that it
does not. And it
told you to build Fieldwork as a CMS entry with an unchecked publish flag, which would have
published it immediately. Neither was a typo. Both were the document describing a repo
that had changed underneath it.

**Checking whether something is live: two ways to get a false answer.** Both have now
happened on this project.

`curl -I` sends a HEAD, and the middleware only edge-caches GET, so HEAD always answers
`no-store` and hides that new code is live. Use `curl -s -D - -o /dev/null <url>`.

`grep -c` counts matching **lines**, not matches, and the built HTML is minified onto a
single line. So `curl -s <url> | grep -c 'href="/services/x/"'` returns 1 whether the page
has that link once or five times, and a poll loop waiting for the count to rise never
fires. On 1 September that made a Vercel deploy which had already gone out look like a ten
minute stall. Count with Python, or `grep -o ... | wc -l`, never bare `grep -c`.

Add a cache-busting query string to every check. Query strings are part of the edge cache
key, so `?cb=$(date +%s)` forces a fresh render.

Files below are referenced here but deliberately not built yet. Add to this list only when
the document genuinely describes something planned, never to make the check pass.

<!-- planned-files
# Nothing is currently planned-but-unbuilt. The three entries that lived here on
# 21 August (global.astro, blog/uk-aesthetics-search.astro, privacy/outreach.astro)
# were all built on 25 August and removed from this list, because a path left in
# here is simply never checked, which quietly disables the guard for it.
-->
