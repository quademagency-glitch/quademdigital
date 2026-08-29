# The analysis format

The look of the UK aesthetics search teardown, rebuilt on this site's tokens so
every future piece gets it without anyone rebuilding it.

## What was added

```
src/styles/analysis.css              the design system
src/layouts/AnalysisLayout.astro     page shell, dateline, structured data
src/components/analysis/
  SectionHead.astro                  numbered section heading
  StatTiles.astro                    up to three headline figures
  Figure.astro                       chart container with legend and caption
  Callout.astro                      method notes and caveats
```

Nothing existing was changed. `node scripts/check-theme-literals.mjs` and
`node scripts/check-em-dashes.mjs` both pass on the new files.

## How to use it

```astro
---
import AnalysisLayout from "../../layouts/AnalysisLayout.astro";
import SectionHead from "../../components/analysis/SectionHead.astro";
import StatTiles from "../../components/analysis/StatTiles.astro";
import Figure from "../../components/analysis/Figure.astro";
import Callout from "../../components/analysis/Callout.astro";
---
<AnalysisLayout
  title="UK Aesthetics Search Teardown"
  description="What 26 months of search data shows about three UK clinic chains."
  eyebrow="Search analysis"
  lede="Two of Britain's largest aesthetics chains have lost roughly a third of their Google traffic."
  published="2026-08-20"
  dataSource="Semrush estimates, June 2024 to August 2026"
>
  <div class="analysis-col">
    <SectionHead num="01" title="What the data shows" />
    <p>Prose sits in <code>.analysis-col</code>, which is a 660px measure.</p>
  </div>

  <Figure
    title="Estimated monthly organic traffic"
    sub="June 2024 to August 2026"
    caption="Semrush estimates. Estimates, not measurements: treat the shape as real and the exact values as approximate."
    legend={[{ label: "sk:n", series: 1 }, { label: "EF Medispa", series: 2 }]}
  >
    <svg class="chart" viewBox="0 0 900 380"><!-- inline SVG --></svg>
  </Figure>
</AnalysisLayout>
```

Prose goes in `.analysis-col`. Figures and tables sit outside it so they break
wider. That contrast is most of the format.

## The rules that make it work

**Three series maximum, and they are tokens.** `--series-1`, `--series-2`,
`--series-3`, defined for both themes in `analysis.css`. They are validated for
contrast on both page grounds and distinguishable under the common forms of
colour blindness. Do not use the brand blue for a data series: `--accent` is
already doing a different job on the page.

**Three stat tiles maximum.** A fourth turns a claim into a dashboard and the
reader stops reading any of them.

**Every figure needs a caption naming the source and the date.** This is not
decoration. It is the difference between analysis and marketing.

**Charts are inline SVG, never images.** A picture of a table cannot be read by
a search crawler, quoted by an answer engine, selected by a reader, or recoloured
by the theme. Wide charts scroll inside `.chart-scroll`; the page body must never
scroll sideways on a phone.

**Number the sections from 01 and do not skip.** The numbering is the format's
signature. It tells a sceptical reader this is structured analysis before they
have read a word.

**Say what the data cannot show.** Use `Callout` and put it near the top, not
buried at the bottom. Volunteering a limitation is what buys the reader's trust
for everything else on the page. The original teardown says plainly that every
figure is a Semrush estimate, and that is why it works.

**End with something the reader can use without hiring anyone.** The original
ends with five checks anyone can run on their own site in ten minutes. Keep that
pattern. A piece that ends in a sales pitch gets read once and never linked.

## Why the structured data is in the layout

`AnalysisLayout` emits `Report` schema with a named author, a published date, a
modified date and the data source, and passes it to `BaseLayout`'s existing
`jsonLd` prop.

Search engines need the article markup. AI answer engines need a named human, a
visible date and a stated source before they will cite a claim rather than
absorb it anonymously. These pages exist to be quoted, so the attribution is
part of the deliverable, not metadata.

Practical consequences, and they are all things people get wrong:

- Put the headline number in text near the top. A figure that only exists inside
  an SVG path is invisible to anything reading the page as text.
- Use real `<table>` markup for tabular data, with `<th>` headers.
- Set `updated` whenever figures are revised, and say so on the page.
- Write claims as complete sentences that survive being lifted out of context.
  "sk:n's estimated organic traffic fell 34% between June 2024 and August 2026"
  is quotable. "It fell by a third" is not.

## One thing to fix separately

`node scripts/check-em-dashes.mjs` reports 27 under CMS content, but it could not
reach the CMS when I ran it, so that number is unverified. Run it on a machine
that can reach the CMS and clear whatever it finds. Em dashes in live copy are a
standing rule on this project.
