#!/usr/bin/env node
/**
 * Does the "book a call" button actually reach a booking page?
 *
 * On 29 August 2026 it did not, on two of the three places it appears. /global
 * and the homepage price calculator both pointed at
 * https://calendly.com/quadem-agency/free-strategy-call, which is not a
 * Calendly account and answers 404. The contact page worked, because its URL
 * came from the CMS and the CMS value was right.
 *
 * Nothing caught it. The link was valid HTML, it passed every existing guard,
 * and Calendly does not tell you when a booking page is never loaded. The only
 * signal was a prospect reaching the end of a cold email sequence, clicking
 * Book a call, and quietly giving up. On the page roughly a thousand emails
 * point at, that is the most expensive class of bug this repo can have.
 *
 * What makes it easy to get wrong: `quadem_agency` IS the right handle on X.
 * Handles differ per platform, and nobody re-reads a booking URL once it is
 * written down.
 *
 * So this opens every booking URL the site can serve and fails if any of them
 * is not a real event.
 *
 *   node scripts/check-booking-links.mjs
 *
 * Exit codes, matching the other guards in this repo:
 *   0  every booking link resolves
 *   1  at least one is dead. This is a real finding, fix it before shipping.
 *   2  could not check. NOT a pass. The CMS or Calendly was unreachable.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const EXTS = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs']);

function readEnv() {
    const out = {};
    try {
        for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
        }
    } catch {
        /* no .env is fine; the CMS check is then skipped and reported as such */
    }
    return out;
}
const env = { ...readEnv(), ...process.env };

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith('._') || entry === 'node_modules') continue;
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (EXTS.has(extname(p))) out.push(p);
    }
    return out;
}

/*
  Every calendly.com URL the source can actually serve, with where it is written.

  Comments have to come out first, and properly. Three files in this repo quote
  the dead URL deliberately, to explain what went wrong and stop someone
  reinstating it. A guard that fails on its own documentation is a guard that
  gets switched off within a week.

  Block comments are removed wholesale. Line comments are only removed when the
  line is entirely a comment, because "//" also appears in the middle of every
  URL this script is looking for, and stripping from the first "//" to the end
  of the line would delete the very thing being checked.

  Blanking rather than deleting keeps the line numbers honest, so the report
  still points at the right line.
*/
function stripComments(source) {
    const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
        block.replace(/[^\n]/g, ' ')
    );
    return withoutBlocks
        .split('\n')
        .map((line) => (line.trim().startsWith('//') ? '' : line))
        .join('\n');
}

const found = new Map();
for (const file of walk(SRC)) {
    const rel = relative(ROOT, file);
    stripComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
            for (const m of line.matchAll(/https:\/\/calendly\.com\/[A-Za-z0-9_\-/]+/g)) {
                const url = m[0].replace(/[/]+$/, '');
                if (!found.has(url)) found.set(url, []);
                found.get(url).push(`${rel}:${i + 1}`);
            }
        });
}

// And the one the CMS serves, which is the value that actually ships.
let cmsUrl = null;
let cmsError = null;
if (env.PUBLIC_PAYLOAD_URL && env.PAYLOAD_API_KEY) {
    try {
        const r = await fetch(`${env.PUBLIC_PAYLOAD_URL}/api/globals/contactPage?depth=0`, {
            headers: { Authorization: `users API-Key ${env.PAYLOAD_API_KEY}` },
        });
        if (!r.ok) cmsError = `HTTP ${r.status}`;
        else {
            const v = (await r.json())?.calendlyUrl;
            if (typeof v === 'string' && v.trim()) {
                cmsUrl = v.trim().split('?')[0].replace(/[/]+$/, '');
                if (!found.has(cmsUrl)) found.set(cmsUrl, []);
                found.get(cmsUrl).push('CMS contactPage.calendlyUrl');
            } else {
                cmsError = 'contactPage.calendlyUrl is empty';
            }
        }
    } catch (err) {
        cmsError = err.message;
    }
} else {
    cmsError = 'PUBLIC_PAYLOAD_URL or PAYLOAD_API_KEY missing from .env';
}

if (found.size === 0) {
    console.error('No booking URLs found at all, in the source or in the CMS.');
    console.error('That is not a pass. Either this guard is looking in the wrong place,');
    console.error('or the site has no way to book a call.');
    process.exit(2);
}

/*
  Calendly answers 404 for an account that does not exist, and 200 with a 404
  page for an account that exists but has no such event. Both have to fail, so
  checking the status code alone is not enough.
*/
async function check(url) {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'quadem-link-check' } });
    if (res.status === 404) return { ok: false, why: 'no such Calendly account (HTTP 404)' };
    if (!res.ok) return { ok: null, why: `HTTP ${res.status}` };
    const html = await res.text();
    if (/<title>\s*404\s*\|\s*Calendly\s*<\/title>/i.test(html)) {
        return { ok: false, why: 'the account exists but has no such event (Calendly 404 page)' };
    }
    return { ok: true, why: 'resolves' };
}

let dead = 0;
let unknown = 0;

console.log(`Checking ${found.size} booking URL(s).\n`);

for (const [url, where] of found) {
    let verdict;
    try {
        verdict = await check(url);
    } catch (err) {
        verdict = { ok: null, why: err.message };
    }
    const mark = verdict.ok === true ? 'ok  ' : verdict.ok === false ? 'DEAD' : '??  ';
    console.log(`${mark} ${url}`);
    console.log(`     ${verdict.why}`);
    where.forEach((w) => console.log(`     used at ${w}`));
    console.log('');
    if (verdict.ok === false) dead += 1;
    if (verdict.ok === null) unknown += 1;
}

if (cmsError) console.log(`Note: the CMS value could not be read (${cmsError}).\n`);

if (dead > 0) {
    console.error(`${dead} booking link(s) go nowhere. Anyone clicking them reaches an error page.`);
    console.error('The account is quademdigitalenterprise. quadem_agency is the handle on X and');
    console.error('is not a Calendly account. Fix the CMS value, or src/lib/booking.ts.');
    process.exit(1);
}

if (unknown > 0 || cmsError) {
    console.error('Some links could not be checked. That is not a pass.');
    process.exit(2);
}

console.log('Every booking link resolves to a real Calendly event.');
