// Makes public/images/backdrops/work-wall.webp: our real work as one tilted wall of
// pictures on a transparent ground, the background behind the About, Work, case
// study and Contact pages (components/homeD/DBackdrop.astro; d-system.css fades it
// into dark or light sections). Pictures: the site's own files and the case study
// covers. Leave out anything showing client data (the fieldwork lead lists), and
// keep to the imagery rules: real work first, and people shown are Black.
//
// Needs playwright-core and a Chromium (not dependencies of the site):
//   npm i --no-save playwright-core && npx playwright-core install chromium
// Run from the repo root:  node scripts/backdrops/make-work-wall.mjs
import { readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const OUT = 'public/images/backdrops/work-wall.webp';
const CMS = 'https://cms.quademdigital.com/api/media/file/';
const local = (p) => 'data:image/webp;base64,' + readFileSync('public' + p).toString('base64');
// [picture, shape]: l = landscape screen, t = tall video frame, s = square
const WALL = [
  [CMS + 'omek-storefront-current-2026-09-27-800x500.avif?v=muk79huc', 'l'], [local('/images/work-based/video-fashion-480.webp'), 't'], [local('/images/quaderp-dashboard.webp'), 's'], [CMS + 'cover-quajo-speaks-800x500.avif?v=mt4jneg8', 'l'],
  [local('/images/work-based/campaign-showroom-480.webp'), 't'], [CMS + 'cover-quaderp-landing-800x500.avif?v=mt4jnsmq', 'l'], [local('/images/work-based/automation-demo-480.webp'), 's'], [local('/images/work-based/video-story-480.webp'), 't'],
  [local('/images/quaderp/landing-clean-640.webp'), 'l'], [local('/images/work-based/campaign-opening-480.webp'), 't'], [local('/images/work-based/search-research-480.webp'), 'l'], [local('/images/work-based/web-presentation-current-omek-480.webp'), 'l'],
];
const HEIGHT = { t: 520, s: 300, l: 188 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
const cols = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => `<div class="c" style="margin-top:${(c % 2) * -170}px">${[0, 1, 2, 3, 4, 5].map((r) => {
  const [src, shape] = WALL[(c * 5 + r * 3) % WALL.length];
  return `<img src="${src}" style="height:${HEIGHT[shape]}px">`;
}).join('')}</div>`).join('');
await page.setContent(`<style>html,body{margin:0;background:transparent;overflow:hidden}.w{position:absolute;left:-14%;top:-42%;display:flex;gap:24px;transform:rotate(-10deg)}.c{display:flex;flex-direction:column;gap:24px;width:300px;flex:none}img{display:block;width:300px;object-fit:cover;border-radius:14px}</style><div class="w">${cols}</div>`);
await page.waitForTimeout(3000);
const loaded = await page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
const png = await page.screenshot({ omitBackground: true });
await browser.close();
if (!loaded) throw new Error('A picture did not load; the wall would have a gap.');
await sharp(png).webp({ quality: 62, alphaQuality: 70, effort: 6 }).toFile(OUT);
console.log(`${OUT}: ${Math.round(statSync(OUT).size / 1024)} KB`);
