// Each home story's phone mock-up fits the room left for it on phones and
// upright tablets (Ernest, 28 Oct 2026: the site looked poor on a phone).
//
// The CSS sizes each mock-up per screen size. On a 390x844 phone that size
// was 25 to 50px taller than the room between the words above it and the
// button below, so it covered the end of the words and ran under the button,
// and on an iPhone SE by up to 72px. This measures the room on the visitor's
// own screen and multiplies the CSS size by what fits, through the `scale`
// property, which stacks on the transform the CSS already sets. Never more
// than 1.15 times, so a tall phone shows it a little larger and nothing else
// changes. Above 900px the laptop shows instead and this does nothing.
//
// Measured when the browser reports the columns' size (ResizeObserver, after
// layout) rather than while the page is still starting, and all columns are
// read before any is changed: done one by one at start-up it cost a phone
// 146ms of blocked screen (PageSpeed, 28 Oct 2026).
//
// usage: fitPhones(section), with the section's .xx-phonecol holding its
// .xx-phonebox (hero, problem, solutions, process).

const SMALL = window.matchMedia('(max-width: 900px)');
const GAP = 14; // kept clear above and below the mock-up, in screen pixels
const MAX = 1.15;
const columns = new Set();
let watcher = null;

function fitAll(cols) {
  // Read every column first...
  const plans = [...cols].map((col) => {
    const box = col.querySelector('[class*="-phonebox"]');
    if (!box) return null;
    if (!SMALL.matches) return { box, k: null };
    const was = parseFloat(box.style.scale) || 1;
    // Both read on screen (getBoundingClientRect), so the page zoom on
    // tablets and big screens cancels out.
    const natural = box.getBoundingClientRect().height / was;
    const room = col.getBoundingClientRect().height - GAP * 2;
    if (natural <= 0 || room <= 0) return null;
    return { box, was, k: Math.min(MAX, room / natural) };
  });
  // ...then change them.
  plans.forEach((plan) => {
    if (!plan) return;
    if (plan.k === null) { if (plan.box.style.scale) plan.box.style.removeProperty('scale'); return; }
    if (Math.abs(plan.k - plan.was) > 0.004) plan.box.style.scale = plan.k.toFixed(3);
  });
}

export function fitPhones(section) {
  const col = section && section.querySelector('[class*="-phonecol"]');
  if (!col || columns.has(col)) return;
  columns.add(col);
  if (!('ResizeObserver' in window)) return;
  if (!watcher) {
    watcher = new ResizeObserver((entries) => {
      if (SMALL.matches) fitAll(entries.map((e) => e.target));
    });
    SMALL.addEventListener('change', () => fitAll(columns));
  }
  // The first report arrives once the column has been laid out.
  watcher.observe(col);
}
