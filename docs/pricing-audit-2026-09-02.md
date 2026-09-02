# Every price on the site, side by side

Pulled 2 September 2026 from the six places prices live: the four service page
globals in the CMS, the `services` collection, the `pricingPlans` collection, the
`calculatorServices` collection and `src/pages/services/fieldwork.astro`, which
is in no database at all.

Nothing here is a proposal. It is what the site charges, after the corrections
Ernest approved on 2 September. Regenerate it with `node scripts/pricing-audit.mjs`,
which reads those sources rather than this file.

---

## 0. The homepage was showing all six cards to everyone. Fixed.

Before anything below is read as a pricing problem, this was a rendering bug and
it is fixed.

The homepage holds two grids of three cards, one per market, and reveals the
right one after the geo lookup by putting `hidden` on the other. The `hidden`
attribute is applied by the browser's own stylesheet, and **any author rule that
sets `display` beats it**. `.pricing-grid { display: flex }` did exactly that.

So the attribute was set correctly, the JavaScript worked correctly, and the
browser painted the hidden grid anyway. Every visitor saw six cards stacked in
two rows:

    Website build   from $3,000     one off
    Video retainer  from $1,500     a month
    Growth retainer from $2,500     a month
    Starter         GH₵ 2,500       one off
    Growth          GH₵ 5,500       one off
    Premium         GH₵ 11,500      a month

Two product ranges, two currencies, two "Most Popular" badges, under a line
reading "All prices in Ghana cedis". From Accra the dollar row came first.

The fix is `[hidden] { display: none !important }` in `src/styles/style.css`,
global rather than a patch on `.pricing-grid`, because the site hides things with
that attribute in nine places and every one of them was one `display` declaration
away from the same silent failure.

Checked afterwards on the homepage, /global, all five priced service pages,
/contact and /projects, in both markets: nothing marked hidden is painted
anywhere, and the forms, the evidence reader and the reel showcase all still work.

## 1. The cards a visitor meets first

Homepage and `/global`, from `pricingPlans`.

| Plan | Shown to | Price |
| --- | --- | --- |
| Website build | Everywhere but Ghana | from $3,000 |
| Video retainer | Everywhere but Ghana | from $1,500 a month |
| Growth retainer | Everywhere but Ghana | from $2,500 a month |
| Starter | Ghana | GH₵ 2,500 |
| Growth | Ghana | GH₵ 5,500 |
| Premium | Ghana | GH₵ 11,500 |

The Ghana three are bundles, not single services. Growth at GH₵ 5,500 carries
two to three services, a custom website, a full brand identity kit and three
months of search and marketing work. That matters for section 3.

## 2. The service pages

Every tier on the site, after the 2 September corrections.

| Service | Tier | USD | GH₵ | Period |
| --- | --- | --- | --- | --- |
| Web design | Landing Page | $3,000 | GH₵ 2,500 | starting at |
| Web design | Corporate Site | $7,500 | GH₵ 5,000 | starting at |
| Web design | E-Commerce | Custom | Custom | per project |
| SEO | Local SEO | $1,500 | GH₵ 1,500 | /mo |
| SEO | Growth SEO | $3,000 | GH₵ 3,500 | /mo |
| SEO | Enterprise | Custom | Custom | /mo |
| Brand identity | Logo Design | $3,000 | GH₵ 2,000 | starting at |
| Brand identity | Brand Kit | $5,000 | GH₵ 3,500 | starting at |
| Brand identity | Full Visual Identity | Custom | Custom | per project |
| Video | Reel Pack | $1,250 | GH₵ 1,500 | one-off · 3 reels |
| Video | Starter | $1,500 | GH₵ 1,800 | per month |
| Video | Growth | $2,500 | GH₵ 3,500 | per month |
| Video | Scale | $6,000 | GH₵ 8,000 | per month |
| Fieldwork | Setting it up | from $2,500 | from GH₵ 3,000 | One off, two to three weeks |
| Fieldwork | Leads only | from $1,200 | from GH₵ 900 | A month |
| Fieldwork | Done for you | from $3,000 | from GH₵ 4,000 | A month |
| AI Automation | The build | from $3,000 | GH₵ 3,000 | one off |
| AI Automation | Beyond the standard build | Custom | Custom | per project |
| Digital Marketing & Social Media | The buyer profiles | from $3,000 | GH₵ 2,500 | one off |
| Digital Marketing & Social Media | Calendar and page | from $1,500 | GH₵ 1,800 | a month |
| Digital Marketing & Social Media | Ads on top | Custom | Custom | a month |

Prices come from four CMS globals, the `services` collection (AI Automation and
Digital Marketing, added 2 September) and `src/pages/services/fieldwork.astro`,
which is in no database at all. Every service now carries a price.

## 3. The cedi ladder and the dollar ladder now agree. Corrected 2 September.

Sorted by how many cedis a Ghanaian pays for each dollar a foreign buyer pays.
Flat would mean the two ladders agree on which service is dearer.

| Service | Tier | USD | GH₵ | GH₵ per $1 |
| --- | --- | --- | --- | --- |
| Web design | Corporate Site | 7,500 | 5,000 | 0.67 |
| Brand identity | Logo Design | 3,000 | 2,000 | 0.67 |
| Brand identity | Brand Kit | 5,000 | 3,500 | 0.70 |
| Fieldwork | Leads only | 1,200 | 900 | 0.75 |
| Web design | Landing Page | 3,000 | 2,500 | 0.83 |
| Digital Marketing & Social Media | The buyer profiles | 3,000 | 2,500 | 0.83 |
| SEO | Local SEO | 1,500 | 1,500 | 1.00 |
| AI Automation | The build | 3,000 | 3,000 | 1.00 |
| SEO | Growth SEO | 3,000 | 3,500 | 1.17 |
| Video | Reel Pack | 1,250 | 1,500 | 1.20 |
| Video | Starter | 1,500 | 1,800 | 1.20 |
| Fieldwork | Setting it up | 2,500 | 3,000 | 1.20 |
| Digital Marketing & Social Media | Calendar and page | 1,500 | 1,800 | 1.20 |
| Video | Scale | 6,000 | 8,000 | 1.33 |
| Fieldwork | Done for you | 3,000 | 4,000 | 1.33 |
| Video | Growth | 2,500 | 3,500 | 1.40 |

**Band 0.67 to 1.40, a 2.1 fold spread.** It was 0.33 to 3.00, a nine fold
spread, and the two ladders ranked the same services in opposite orders: a logo
cost more than a Fieldwork setup in dollars and one sixth of it in cedis.

The cedi ladder is still not a conversion of the dollar one, and should not be.
Converted at any real rate a logo would cost a Ghanaian several times what the
market bears. What changed is that the two now rank services the same way.

**Only two services moved.** Eight of the thirteen tiers were already inside the
band. Branding was too cheap in cedis (a logo was the third dearest thing in
dollars and the cheapest in cedis) and Fieldwork was the reverse.

| Tier | Was | Now | Why |
| --- | --- | --- | --- |
| Logo Design | GH₵ 1,000 | GH₵ 2,000 | Still under the GH₵ 2,500 Starter bundle, which includes branding and a website |
| Brand Kit | GH₵ 2,500 | GH₵ 3,500 | Under Corporate Site at GH₵ 5,000 |
| Fieldwork Leads only | $300 a month | $1,200 a month | The page sells 20 to 30 checked leads a month at about twenty minutes each. $300 was roughly $33 an hour |
| Fieldwork Done for you | $1,500 a month | $3,000 a month | Adds emails written and sent plus video and images, so it sits above the $2,500 Growth retainer rather than below it |
| Fieldwork Setting it up | GH₵ 6,000 | GH₵ 3,000 | Ernest kept the $2,500, so the cedi side moved. GH₵ 6,000 put a setup fee above the whole GH₵ 5,500 Growth bundle |

Fieldwork's dollar prices rose rather than its cedi prices falling, because the
cedi figures were the defensible ones: GH₵ 900 for 8 to 10 hours of hand research
is near GH₵ 100 an hour.

**One thing numbers did not fix.** Six tiers now sit at exactly $3,000: a landing
page, a logo, a month of Growth SEO, a Fieldwork month, an AI build and the buyer
profiles. The $3,000 floor compresses everything that would naturally fall
between $1,500 and $3,000 into one price. Flagged to Ernest on 2 September and
left as it is.

## 4. The estimator. Corrected 2 September.

The estimator on the homepage reads from `calculatorServices`, a separate
collection from everything above, and two of its three lines disagreed with the
service pages.

| Service | Was | Now | Matches |
| --- | --- | --- | --- |
| Web Design & Development | $3,000 / GH₵ 2,500 | unchanged | Landing Page |
| Branding & Identity | $3,000 / GH₵ 2,500 | $3,000 / GH₵ 2,000 | Logo Design in both currencies |
| SEO & Content | $2,400 / GH₵ 2,000 | $1,500 / GH₵ 1,500 | Local SEO |

The Branding row took its dollar figure from Logo Design and its cedi figure from
Brand Kit, so switching currency silently switched which product was being quoted.
The SEO row quoted $2,400, a number that existed nowhere else on the site, and
presented it as a one off while the SEO page sells a monthly.

## 5. The floor, and its two exceptions

Ernest set the rule on 2 September 2026: **nothing one off under $3,000**,
because `/global` sells a build from $3,000 and roughly a thousand cold emails
point at that page. Monthly plans are not covered.

Two tiers are under it, both on purpose, both recorded where they live:

| Tier | Price | Why it is allowed |
| --- | --- | --- |
| Video Reel Pack | $1,250 | The try once tier. At $3,000 the trial cost double the $1,500 monthly plan it exists to introduce. |
| Fieldwork Setting it up | $2,500 | The floor never reached this page: Fieldwork's prices are typed into the page file, and the script that applied the floor only writes to the CMS. Shown the gap on 2 September 2026, Ernest kept $2,500. |

Anything that enforces the floor in code has to skip both, and has to read
`src/pages/services/fieldwork.astro` as well as the CMS.
