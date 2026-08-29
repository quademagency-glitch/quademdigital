#!/usr/bin/env node
/*
  SPENT. The document this creates was deleted on 29 August 2026, deliberately.

  There were two Omek case studies for one client. This script made the second
  one, to carry the measured before-and-after table. The table was moved onto
  the published study on 29 August, the published study was then rewritten to
  tell the whole story including the audit and the rebuild, and the duplicate
  became redundant. Ernest deleted it.

  So running this again would put the duplicate back: a second card for one
  client on a grid of six, with no cover image, splitting one story across two
  pages. It refuses to run for that reason. The full document as it stood at
  deletion is in cms/scripts/omek-gigs-performance-deleted-backup.json, which
  is gitignored, and that is the thing to read if the text is ever wanted
  again. Pass --recreate only if you have decided you actually want the second
  document back.

  What it used to do, and still would with --recreate:

  Creates or updates the Omek Gigs performance case study in Payload.

  Over REST with the editor API key rather than the local API, for the reason
  given in repoint-video-to-ai.mjs: booting the Payload config against the
  remote Railway Postgres hangs indefinitely.

  It writes `published: false`, and that is now a review gate rather than a
  measurement one.

  The blocker used to be that the July run's throttling was never recorded, so
  the two runs were not confirmed to be like for like. Ernest confirmed on
  29 August 2026 that both were taken with pagespeed.web.dev. That tool runs
  Lighthouse in the cloud on fixed settings and offers no throttling control at
  all: every mobile run gets the same emulated Moto G Power on Slow 4G. The
  setting therefore could not have differed between them, and the comparison
  holds. The only control it exposes is mobile or desktop, and 19.3s for the
  main picture is a throttled-mobile figure rather than a desktop one.

  What is left is that nobody has read the finished page. Flip `published` once
  someone has.

  Every number here is transcribed from HANDOFF.md, which took them from Google
  PageSpeed Insights. Do not round them, do not convert them to percentages and
  do not compute new figures from them. Where the July desktop sub-metrics are
  empty, they were genuinely never captured, and the page prints "not recorded".

  Run:
    node cms/scripts/seed-omek-case-study.mjs --recreate --dry-run
    node cms/scripts/seed-omek-case-study.mjs --recreate
*/

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY = process.argv.includes('--dry-run');

/*
  The guard. A --dry-run is refused too, because the useful half of this script
  is now the commentary above it rather than anything it does.
*/
if (!process.argv.includes('--recreate')) {
    console.error('This script is spent. It creates the duplicate Omek case study that was');
    console.error('deleted on 29 August 2026 once its table and its story had been moved onto');
    console.error('the published study at /projects/omek-storefront/.');
    console.error('');
    console.error('The deleted document is saved at');
    console.error('  cms/scripts/omek-gigs-performance-deleted-backup.json');
    console.error('');
    console.error('Pass --recreate if you have decided you want a second Omek entry back.');
    process.exit(2);
}

function readEnv() {
    const out = {};
    const file = join(ROOT, '.env');
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
}

const env = { ...readEnv(), ...process.env };
const BASE = env.PUBLIC_PAYLOAD_URL;
const KEY = env.PAYLOAD_API_KEY;
if (!BASE || !KEY) {
    console.error('Need PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY in the repo root .env.');
    process.exit(2);
}

const SLUG = 'omek-gigs-performance';

/* ------------------------------------------------------------------ body */

const p = (text) => ({
    type: 'paragraph',
    version: 1,
    children: [{ type: 'text', version: 1, format: 0, detail: 0, mode: 'normal', style: '', text }],
});
const h = (text, tag = 'h2') => ({
    type: 'heading',
    tag,
    version: 1,
    children: [{ type: 'text', version: 1, format: 0, detail: 0, mode: 'normal', style: '', text }],
});

const body = {
    root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
            h('What a customer actually saw'),
            p(
                'Before the work, someone opening the shop on a phone waited eight seconds before anything at all appeared on the screen, and just over nineteen seconds before the main picture finished loading. On a shop, that is not a slow website. For most of that time it is an empty one, and people leave without ever seeing a product or a price.'
            ),
            p(
                'The site is an appliance shop in Accra. It runs a modern front end with WordPress behind it, which is a good arrangement and also one with a lot of places for time to leak away.'
            ),

            h('What I changed'),
            p(
                'The pictures were being asked for from the wrong address. Product images were still pointed at the shop domain rather than at the server that actually holds them, so every one of them took a detour before it arrived. Fixing the addresses was the first change, on 6 July.'
            ),
            p(
                'The main picture was waiting its turn. The browser was treating the large photograph at the top of the page as no more important than anything else on it, and on the shop page it was hidden behind an animation that only ran once the page had finished thinking. I told the browser which picture matters and removed the animation that was holding it back.'
            ),
            p(
                'The page was fetching things one at a time. The server was asking the WordPress side for the header, then the products, then the settings, in sequence, when it could ask for all of them at once. That change alone took a noticeable slice off the wait before anything appears.'
            ),
            p(
                'The tracking was loading before the shop. Analytics and the advertising pixel were being loaded as soon as the page became interactive, which is exactly the moment the phone is busiest. They now wait until everything else has finished. Nothing is lost by measuring a visit a second later, and the phone stops locking up: the time the page spent frozen and unresponsive fell from three tenths of a second to two hundredths.'
            ),
            p(
                'The brand logos were queueing in front of the products. Six manufacturer logos and four payment logos were all being downloaded immediately, competing with the product photograph for the same connection. They now load only when a visitor scrolls near them. Images were also being requested at full quality, which is invisible on a phone screen and expensive on a phone connection.'
            ),
            p(
                'One awkward one worth naming. The image service in front of the site was returning errors for two picture formats, so some images simply failed. Those two formats now skip it entirely. It is not elegant, and it works.'
            ),

            h('What it measures at now'),
            p(
                'The table below is the whole result. The number I would point at is the last one on the mobile list: the main picture now finishes loading in three and a half seconds instead of nineteen and a third. The rest follows from it.'
            ),
            p(
                'Accessibility, best practices and search readiness moved as well. Those were not the point of the work, and they moved because most of what makes a page fast also makes it well built.'
            ),

            h('How this was measured, and what it does not prove'),
            p(
                'Both runs are Google PageSpeed Insights, on an emulated mid-range Android phone, against the same address. The source line under the table gives the dates, the tool version and the connection setting.'
            ),
            p(
                'One honest caveat. The August run recorded that it was throttled to a slow 4G connection. The July run did not record its setting. It is very probably the same, because that is what PageSpeed uses by default, but I cannot prove it from what was captured at the time. So treat the two runs as a strong indication rather than a controlled experiment, and treat the individual August figures, which anyone can re-run today, as the solid ones.'
            ),
            p(
                'A speed score is not a sales figure. This page says the shop got faster and says how that was measured. It does not claim a revenue number, because I do not have one I could stand behind.'
            ),
        ],
    },
};

/* --------------------------------------------------------------- metrics */

const metrics = [
    // Mobile. Source: PageSpeed Insights, emulated Moto G Power.
    { section: 'Mobile', label: 'Performance score', before: '50', after: '88', highlight: false },
    { section: 'Mobile', label: 'Time until anything appears', before: '8.0s', after: '1.7s', highlight: true },
    { section: 'Mobile', label: 'Time until the main picture loads', before: '19.3s', after: '3.5s', highlight: true },
    { section: 'Mobile', label: 'Time until the page looks finished', before: '9.2s', after: '4.6s', highlight: false },
    { section: 'Mobile', label: 'Time the page spends frozen', before: '300ms', after: '20ms', highlight: true },
    { section: 'Mobile', label: 'Layout shifting as it loads', before: '0', after: '0', highlight: false },
    { section: 'Mobile', label: 'Accessibility score', before: '85', after: '93', highlight: false },
    { section: 'Mobile', label: 'Best practices score', before: '92', after: '100', highlight: false },
    { section: 'Mobile', label: 'SEO score', before: '92', after: '100', highlight: false },

    // Desktop. The five empty "before" values were never captured, and the page
    // prints "not recorded" rather than guessing them.
    { section: 'Desktop', label: 'Performance score', before: '78', after: '97', highlight: false },
    { section: 'Desktop', label: 'Time until anything appears', before: '', after: '0.3s', highlight: false },
    { section: 'Desktop', label: 'Time until the main picture loads', before: '', after: '0.7s', highlight: false },
    { section: 'Desktop', label: 'Time until the page looks finished', before: '', after: '0.8s', highlight: false },
    { section: 'Desktop', label: 'Time the page spends frozen', before: '', after: '140ms', highlight: false },
    { section: 'Desktop', label: 'Layout shifting as it loads', before: '', after: '0.001', highlight: false },
];

const doc = {
    title: 'Omek Gigs Appliance',
    slug: SLUG,
    tag: 'E-commerce',
    description:
        'An appliance shop in Accra where the main picture took nineteen seconds to load on a phone. Measured before and after, with Google PageSpeed Insights.',
    resultMetric: '3.5s',
    resultText: 'for the main picture to load on a phone, down from 19.3s',
    metricsTitle: 'Measured before and after',
    metricsBeforeLabel: '6 July 2026',
    metricsAfterLabel: '21 August 2026',
    metricsSource: [
        'Both runs were taken with pagespeed.web.dev, mobile, emulated Moto G Power, against https://omekgh.com/ which resolves to https://www.omekgh.com/.',
        'After: 21 August 2026, 4:27 PM GMT, Lighthouse 13.4.1, throttled to Slow 4G.',
        'Before: 6 July 2026. That report was not saved, but pagespeed.web.dev exposes no throttling control and applies the same Slow 4G emulation to every mobile run, so the two are measured the same way.',
    ].join('\n'),
    metrics,
    body,
    projectType: 'client',
    published: false,
};

/* ------------------------------------------------------------------ run */

const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${KEY}` };

const found = await fetch(`${BASE}/api/caseStudies?where[slug][equals]=${SLUG}&depth=0&limit=1`, { headers });
if (!found.ok) {
    console.error(`Could not read caseStudies: HTTP ${found.status}`);
    process.exit(1);
}
const existing = (await found.json()).docs?.[0];

if (DRY) {
    console.log(existing ? `Would UPDATE case study id ${existing.id} (slug ${SLUG}).` : `Would CREATE case study "${SLUG}".`);
    console.log(`  published: ${doc.published}   metric rows: ${metrics.length}   body blocks: ${body.root.children.length}`);
    console.log(`  highlighted rows: ${metrics.filter((m) => m.highlight).map((m) => m.label).join(', ')}`);
    console.log(`  rows with no "before": ${metrics.filter((m) => !m.before).length}`);
    process.exit(0);
}

const res = existing
    ? await fetch(`${BASE}/api/caseStudies/${existing.id}`, { method: 'PATCH', headers, body: JSON.stringify(doc) })
    : await fetch(`${BASE}/api/caseStudies`, { method: 'POST', headers, body: JSON.stringify(doc) });

const out = await res.json();
if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    console.error(JSON.stringify(out, null, 2).slice(0, 2000));
    process.exit(1);
}
const id = out.doc?.id ?? out.id;
console.log(`${existing ? 'Updated' : 'Created'} case study ${id} at /projects/${SLUG}/`);
console.log(`published: ${out.doc?.published}. It is unlisted and noindex until that is ticked.`);
