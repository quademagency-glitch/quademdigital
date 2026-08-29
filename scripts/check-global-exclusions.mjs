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

  Usage:
    node scripts/check-global-exclusions.mjs
    node scripts/check-global-exclusions.mjs --url=https://quademdigital.com/global/

  Exit 0 clean, 1 a banned string was found, 2 the page could not be fetched.
*/

const DEFAULT_URL = 'http://localhost:4321/global/';

/*
  Case sensitivity is load bearing on two of these.

  The page ships inline scripts holding a GTM container id and the Ahrefs key
  `rLG9enHa3Ne7Ob/OK/j4uQ`. A case-insensitive three letter match on "mtn" or
  "ghs" hits base64 noise several times over and the guard becomes something
  people learn to ignore. Both are matched exactly as they are written, with
  word boundaries.
*/
const BANNED = [
    { re: /\bMoMo\b/i, name: 'MoMo' },
    { re: /\bmobile\s+money\b/i, name: 'Mobile Money' },
    { re: /\bMTN\b/, name: 'MTN' },
    { re: /\bTelecel\b/i, name: 'Telecel' },
    { re: /\bAirtelTigo\b/i, name: 'AirtelTigo' },
    { re: /\bPaystack\b/i, name: 'Paystack' },
    { re: /\bHubtel\b/i, name: 'Hubtel' },
    { re: /built\s+for\s+ghana/i, name: '"Built for Ghana"' },
    { re: /\bGHS\b/, name: 'GHS' },
    { re: /GH?₵/, name: 'the cedi sign' },
];

const arg = process.argv.find((a) => a.startsWith('--url='));
const url = arg ? arg.slice('--url='.length) : DEFAULT_URL;

let html;
try {
    const res = await fetch(url, { headers: { 'User-Agent': 'quadem-exclusion-check' } });
    if (!res.ok) {
        console.log(`Could NOT check: ${url} answered HTTP ${res.status}.`);
        console.log('This is NOT a clean result. Start the dev server, or pass a --url that works.');
        process.exit(2);
    }
    html = await res.text();
} catch (err) {
    console.log(`Could NOT check: ${err.message}`);
    console.log('This is NOT a clean result and it is NOT a list of problems.');
    process.exit(2);
}

const lines = html.split('\n');
const hits = [];

for (const { re, name } of BANNED) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    lines.forEach((line, i) => {
        let m;
        global.lastIndex = 0;
        while ((m = global.exec(line)) !== null) {
            hits.push({
                name,
                line: i + 1,
                column: m.index + 1,
                context: line.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).trim(),
            });
            if (m[0].length === 0) global.lastIndex++;
        }
    });
}

console.log(`Checked ${url}`);
console.log(`${lines.length} lines, ${html.length} characters, ${BANNED.length} banned patterns.`);

if (hits.length === 0) {
    console.log('\nClean. None of the excluded terms appear on the page.');
    process.exit(0);
}

console.log(`\n${hits.length} banned term${hits.length === 1 ? '' : 's'} found:\n`);
for (const h of hits) {
    console.log(`  ${h.name}  line ${h.line}, column ${h.column}`);
    console.log(`    ...${h.context}...`);
}
console.log('\nThis page is aimed at buyers in the UK, the US and the Gulf. The Ghana payment');
console.log('stack and cedi pricing belong on the Ghana path, which is /offers and the main');
console.log('site, and nowhere near this one.');
process.exit(1);
