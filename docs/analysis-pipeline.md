# The analysis pipeline

What to publish after the UK aesthetics teardown, why, and in what order.

Two goals at once. **SEO**: rank for what the buyer searches before they know they
need you. **GEO**: be the thing ChatGPT, Perplexity and AI Overviews quote when
somebody asks the question out loud. The same piece can serve both, but only if
it is built for it. The format in `analysis-format.md` handles the mechanics.

---

## The engine, before the list

Do not think of these as ten separate articles. There is one study design, run
repeatedly against a different sector and a different market.

> Take a sector in a market. Pick three or four named competitors. Pull 24 months
> of estimated search traffic. Show what happened. Explain what the winner did
> differently. End with checks the reader can run on their own site in ten minutes.

The first one is expensive because the format has to be invented. The second costs
a fraction, because the layout, the components, the chart code and the structure
already exist. That is the whole reason to have built `analysis.css` as a system
rather than styling one page.

---

## Piece 01: the one nobody else can write

**Working title:** What we found in the websites of 3,900 small businesses.

You are sitting on original research and have not noticed. The lead pipeline
crawled thousands of real small business websites across the UK and the Gulf and
recorded, for each one, whether it runs on https, whether it has a mobile
viewport, how heavy the homepage is, whether social accounts are linked, and what
platform it is built on.

Nobody else has that dataset. Every other agency writing about small business web
standards is quoting somebody else's survey. You measured it.

This is the highest-value piece in the list by a distance, for three reasons. It
cannot be copied. It produces a headline number that gets quoted, and a quoted
number carries a link. And it is the single best possible proof for the SECURE and
SPEED sequences, which together are 719 of your prospects.

**The recount is done.** Full findings, with methodology and the exact wordings
to publish, are in `docs/crawl-findings-2026-08-21.md`.

The warning in the earlier draft of this file was justified. Computing over the
filtered outreach list rather than the full crawl inflated the headline figure by
twelve percentage points: it would have read 54.9% with no HTTPS when the honest
number over all 2,828 crawled sites is **42.9%**. That is the figure most likely
to be quoted and the easiest for a stranger to check.

Headline numbers now verified and safe to publish:

- 42.9% of 2,828 crawled small business sites had no HTTPS
- Only 15.6% passed all eight basic checks
- 15.9% of 3,928 businesses had no website listed at all, rising to 25.4% in the US
- UK worst for security at 45.6%, Gulf best at 32.2%

The findings file also lists what must be stated on the page: it is not a random
sample, it is homepage only, 474 sites were unreachable and excluded, and the
checks are a floor rather than a standard. Publish the caveats with the numbers.

**Effort:** a day of data work, most of it recomputing over the raw crawl.
**Feeds:** SECURE, SPEED, and every conversation with an agency.

---

## Piece 02: who AI recommends

**Working title:** Ask ChatGPT for the best clinic in Manchester. Here is who it
names, and why.

**Correction to an earlier draft of this file.** It said you had Ahrefs Brand
Radar connected and could pull this data automatically. That was wrong. Every
Ahrefs endpoint on your account returns "Insufficient plan", Brand Radar
included. Checked 21 August 2026.

That does not kill the piece. It changes how the data gets collected, and
arguably improves it.

**Collect it by hand.** Pick one sector and one city. Write twenty questions a
real customer would ask. Run each in ChatGPT, Perplexity and Google with AI
Overviews on. Record which businesses get named, how often, and which pages get
cited as the source. That is a day's work and it produces something no tool
output can match: you can screenshot the actual answers.

**Why it is worth doing manually.** Almost nobody has published this with a
stated method for a specific sector and city. A tool-generated chart is easy to
dismiss. Twenty real answers with screenshots is not. It also means the piece
survives any tool changing its pricing or its metrics.

**One number you can automate.** Semrush exposes `serp_ai_overview_keywords`, the
count of keywords where a domain appears inside a Google AI Overview. Free on
your existing plan and worth pulling for every business named in the piece.

**Effort:** one day, most of it running prompts and screenshotting.
**Feeds:** GOOGLE sequence, and it is the natural opener for a new service line.

## Piece 03 onward: the sector runs

Same study design, new sector and market each time. Ordered by where you want
contracts and by how cheap the data is to get.

| # | Sector and market | Why this one | Feeds |
|---|---|---|---|
| 03 | UK hospitality: restaurants and bars | Large, visual, matches the 62 video prospects | VIDEO |
| 04 | UK trades: builders, electricians, plumbers | Huge search volume, dreadful websites, buyers with money | SECURE, MOBILE |
| 05 | Gulf retail: Dubai and Abu Dhabi | Higher budgets, and GMT is a real advantage you can state | All |
| 06 | UK dental and private healthcare | Adjacent to aesthetics, so the first piece does half the work | GOOGLE |
| 07 | EU hotels: Amsterdam, Berlin, Lisbon | Tests whether the format travels beyond English | VIDEO |
| 08 | UK legal and accountancy | High value per client, conservative buyers who respond to evidence | GOOGLE |

**Do not publish these faster than you can defend them.** One piece a month with
real data beats one a week with thin data, and thin data in this format is worse
than thin data in a blog post, because the format promises rigour.

---

## Piece 09: the one aimed at agencies

**Working title:** What agencies actually do when three projects land in the same
month.

Different shape. Not a data teardown, an industry piece, aimed squarely at the 16
white-label contacts and the ones after them. It works because it names a problem
they are living with and does not sell at them.

**Effort:** two days, and it needs conversations rather than a dataset. Worth
doing after two or three agency calls have happened, so it quotes real people
rather than guessing.

---

## Piece 10: pricing, and why it is here

**Working title:** What a website actually costs in 2026, by country.

Pricing pages are the single most-asked question type in AI answer engines, and
almost every published answer is either a vague range or an agency advertising
itself. A researched, sourced, cross-country comparison gets cited constantly.

The obvious risk: publishing your own rates invites comparison. The answer is that
it is a market survey, not a rate card. Your prices appear as one data point in a
sourced table, with the overheads explained. That is a stronger position than the
usual "contact us for a quote", and it does the work of the "why are you cheaper"
objection before anyone asks it.

---

## What every piece must do, or it fails at GEO

The format handles layout. These are content requirements, and they are the ones
people skip.

1. **The headline number exists as text**, in the first two paragraphs, in a
   complete sentence. A figure that lives only inside an SVG path is invisible to
   anything reading the page as text.
2. **Claims survive being lifted out of context.** "Estimated organic traffic for
   sk:n fell 34% between June 2024 and August 2026" is quotable. "It fell by about
   a third" is not, because it loses the subject and the dates.
3. **Named author, visible date, stated source.** Already handled by
   `AnalysisLayout`, but do not remove them to tidy the design.
4. **Real `<table>` markup** for tabular data, never a screenshot.
5. **A stated method and its limits**, near the top. Say what the data cannot
   show. This is what buys the reader's trust for everything else.
6. **An ending the reader can use without hiring anyone.** Checks they can run
   themselves. A piece that ends in a pitch gets read once and never linked.

---

## Measuring whether any of this works

You have the tools to know rather than guess, which most people doing this do not.

**The baseline is already recorded**, in `docs/baseline-2026-08-21.md`, taken
before any of this was published. Do not edit that file. Add a new dated one each
time you re-measure.

Where it stands today: 1 ranking keyword, 0 estimated organic traffic, Authority
Score 2, 50 referring domains, and no UK record in Semrush at all. Everything can
only go up from there, and any movement is attributable to the work rather than
to noise.

- **Referring domains** is the honest one. It tells you whether a piece earned
  links or merely existed.
- **Semrush position tracking** for the terms each piece targets.
- **AI visibility** has to be tracked by hand, because Ahrefs Brand Radar is not
  available on your plan. The baseline file has a fixed ten-prompt set. Run it
  monthly with identical wording, or the comparison is worthless.

---

## Cadence

One piece a month, published properly, is the right rate for a one-person studio
that also has client work. Two in the first month only if pieces 01 and 02 are
both ready, because they are the two that make the outbound campaign land.

Order: **01, then 02, then the sector runs.** Piece 01 is the one nobody can copy
and the one your existing prospects most need to see.
