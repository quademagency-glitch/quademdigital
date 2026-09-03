#!/usr/bin/env node
/**
 * One price card design, enforced.
 *
 * WHY THIS EXISTS
 *
 * On 2 September 2026 this site drew the same price card six different ways:
 * the homepage, four hand-built service pages and the shared service template
 * each carried their own copy of the CSS under their own prefix. Four copies
 * were identical, which is exactly how the other two drifted without anyone
 * noticing. The SEO cards ended up with a 24px corner where the rest of the
 * site used 12px, a sunken background where the rest were raised, no shadow, no
 * hover and a green price; the AI Automation and Digital Marketing cards had no
 * button on them at all.
 *
 * Nothing caught any of that, because nothing was looking. This looks.
 *
 * WHAT IT CHECKS
 *
 *   1. Only src/components/PricingCards.astro styles a price card. Any other
 *      file defining a card-ish selector is a seventh design starting.
 *   2. Every page that shows a price imports PricingCards, so a new service page
 *      cannot quietly hand-roll its own.
 *   3. No price card CTA says "Get Started". Every one of these leads to a form
 *      or a chat; none starts anything, and three labels in a row of three cards
 *      is what the homepage was fixed for.
 *
 * The homepage is deliberately exempt from rule 1. Its cards live in a
 * horizontal carousel wired to the geo price switch through `data-usd` and
 * `data-ghs`, so it keeps its own markup in style.css. It is checked against
 * the component by eye and by computed style, not by this script. If you change
 * the component's look, change .pricing-card in src/styles/style.css to match.
 *
 *   node scripts/check-price-cards.mjs
 *
 * Exit 0 clean, 1 a real finding, 2 could not check. 2 is not a pass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const COMPONENT = join(SRC, 'components', 'PricingCards.astro');

/* Files allowed to carry price card styling of their own, and why. */
const EXEMPT = new Map([
    ['src/components/PricingCards.astro', 'the one design'],
    ['src/styles/style.css', 'the homepage carousel, kept in step by hand'],
    ['src/pages/services/fieldwork.astro', 'plain text prices on purpose, no cards'],
]);

/* Selectors that mean "somebody is drawing a price card here". */
const CARD_SELECTOR = /^\s*\.[a-z0-9-]*(?:pricing-card|tier-price|tier-name|tier-features|popular-badge|pricing-grid)\b/im;

/*
  Blanks out comments, keeping line numbers intact so a finding still points at
  the right line. Without this the check below flags the comment in
  PricingCards.astro that explains why "Get Started" was removed, which is the
  kind of false positive that teaches people to ignore a guard.
*/
function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(astro|css)$/.test(entry)) out.push(full);
    }
    return out;
}

let files;
try {
    files = walk(SRC);
} catch (err) {
    console.error(`Could not read ${SRC}: ${err.message}`);
    console.error('This is exit 2. Nothing was checked, which is not the same as a pass.');
    process.exit(2);
}
if (!files.length) {
    console.error('No source files found. Exit 2: nothing was checked.');
    process.exit(2);
}
try {
    readFileSync(COMPONENT, 'utf8');
} catch {
    console.error('src/components/PricingCards.astro is missing. Exit 2.');
    process.exit(2);
}

const findings = [];

for (const file of files) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');

    if (!EXEMPT.has(rel)) {
        lines.forEach((line, i) => {
            if (CARD_SELECTOR.test(line)) {
                findings.push({
                    rel,
                    line: i + 1,
                    what: `styles a price card of its own: ${line.trim().slice(0, 60)}`,
                    fix: 'Use <PricingCards> instead of a new copy of the card CSS.',
                });
            }
        });
    }

    /* A page that quotes prices but does not go through the component. */
    if (rel.startsWith('src/pages/') && /pricingSection|pricingTiers/.test(text) && !/PricingCards|ServicePricing/.test(text)) {
        findings.push({
            rel,
            line: lines.findIndex((l) => /pricingSection|pricingTiers/.test(l)) + 1,
            what: 'reads pricing from the CMS but renders it without PricingCards',
            fix: "import PricingCards from '../../components/PricingCards.astro' and pass it the tiers.",
        });
    }

    /* The label. Scoped to files that actually draw or configure a price card,
       so a "Get Started" hero button elsewhere is none of this script's
       business. `PricingCards` is in the list because a page sets the label by
       passing ctaLabel, and the first version of this check only looked at
       files containing the button class, so a page overriding the label was
       invisible to it. Proved by faking that exact regression. */
    if (/pc-btn|tier-btn|PricingCards/.test(text)) {
        stripComments(text).split('\n').forEach((line, i) => {
            if (/Get Started/i.test(line)) {
                findings.push({
                    rel,
                    line: i + 1,
                    what: 'a price card button says "Get Started"',
                    fix: 'Say "Book a call". Nothing here starts anything; every button leads to a form or a chat.',
                });
            }
        });
    }
}

if (!findings.length) {
    console.log('Price cards: one design, used everywhere. Clean.');
    process.exit(0);
}

console.error(`Price cards: ${findings.length} finding(s).\n`);
for (const f of findings) {
    console.error(`  ${f.rel}:${f.line}`);
    console.error(`    ${f.what}`);
    console.error(`    ${f.fix}\n`);
}
process.exit(1);
