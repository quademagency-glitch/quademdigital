#!/usr/bin/env node
/**
 * THE MARKET RULE, ENFORCED.
 *
 * The rule, set 4 September 2026 and written out in full at the top of
 * src/lib/markets.js:
 *
 *   1. A visitor in Africa is priced from the cedi list. Everyone else is
 *      priced from the dollar list.
 *   2. Whatever list they get, they see it in their own country's money.
 *   3. When we cannot convert honestly, we show the base currency rather than
 *      a number invented from a rate we do not have.
 *
 * WHY A SCRIPT AND NOT A NOTE IN THE README
 *
 * The 4 September audit found the same class of failure six times over, and
 * every one of them was invisible until somebody looked with fresh eyes:
 *
 *   · a badge clipped on the homepage for months because the one page that
 *     draws its own price cards was exempt from the guard that checks them
 *   · a subtitle promising cedi prices to a reader in London, two lines above
 *     a dollar figure
 *   · a calculator that never asked what country the visitor was in
 *   · a contact page asking Ghanaians for a budget in dollars
 *   · three fieldwork prices with no button under them
 *
 * None of those was a hard bug. Each was a page that quietly opted out of a
 * rule everything else followed. A rule nothing checks is a preference.
 *
 * WHAT IT CHECKS
 *
 *   1  The two market names. Only `africa` and `international` exist. `ghana`
 *      was the old name and a page still using it would be hidden from every
 *      African visitor outside Ghana.
 *   2  Both lists ship. A file with one market block and not the other shows
 *      one market nothing at all.
 *   3  Every price is convertible: [data-price] carries data-base, and a base
 *      that is one of the two real base currencies.
 *   4  No page hand-rolls a budget question. It goes through BudgetBands.
 *   5  No currency is named in shipping copy. The line under a price grid is
 *      written per visitor; a sentence typed above it is not.
 *   5b Every layout loads the price engine. /global/ quoted dollars to the
 *      whole world because its layout imported none of the site's JavaScript,
 *      which no per-element check could ever have seen.
 *   6  The CMS's copy of the rule is identical to the site's.
 *   7  The country tables are sane: no country in both, every currency in the
 *      fallback rate table, no duplicate keys.
 *   8  Every price card CTA leads somewhere.
 *   9  The live CMS quotes no cadence the card component cannot label, so a
 *      tier can never render with no One-off/Monthly pill.
 *
 *   node scripts/check-markets.mjs
 *
 * Exit 0 clean, 1 a real finding, 2 could not check. 2 is not a pass.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const RULE = join(SRC, 'lib', 'markets.js');
const CMS_RULE = join(ROOT, 'cms', 'src', 'lib', 'markets.js');

const findings = [];
const add = (file, line, what, fix) => findings.push({ file, line, what, fix });

const bail = (msg) => {
    console.error(msg);
    console.error('This is exit 2. Nothing was checked, which is not the same as a pass.');
    process.exit(2);
};

if (!existsSync(RULE)) bail(`${relative(ROOT, RULE)} is missing. The rule has no home.`);

const rule = await import(`file://${RULE}`);
const { AFRICA, REST_OF_WORLD, BASE_CURRENCY } = rule;

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        /* AppleDouble sidecars. This drive is exFAT and scatters `._name` files
           beside real ones; they are not committed and not shipping code. */
        if (entry.startsWith('.') || entry.startsWith('._')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(astro|ts|js|css)$/.test(entry)) out.push(full);
    }
    return out;
}

let files;
try {
    files = walk(SRC);
} catch (err) {
    bail(`Could not read ${SRC}: ${err.message}`);
}
if (!files.length) bail('No source files found.');

/* Comments explain the rules and quote the exact strings the rules ban, so a
   check that reads them flags its own documentation. Blanked while keeping line
   numbers, so a finding still points at the right line. */
const stripComments = (text) =>
    text
        /* A scoped <style> block inside a .astro file is CSS, not markup. It
           names classes like .service-from [data-price] to style them, which the
           markup checks below would otherwise read as an element missing its
           currency. Blanked with its line count kept, like the comments. */
        .replace(/<style[\s\S]*?<\/style>/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/^\s*\/\/[^\n]*/gm, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

const VALID_MARKETS = new Set(['africa', 'international']);
const VALID_BASES = new Set(Object.values(BASE_CURRENCY));

/*
  Files allowed to name a currency in prose, and why.

  src/lib/markets.js       writes the note itself; naming currencies is its job
  src/pages/api/rates.ts   the fallback rate table
  scripts/                 not shipped to a browser
*/
const COPY_EXEMPT = new Set([
    'src/lib/markets.js',
    'src/pages/api/rates.ts',
    'src/pages/api/geo.ts',
    'src/lib/servicePrices.ts',
    'src/lib/offers.ts',
]);

for (const file of files) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const raw = readFileSync(file, 'utf8');
    const text = stripComments(raw);
    const lines = text.split('\n');

    /* ── 1. Only two market names exist ─────────────────────────────────── */
    lines.forEach((line, i) => {
        for (const m of line.matchAll(/data-market\s*=\s*["']([a-z]+)["']/g)) {
            if (!VALID_MARKETS.has(m[1])) {
                add(rel, i + 1, `data-market="${m[1]}" is not a market`,
                    'Only "africa" and "international" exist. "ghana" was the old name for the cedi list and hides it from every African visitor outside Ghana.');
            }
        }
        /* The same name in a JS/TS comparison, e.g. market === 'ghana'. */
        for (const m of line.matchAll(/market\s*(?:===?|!==?)\s*['"]([a-z]+)['"]/g)) {
            /* markets.js owns the one translation from the CMS's stored value,
               exported as CMS_AFRICA_MARKET so it reads as a name rather than
               as a stray string. Everywhere else the literal is banned. */
            if (rel === 'src/lib/markets.js') continue;
            if (!VALID_MARKETS.has(m[1])) {
                add(rel, i + 1, `compares the market against "${m[1]}"`,
                    'Only "africa" and "international" exist. Compare against those.');
            }
        }
    });

    /* ── 2. Both lists ship, or neither ─────────────────────────────────── */
    const marketsHere = new Set([...text.matchAll(/data-market\s*=\s*["']?\{?([a-z.\w]+)/g)].map((m) => m[1]));
    const hasIntl = /data-market\s*=\s*["']international["']/.test(text);
    const hasAfrica = /data-market\s*=\s*["']africa["']/.test(text);
    const dynamic = /data-market=\{/.test(text);
    if (!dynamic && (hasIntl !== hasAfrica)) {
        const missing = hasIntl ? 'africa' : 'international';
        const line = lines.findIndex((l) => /data-market/.test(l)) + 1;
        add(rel, line, `ships the ${hasIntl ? 'international' : 'africa'} list and not the other`,
            `Add the ${missing} block. A page with one market shows the other market nothing: showMarket() hides what does not match and there is nothing left to reveal.`);
    }

    /* ── 3. Every price is convertible ────────────────────────────────────
       Markup only. src/scripts/main.js queries [data-price] and src/styles
       styles it; neither is an element that needs a currency on it. */
    const isMarkup = /\.astro$/.test(rel);
    if (isMarkup) lines.forEach((line, i) => {
        if (!/\bdata-price\b/.test(line)) return;
        /* The attribute may be spread across the following few lines in a
           multi-line element, which is how PricingCards writes it. */
        const block = lines.slice(i, i + 8).join(' ');
        const base = block.match(/data-base\s*=\s*(?:["']([A-Z]{3})["']|\{)/);
        if (!base) {
            add(rel, i + 1, 'a [data-price] element with no data-base',
                'Say which currency the number is in. Without it the browser cannot convert and does not know what it is looking at.');
        } else if (base[1] && !VALID_BASES.has(base[1])) {
            add(rel, i + 1, `data-base="${base[1]}" is not a base currency`,
                `Prices are written in ${[...VALID_BASES].join(' or ')} and converted from there. Anything else is a second price list.`);
        }
        /*
          And the number itself.

          /global/ carried data-price and data-base and no data-amount, because
          the array it renders from flattened every CMS row down to display
          strings and dropped priceUSD on the way. The element looked
          convertible and was not: a reader in London saw "$3,000" under a line
          that said prices were in pounds. The attribute has to be present even
          when its value is undefined (a Custom tier), which is what tells the
          difference between "this has no number" and "somebody forgot".
        */
        if (!/data-amount\s*=/.test(block)) {
            add(rel, i + 1, 'a [data-price] element with no data-amount',
                'Ship the number as well as the currency. Without it the element is skipped by the price engine and keeps whatever the server rendered, which is the base currency for every visitor on earth.');
        }
    });

    /* ── 4. Nobody hand-rolls the budget question ───────────────────────── */
    if (/name\s*=\s*["']budget["']/.test(text) && !rel.endsWith('forms/BudgetBands.astro')) {
        const line = lines.findIndex((l) => /name\s*=\s*["']budget["']/.test(l)) + 1;
        add(rel, line, 'builds its own budget question',
            'Use <BudgetBands />. The contact page and the service pages asked this on two different ladders, one of them dollars-only, until 4 September 2026.');
    }

    /* ── 5. No currency named in shipping copy ──────────────────────────── */
    if (!COPY_EXEMPT.has(rel) && !rel.startsWith('src/styles/')) {
        lines.forEach((line, i) => {
            /* A log line is read by whoever is debugging, not by a visitor. */
            if (/console\.(log|warn|error|info)/.test(line)) return;
            /* Prose, not code: a quoted sentence containing a currency name.
               Field names like priceUsd and CSS classes are not prose. */
            const m = line.match(/(?:prices?|priced|billed|invoiced|pay|paid)\s+(?:are\s+|is\s+)?in\s+(Ghana Cedis?|cedis?|US ?Dollars?|dollars?|USD|GHS|naira|pounds|GBP|euros?|EUR)\b/i);
            if (m) {
                add(rel, i + 1, `names a currency in copy: "${m[0].trim()}"`,
                    'The line under a price grid is written per visitor by the price engine. A currency typed into the page is edge-cached and served to the wrong country, which is how the video page told London its prices were in cedis.');
            }
        });
    }

    /* ── 8. A price card CTA that leads nowhere ───────────────────────────
       Markup only: a stylesheet naming .tier-price is styling a price, not
       quoting one, and cannot carry a link either way. */
    if (isMarkup && /fw-price|pc-price|tier-price/.test(text)) {
        const hasCta = /href=/.test(text);
        if (!hasCta) {
            add(rel, 1, 'quotes a price and has no link under it',
                'Every price on the site ends in a way to act on it. Fieldwork quoted three and offered none until 4 September 2026.');
        }
    }
}

/* ── 5b. Every layout can price a page ───────────────────────────────────────
   /global/ quoted three dollar figures to everybody, in every country, for as
   long as it had existed, because GlobalLayout.astro imports none of the site's
   shared JavaScript and nobody noticed that the price engine was part of it.
   That is not a missing attribute on an element, so none of the checks above
   could see it; it is a whole page silently opted out.

   A layout that renders a page with a price on it must load the engine. The
   analysis layout is exempt because it renders one long-form study and has
   never carried a price, and an exemption with a reason beside it is a decision
   rather than an oversight. */
{
    const LAYOUT_EXEMPT = new Map([
        ['src/layouts/AnalysisLayout.astro', 'a long-form study; carries no price and never has'],
    ]);
    const dir = join(SRC, 'layouts');
    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith('.astro') || entry.startsWith('.')) continue;
        const rel = `src/layouts/${entry}`;
        if (LAYOUT_EXEMPT.has(rel)) continue;
        /* Comments in here MENTION the engine by path while explaining why it
           has to be loaded, so a raw search finds it whether or not the import
           is actually there. Read the code. */
        const text = stripComments(readFileSync(join(dir, entry), 'utf8'));
        if (!/import[^;]*scripts\/(main|pricing)\.js/.test(text)) {
            add(rel, 1, 'renders pages but loads no price engine',
                "Import initPricing from '../scripts/pricing.js' and call it, the way GlobalLayout.astro does. Without it every price on every page using this layout stays in the base currency and never switches market. If the layout genuinely never shows a price, add it to LAYOUT_EXEMPT in this script with the reason.");
        }
    }
}

/* ── 6. The CMS copy of the rule is identical ───────────────────────────── */
if (!existsSync(CMS_RULE)) {
    add('cms/src/lib/markets.js', 1, 'is missing',
        'The CMS chooses an invoice currency from this file. Copy src/lib/markets.js to cms/src/lib/markets.js.');
} else if (readFileSync(CMS_RULE, 'utf8') !== readFileSync(RULE, 'utf8')) {
    add('cms/src/lib/markets.js', 1, 'has drifted from src/lib/markets.js',
        'Copy it across: cp src/lib/markets.js cms/src/lib/markets.js. If the two disagree, the site quotes one currency and the invoice arrives in another.');
}

/* ── 7. The country tables are sane ─────────────────────────────────────── */
{
    const both = Object.keys(AFRICA).filter((cc) => cc in REST_OF_WORLD);
    if (both.length) {
        add('src/lib/markets.js', 1, `${both.join(', ')} appear in both country tables`,
            'A country is in Africa or it is not. AFRICA wins in currencyFor(), so the duplicate is dead code hiding a disagreement.');
    }

    const ratesSrc = readFileSync(join(SRC, 'pages', 'api', 'rates.ts'), 'utf8');
    const inFallback = new Set([...ratesSrc.matchAll(/\b([A-Z]{3}):\s*[\d.]+/g)].map((m) => m[1]));
    const wanted = new Set([...Object.values(AFRICA), ...Object.values(REST_OF_WORLD)]);
    const missing = [...wanted].filter((c) => c !== 'USD' && !inFallback.has(c));
    if (missing.length) {
        add('src/pages/api/rates.ts', 1, `no fallback rate for ${missing.join(', ')}`,
            'Every currency a country table can produce needs a floor, or that country sees base-currency prices for the whole of a provider outage.');
    }
}

/* ── 9. The live CMS holds no cadence the cards cannot label ────────────── */
let cmsChecked = false;
try {
    const env = Object.fromEntries(
        readFileSync(join(ROOT, '.env'), 'utf8')
            .split('\n')
            .filter((l) => l.includes('='))
            .map((l) => {
                const i = l.indexOf('=');
                return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
            }),
    );
    const base = env.PUBLIC_PAYLOAD_URL;
    const key = env.PAYLOAD_API_KEY;
    if (base && key) {
        const headers = { Authorization: `users API-Key ${key}` };
        const kicker = (period = '') => {
            const p = String(period).toLowerCase().trim();
            if (!p) return '';
            if (/^one[- ]off/.test(p)) return 'One-off';
            if (/^(starting at|per project|one time|once)\b/.test(p)) return 'One-off';
            if (p.includes('month') || /^\/?mo\b/.test(p)) return 'Monthly';
            if (p.includes('year') || /^\/?yr\b/.test(p)) return 'Yearly';
            return '';
        };
        const sections = [];
        for (const slug of ['webDesignPage', 'seoPage', 'videoProductionPage', 'brandIdentityPage']) {
            const r = await fetch(`${base}/api/globals/${slug}?depth=0`, { headers });
            if (!r.ok) throw new Error(`${slug} -> ${r.status}`);
            sections.push([slug, (await r.json())?.pricingSection?.plans || []]);
        }
        const svc = await fetch(`${base}/api/services?limit=50&depth=0`, { headers });
        if (!svc.ok) throw new Error(`services -> ${svc.status}`);
        for (const s of (await svc.json()).docs || []) {
            sections.push([`services/${s.slug}`, s?.pricingSection?.plans || []]);
        }
        for (const [where, plans] of sections) {
            for (const plan of plans) {
                if (!kicker(plan.period)) {
                    add(`CMS ${where}`, 0, `"${plan.name}" has period "${plan.period ?? ''}", which labels as nothing`,
                        'The card renders no One-off/Monthly pill, so nothing tells the reader whether the price recurs. Use "one off", "a month", "per month", "/mo" or "per project".');
                }
            }
        }
        cmsChecked = true;
    }
} catch (err) {
    console.error(`Could not read the CMS: ${err.message}`);
    console.error('Exit 2: the cadences in the CMS were not checked, which is not the same as a pass.');
    process.exit(2);
}

if (!cmsChecked) {
    console.error('No PUBLIC_PAYLOAD_URL / PAYLOAD_API_KEY, so the CMS was not checked.');
    console.error('Exit 2. That is not a pass.');
    process.exit(2);
}

if (!findings.length) {
    console.log(`Markets: ${Object.keys(AFRICA).length} African countries, ${Object.keys(REST_OF_WORLD).length} elsewhere.`);
    console.log('Every price ships both lists, carries its base currency, and converts. Clean.');
    process.exit(0);
}

console.error(`Markets: ${findings.length} finding(s).\n`);
for (const f of findings) {
    console.error(`  ${f.file}${f.line ? ':' + f.line : ''}`);
    console.error(`    ${f.what}`);
    console.error(`    ${f.fix}\n`);
}
process.exit(1);
