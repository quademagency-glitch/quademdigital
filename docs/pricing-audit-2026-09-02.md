# Every price on the site, side by side

Pulled 2 September 2026 from the four service page globals in the CMS, the
`pricingPlans` collection, the `calculatorServices` collection and
`src/pages/services/fieldwork.astro`. Nothing here is a proposal. It is what the
site was charging on the day it was read.

Regenerate it with `node scripts/pricing-audit.mjs`, which reads the same five
sources rather than this file.

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

| Service | Tier | USD | GH₵ | Period |
| --- | --- | --- | --- | --- |
| Web design | Landing Page | 3,000 | 2,500 | starting at |
| Web design | Corporate Site | 7,500 | 5,000 | starting at |
| Web design | E-Commerce | Custom | Custom | per project |
| SEO | Local SEO | 1,500 | 1,500 | a month |
| SEO | Growth SEO | 3,000 | 3,500 | a month |
| SEO | Enterprise | Custom | Custom | a month |
| Brand identity | Logo Design | 3,000 | 1,000 | starting at |
| Brand identity | Brand Kit | 5,000 | 2,500 | starting at |
| Brand identity | Full Visual Identity | Custom | Custom | per project |
| Video | Reel Pack | 1,250 | 1,500 | one off, three reels |
| Video | Starter | 1,500 | 1,800 | a month |
| Video | Growth | 2,500 | 3,500 | a month |
| Video | Scale | 6,000 | 8,000 | a month |
| Fieldwork | Setting it up | 2,500 | 6,000 | one off |
| Fieldwork | Leads only | 300 | 900 | a month |
| Fieldwork | Done for you | 1,500 | 4,000 | a month |
| AI Automation | none | none | none | none |
| Digital Marketing | none | none | none | none |

**Two of the seven services carry no price at all.** They are rendered by
`src/pages/services/[slug].astro` from the `Services` collection, and that
collection has no price fields of any kind. Every currency figure on those two
pages comes from the budget question inside the enquiry form.

## 3. The cedi ladder and the dollar ladder disagree

Sorted by how many cedis a Ghanaian pays for each dollar a foreign buyer pays.
If the two ladders were consistent this column would be flat.

| Service | Tier | USD | GH₵ | GH₵ per $1 |
| --- | --- | --- | --- | --- |
| Brand identity | Logo Design | 3,000 | 1,000 | 0.33 |
| Brand identity | Brand Kit | 5,000 | 2,500 | 0.50 |
| Web design | Corporate Site | 7,500 | 5,000 | 0.67 |
| Web design | Landing Page | 3,000 | 2,500 | 0.83 |
| SEO | Local SEO | 1,500 | 1,500 | 1.00 |
| SEO | Growth SEO | 3,000 | 3,500 | 1.17 |
| Video | Reel Pack | 1,250 | 1,500 | 1.20 |
| Video | Starter | 1,500 | 1,800 | 1.20 |
| Video | Scale | 6,000 | 8,000 | 1.33 |
| Video | Growth | 2,500 | 3,500 | 1.40 |
| Fieldwork | Setting it up | 2,500 | 6,000 | 2.40 |
| Fieldwork | Done for you | 1,500 | 4,000 | 2.67 |
| Fieldwork | Leads only | 300 | 900 | 3.00 |

**A nine fold spread, from 0.33 to 3.00.**

The cedi ladder is not meant to be a conversion of the dollar one, and it should
not be. Converted at any single rate, a logo would cost a Ghanaian buyer several
times what the market bears. That decision is sound and is written up above the
tiers in `src/pages/services/fieldwork.astro`.

The problem is not the rate. It is that **the two ladders rank the same services
in opposite orders**, which is what a buyer notices:

- In dollars, a **logo** ($3,000) costs more than a **Fieldwork setup** ($2,500).
- In cedis, a **Fieldwork setup** (GH₵ 6,000) costs **six times** a logo
  (GH₵ 1,000).

And against the bundles in section 1:

- A Ghanaian sees **Fieldwork setup at GH₵ 6,000**, above the entire **Growth
  bundle at GH₵ 5,500** that contains a custom website, a full brand identity kit
  and three months of search work.

Either the logo is badly underpriced in cedis, or Fieldwork is badly overpriced
in cedis, or both. Deciding which is Ernest's call and no number here has been
changed.

## 4. The orphaned calculator figure

The estimator on the homepage reads from `calculatorServices`, a separate
collection from everything above.

| Service | USD | GH₵ | Matches a page tier? |
| --- | --- | --- | --- |
| Web Design & Development | 3,000 | 2,500 | Yes, Landing Page |
| Branding & Identity | 3,000 | 2,500 | Partly. $3,000 is Logo Design, GH₵ 2,500 is Brand Kit |
| SEO & Content | 2,400 | 2,000 | **No. Neither figure appears on the SEO page** |

The SEO page sells $1,500 a month and $3,000 a month. Neither $2,400 nor
GH₵ 2,000 exists anywhere else on the site, and the calculator presents its
totals as a one off while the SEO page sells a monthly. A visitor who adds SEO
in the calculator and then opens the SEO page sees three different numbers.

The Branding row is a subtler version of the same thing: the dollar figure is
taken from one tier and the cedi figure from a different one, so switching
currency in the calculator silently switches which product is being quoted.

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
