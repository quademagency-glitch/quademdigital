#!/usr/bin/env node
/*
  Chart geometry for the analysis pieces, computed from the counts.

  Why this exists rather than hand-drawn SVG. The UK aesthetics teardown's line
  charts arrived already plotted, so porting them was a rename job. Everything
  after it starts from a table of numbers, and a bar whose width was nudged
  until it looked right is a chart that quietly disagrees with its own caption.
  docs/analysis-pipeline.md plans eight more sector pieces on this format, so
  the arithmetic belongs in one place.

  It prints SVG to stdout. It does not write to any page: paste the output into
  the .astro file, so the page stays readable on its own and a chart cannot
  change without showing up in a diff.

  Usage:
    node scripts/build-analysis-charts.mjs crawl-defects
    node scripts/build-analysis-charts.mjs crawl-regions
    node scripts/build-analysis-charts.mjs crawl-funnel

  Every class used here is defined in src/styles/analysis.css and resolves to a
  theme token, so the charts recolour with the site and check:theme stays at
  zero. Never put a colour literal in an SVG attribute: the theme checker looks
  for `fill:` with a colon and will not catch `fill="#333"`.
*/

const W = 860;
const H = 380;

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Number(v).toLocaleString('en-GB');

/* ---------------------------------------------------------------- data
   Source: docs/crawl-findings-2026-08-21.md, recounted over the full
   unfiltered crawl on 21 August 2026. Do not edit a number here without
   editing it there: an earlier set computed over the filtered outreach list
   overstated the headline by twelve percentage points. */

const CRAWL_DEFECTS = [
    ['No HTTPS', 1212, 42.9],
    ['No social share image', 1202, 42.5],
    ['No Instagram or TikTok linked', 884, 31.3],
    ['No meta description', 725, 25.6],
    ['Title truncates in Google', 532, 18.8],
    ['Oversized homepage HTML', 352, 12.4],
    ['No page title', 57, 2.0],
    ['No mobile viewport tag', 51, 1.8],
];

const CRAWL_REGIONS = [
    { name: 'UK', n: 1301, series: 1 },
    { name: 'Gulf', n: 760, series: 2 },
    { name: 'US', n: 305, series: 3 },
];

const CRAWL_MEASURES = [
    ['No HTTPS', { UK: 45.6, Gulf: 32.2, US: 48.5 }],
    ['No meta description', { UK: 20.1, Gulf: 31.2, US: 27.5 }],
    ['No Instagram or TikTok', { UK: 28.3, Gulf: 32.0, US: 40.3 }],
    ['Passed all eight', { UK: 16.5, Gulf: 19.1, US: 11.8 }],
];

const CRAWL_FUNNEL = {
    total: 3928,
    segments: [
        ['No website listed', 626, 3],
        ['Listed but unreachable', 474, 2],
        ['Loaded, and checked', 2828, 1],
    ],
};

/* ---------------------------------------------------------------- charts */

function open_(label, title) {
    return [
        `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet" class="chart">`,
        `<title>${esc(title)}</title>`,
    ];
}

/** Horizontal bars, one series, one row per category. */
function horizontalBars({ rows, axisLabel, xMax, aria, title }) {
    const LEFT = 232, RIGHT = 790, TRACK = RIGHT - LEFT;
    const TOP = 40, BH = 26, GAP = 12;
    const o = open_(aria, title);
    o.push(`<text class="axis-label" x="${LEFT}" y="16" text-anchor="start">${esc(axisLabel)}</text>`);
    const bottom = TOP + rows.length * (BH + GAP) - GAP;
    for (let pct = 0; pct <= xMax; pct += 10) {
        const x = LEFT + (TRACK * pct) / xMax;
        o.push(`<line class="grid" x1="${x.toFixed(1)}" y1="${TOP - 10}" x2="${x.toFixed(1)}" y2="${bottom + 6}"/>`);
        o.push(`<text class="tick" x="${x.toFixed(1)}" y="${bottom + 22}" text-anchor="middle">${pct}%</text>`);
    }
    rows.forEach(([label, count, pct], i) => {
        const y = TOP + i * (BH + GAP);
        const bw = (TRACK * pct) / xMax;
        const mid = (y + BH / 2 + 4).toFixed(1);
        o.push(`<text class="cat" x="${LEFT - 12}" y="${mid}" text-anchor="end">${esc(label)}</text>`);
        o.push(`<rect class="s-1" x="${LEFT}" y="${y}" width="${bw.toFixed(1)}" height="${BH}" rx="2"/>`);
        o.push(`<text class="value" x="${(LEFT + bw + 9).toFixed(1)}" y="${mid}" text-anchor="start">${pct.toFixed(1)}%  (${n(count)})</text>`);
    });
    o.push('</svg>');
    return o;
}

/** Grouped vertical bars: one group per measure, one bar per series. */
function groupedBars({ measures, series, axisLabel, yMax, aria, title }) {
    const L = 60, R = 800, TOP = 34, BASE = 312;
    const o = open_(aria, title);
    o.push(`<text class="axis-label" x="${L}" y="16" text-anchor="start">${esc(axisLabel)}</text>`);
    for (let pct = 0; pct <= yMax; pct += 10) {
        const y = BASE - ((BASE - TOP) * pct) / yMax;
        o.push(`<line class="grid" x1="${L}" y1="${y.toFixed(1)}" x2="${R}" y2="${y.toFixed(1)}"/>`);
        o.push(`<text class="tick" x="${L - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${pct}%</text>`);
    }
    const groupW = (R - L) / measures.length;
    const bw = 34, gap = 8;
    measures.forEach(([mlabel, vals], gi) => {
        const gx = L + gi * groupW;
        const cluster = series.length * bw + (series.length - 1) * gap;
        const start = gx + (groupW - cluster) / 2;
        series.forEach((s, si) => {
            const pct = vals[s.name];
            const x = start + si * (bw + gap);
            const h = ((BASE - TOP) * pct) / yMax;
            o.push(`<rect class="s-${s.series}" x="${x.toFixed(1)}" y="${(BASE - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="2"/>`);
            o.push(`<text class="value" x="${(x + bw / 2).toFixed(1)}" y="${(BASE - h - 7).toFixed(1)}" text-anchor="middle">${pct.toFixed(1)}</text>`);
        });
        o.push(`<text class="cat" x="${(gx + groupW / 2).toFixed(1)}" y="${BASE + 22}" text-anchor="middle">${esc(mlabel)}</text>`);
    });
    o.push(`<line class="grid" x1="${L}" y1="${BASE}" x2="${R}" y2="${BASE}"/>`);
    o.push('</svg>');
    return o;
}

/** One stacked bar showing how a population splits. Makes denominators visible. */
function stackedBar({ total, segments, caption, aria, title }) {
    const L = 60, R = 800, Y = 120, BH = 66, TRACK = R - L;
    const o = open_(aria, title);
    o.push(`<text class="axis-label" x="${L}" y="70" text-anchor="start">${esc(caption)}</text>`);
    let x = L;
    segments.forEach(([label, count, series], i) => {
        const w = (TRACK * count) / total;
        const pct = (count / total) * 100;
        // Stagger: narrow neighbouring segments would otherwise print their
        // labels on top of each other.
        const d = i % 2 ? 62 : 0;
        const cx = x + w / 2;
        o.push(`<rect class="s-${series}" x="${x.toFixed(1)}" y="${Y}" width="${w.toFixed(1)}" height="${BH}" rx="3"/>`);
        o.push(`<line class="grid" x1="${cx.toFixed(1)}" y1="${Y + BH}" x2="${cx.toFixed(1)}" y2="${Y + BH + 26 + d}"/>`);
        o.push(`<text class="value" x="${cx.toFixed(1)}" y="${Y + BH + 46 + d}" text-anchor="middle">${n(count)}</text>`);
        o.push(`<text class="cat" x="${cx.toFixed(1)}" y="${Y + BH + 66 + d}" text-anchor="middle">${esc(label)}</text>`);
        o.push(`<text class="cat" x="${cx.toFixed(1)}" y="${Y + BH + 86 + d}" text-anchor="middle">${pct.toFixed(1)}% of all</text>`);
        x += w;
    });
    o.push('</svg>');
    return o;
}

/* ---------------------------------------------------------------- cli */

const CHARTS = {
    'crawl-defects': () =>
        horizontalBars({
            rows: CRAWL_DEFECTS,
            axisLabel: 'share of the 2,828 sites that loaded',
            xMax: 50,
            aria: 'Share of 2,828 small business homepages failing each check, August 2026',
            title: 'Share of 2,828 small business homepages failing each check, August 2026',
        }),
    'crawl-regions': () =>
        groupedBars({
            measures: CRAWL_MEASURES,
            series: CRAWL_REGIONS,
            axisLabel: "share of that region's sites",
            yMax: 50,
            aria: 'Four homepage checks compared across the UK, the Gulf and the US, August 2026',
            title: 'Four homepage checks compared across the UK, the Gulf and the US, August 2026',
        }),
    'crawl-funnel': () =>
        stackedBar({
            total: CRAWL_FUNNEL.total,
            segments: CRAWL_FUNNEL.segments,
            caption: '3,928 businesses found on Google Maps',
            aria: 'How 3,928 businesses found on Google Maps split into those with no website, an unreachable website, and a website that loaded',
            title: 'How 3,928 businesses split by whether their website loaded, August 2026',
        }),
};

const which = process.argv[2];
if (!which || !CHARTS[which]) {
    console.error('Usage: node scripts/build-analysis-charts.mjs <chart>');
    console.error(`Charts: ${Object.keys(CHARTS).join(', ')}`);
    process.exit(1);
}
console.log(CHARTS[which]().map((l) => `        ${l}`).join('\n'));
