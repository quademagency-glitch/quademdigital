# The crawl, recounted honestly

Source data for piece 01. Recomputed 21 August 2026 over the **full unfiltered
crawl**, not the filtered outreach list.

---

## What I checked and what I found

The earlier figures circulating from this dataset came from the *sendable* list:
1,137 businesses left after chains, aggregators and duplicates were removed and
the rest were scored and qualified for outreach. Those numbers are real, but they
describe businesses the filter selected, not businesses in general.

I recomputed everything over all 3,928 records. The difference is not academic.

### The selection bias, measured

| Defect | Full crawl | Filtered list | Inflation |
|---|---|---|---|
| No HTTPS | 42.9% | 54.9% | +12.0 points |
| No social share image | 42.5% | 47.1% | +4.6 |
| Title truncates in Google | 18.8% | 23.2% | +4.4 |
| Oversized homepage HTML | 12.4% | 15.0% | +2.5 |
| No meta description | 25.6% | 26.8% | +1.2 |
| No Instagram or TikTok linked | 31.3% | 25.5% | -5.8 |

**Publishing "55% have no security certificate" would have been wrong by twelve
percentage points.** The honest figure is 43%. That single number is the one most
likely to be quoted and the one easiest for a stranger to check.

---

## The publishable figures

### Sample

3,928 businesses, collected from Google Maps searches across named cities and
service categories in the UK, the Gulf, the US and elsewhere, crawled August 2026.

| Region | Businesses |
|---|---|
| UK | 1,640 (41.8%) |
| Gulf | 1,065 (27.1%) |
| US | 535 (13.6%) |
| Other or unclassified | 688 (17.5%) |

### Layer one: does the business have a website at all?

| | Count | Share |
|---|---|---|
| No website listed | 626 | **15.9% of all businesses** |
| Website listed | 3,302 | 84.1% |
| ...of those, unreachable when crawled | 474 | 14.4% of those with a site |
| ...of those, loaded successfully | 2,828 | |

No website at all, by region: **US 25.4%, Gulf 15.6%, UK 10.5%.**

### Layer two: defects, over the 2,828 sites that loaded

| Defect | Count | Share |
|---|---|---|
| No HTTPS | 1,212 | 42.9% |
| No social share image | 1,202 | 42.5% |
| No Instagram or TikTok linked | 884 | 31.3% |
| No meta description | 725 | 25.6% |
| Title truncates in Google | 532 | 18.8% |
| Oversized homepage HTML | 352 | 12.4% |
| No page title | 57 | 2.0% |
| No mobile viewport tag | 51 | 1.8% |
| **None of the above** | **442** | **15.6%** |

### By region, sites that loaded

| Region | n | No HTTPS | No meta description | No IG or TikTok | Fully clean |
|---|---|---|---|---|---|
| UK | 1,301 | 45.6% | 20.1% | 28.3% | 16.5% |
| Gulf | 760 | 32.2% | 31.2% | 32.0% | 19.1% |
| US | 305 | 48.5% | 27.5% | 40.3% | 11.8% |

---

## The headline claims, written so they survive being quoted

Use these wordings. Each carries its own denominator, so none of them can be
lifted out of context and made to say something else.

> Of 2,828 small business websites we crawled across the UK, the Gulf and the US
> in August 2026, 42.9% still had no HTTPS, meaning Chrome shows a "Not secure"
> warning before a visitor sees a price.

> Only 15.6% passed all eight of our basic checks.

> 15.9% of the 3,928 businesses we found on Google Maps had no website listed at
> all. In the US that rose to one in four.

> UK small business sites were the worst for security in our sample: 45.6% had no
> HTTPS, against 32.2% in the Gulf.

---

## What must be stated on the page

Do not publish any figure above without all of this alongside it. This is what
makes the piece unassailable rather than merely confident.

- **It is not a random sample.** Businesses came from Google Maps searches for
  chosen service categories in chosen cities. It represents the kind of business
  Quadem sells to, not all small businesses.
- **Homepage only.** Every check ran against the homepage. A site can pass all
  eight and still be poor on its other pages.
- **474 sites were unreachable** at crawl time and are excluded from the defect
  rates. Some of those are dead sites, which means the true "no working website"
  figure is higher than 15.9%, not lower. Say so.
- **"No website listed"** means no site on the Google Maps listing. A business
  might have one it has not linked.
- **Eight checks, and they are basic ones.** Name them. Passing them is a floor,
  not a standard.
- **Crawled August 2026.** Date every figure.

---

## One more finding worth its own paragraph

The Gulf has the *lowest* rate of missing HTTPS (32.2%) but the *highest* rate of
missing meta descriptions (31.2%). The UK is the reverse: worst on security,
best on meta descriptions.

That is a real pattern and it is the kind of detail that makes a piece read as
research rather than a sales argument. It also sharpens the outreach: security
first in the UK, search visibility first in the Gulf.
