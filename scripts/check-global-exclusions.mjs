#!/usr/bin/env node
/*
  The /global page must not mention the Ghana payment stack or Ghanaian pricing.

  Not a style rule. /global is the page roughly a thousand cold emails point at,
  aimed at buyers in London, Dallas and Dubai. A single cedi price or a Mobile
  Money logo on it undoes the positioning the whole campaign rests on, and it
  does so silently: the page still renders, still scores well, still converts
  nobody.

  Why this checks rendered HTML rather than the source or the build output.
  With output: 'server' the page compiles into shared chunks under
  .vercel/output/_functions/, so a hit there cannot be attributed to a page. And
  anything arriving from the CMS never appears in a build artifact at all: a
  banned string could be typed into Site Settings tomorrow and no source scan
  would ever see it. scripts/check-csp.mjs already works this way for the same
  reason.

  Two scopes, because the funnel is more than one page now.

  /global links to case studies, and on 29 August those links started carrying
  ?from=global so the case study renders in the global chrome and sends the
  reader back to /global to book. Those pages are part of the funnel and have to
  be checked, or the leak this guard exists to catch just moves one click along.

  But they cannot be checked with the same list. A case study about a Ghanaian
  appliance shop says the checkout takes Paystack and Hubtel, because it does.
  That is a fact about the client's shop, not an offer of how to pay Quadem, and
  an international reader learns from it that local payment stacks get
  integrated. Scrubbing it would make the evidence vaguer, which is the opposite
  of what a case study is for.

  What must never appear on any funnel page is Quadem's own Ghana pricing or a
  route into the Ghana offers. Those are the things that break the positioning.
  So the 'offer' scope bans everything, the 'funnel' scope bans the pricing and
  the offers route, and reports payment names as notes rather than failures.

  Usage:
    node scripts/check-global-exclusions.mjs
    node scripts/check-global-exclusions.mjs --url=https://quademdigital.com/global/
    node scripts/check-global-exclusions.mjs --url=... --scope=funnel

  With no --url it checks /global/ and every case study /global/ links to.

  Exit 0 clean, 1 a banned string was found, 2 a page could not be fetched.
*/

const ORIGIN = 'http://localhost:4321';

/*
  The default sweep. The case studies are the three /global links to, checked in
  the context the campaign actually sends people to them in.
*/
const DEFAULT_TARGETS = [
    { url: `${ORIGIN}/global/`, scope: 'offer' },
    { url: `${ORIGIN}/projects/omek-storefront/?from=global`, scope: 'funnel' },
    { url: `${ORIGIN}/projects/quaderp-landing/?from=global`, scope: 'funnel' },
    { url: `${ORIGIN}/projects/san-collection/?from=global`, scope: 'funnel' },
];

/*
  Case sensitivity is load bearing on two of these.

  The page ships inline scripts holding a GTM container id and the Ahrefs key
  `rLG9enHa3Ne7Ob/OK/j4uQ`. A case-insensitive three letter match on "mtn" or
  "ghs" hits base64 noise several times over and the guard becomes something
  people learn to ignore. Both are matched exactly as they are written, with
  word boundaries.
*/
/*
  Pricing and positioning. Banned everywhere in the funnel, no exceptions: these
  say what Quadem charges and who Quadem is for.
*/
const POSITIONING = [
    { re: /built\s+for\s+ghana/i, name: '"Built for Ghana"' },
    { re: /\bGHS\b/, name: 'GHS' },
    { re: /GH?₵/, name: 'the cedi sign' },
    { re: /href="\/offers/i, name: 'a link into /offers' },
];

/*
  The Ghana payment stack. Banned on /global, where naming one is offering it.
  Reported but allowed on a case study, where naming one is describing a client's
  shop. See the note at the top of this file.
*/
const PAYMENTS = [
    { re: /\bMoMo\b/i, name: 'MoMo' },
    { re: /\bmobile\s+money\b/i, name: 'Mobile Money' },
    { re: /\bMTN\b/, name: 'MTN' },
    { re: /\bTelecel\b/i, name: 'Telecel' },
    { re: /\bAirtelTigo\b/i, name: 'AirtelTigo' },
    { re: /\bPaystack\b/i, name: 'Paystack' },
    { re: /\bHubtel\b/i, name: 'Hubtel' },
];

const urlArg = process.argv.find((a) => a.startsWith('--url='));
const scopeArg = process.argv.find((a) => a.startsWith('--scope='));

const targets = urlArg
    ? [{ url: urlArg.slice('--url='.length), scope: scopeArg ? scopeArg.slice('--scope='.length) : 'offer' }]
    : DEFAULT_TARGETS;

for (const t of targets) {
    if (t.scope !== 'offer' && t.scope !== 'funnel') {
        console.log(`Unknown scope "${t.scope}". Use offer or funnel.`);
        process.exit(2);
    }
}

/** Every match of one pattern list in one document, with the line it sits on. */
function scan(lines, patterns) {
    const out = [];
    for (const { re, name } of patterns) {
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        lines.forEach((line, i) => {
            let m;
            g.lastIndex = 0;
            while ((m = g.exec(line)) !== null) {
                out.push({
                    name,
                    line: i + 1,
                    column: m.index + 1,
                    context: line.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).trim(),
                });
                if (m[0].length === 0) g.lastIndex++;
            }
        });
    }
    return out;
}

let failures = 0;
let unreachable = 0;

for (const { url, scope } of targets) {
    let html;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'quadem-exclusion-check' } });
        if (!res.ok) {
            console.log(`Could NOT check: ${url} answered HTTP ${res.status}.`);
            unreachable += 1;
            continue;
        }
        html = await res.text();
    } catch (err) {
        console.log(`Could NOT check ${url}: ${err.message}`);
        unreachable += 1;
        continue;
    }

    const lines = html.split('\n');
    // On /global naming a Ghana payment method is offering it, so both lists are
    // fatal. On a case study it is describing a client's shop, so only the
    // pricing and the offers route are.
    const fatal = scope === 'offer' ? [...POSITIONING, ...PAYMENTS] : POSITIONING;
    const noted = scope === 'offer' ? [] : PAYMENTS;

    const hits = scan(lines, fatal);
    const notes = scan(lines, noted);

    console.log(`\n${url}`);
    console.log(`  scope ${scope}, ${lines.length} lines, ${fatal.length} banned pattern(s).`);

    if (hits.length === 0) {
        console.log('  Clean.');
    } else {
        failures += 1;
        console.log(`  ${hits.length} banned term${hits.length === 1 ? '' : 's'} found:`);
        for (const h of hits) {
            console.log(`    ${h.name}  line ${h.line}, column ${h.column}`);
            console.log(`      ...${h.context}...`);
        }
    }

    if (notes.length > 0) {
        const names = [...new Set(notes.map((n) => n.name))].join(', ');
        console.log(`  Allowed here, worth knowing: ${names}.`);
        console.log('  Describing a client\'s checkout is not offering a payment method. If any of');
        console.log('  these ever reads as what Quadem accepts rather than what a client uses, it');
        console.log('  belongs in POSITIONING instead.');
    }
}

console.log('');

if (unreachable > 0) {
    console.log(`${unreachable} page(s) could not be fetched. This is NOT a clean result.`);
    console.log('Start the dev server, or pass a --url that works.');
    process.exit(2);
}

if (failures > 0) {
    console.log('The funnel is aimed at buyers in the UK, the US and the Gulf. Cedi pricing and');
    console.log('the Ghana offers belong on the Ghana path, and nowhere near this one.');
    process.exit(1);
}

console.log(`Clean. ${targets.length} funnel page(s) checked, nothing that breaks the positioning.`);
