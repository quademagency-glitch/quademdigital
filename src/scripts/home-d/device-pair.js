// Laptop and phone together in the home stories (Ernest, 28 Oct 2026: "use
// both laptop and phone mockups side by side", the phone in front of the
// laptop, on phones too). The column is marked data-d-pair; d-system.css shows
// both devices and places them from the variables this sets.
//
// On a computer the laptop stays where the section puts it. The phone stands
// in front of its lower right corner, --pair-h of its height (0.74 unless the
// section says otherwise), --pair-dx of its width past its right edge and
// --pair-dy of its height below it.
//
// On a phone or an upright tablet (900px and narrower) the phone fills the
// room between the words above and the button below, as large as it was on
// its own (never more than 1.15 times the CSS size), and the laptop, a little
// over half its height, sits behind it on the left with its right side under
// the phone. If the pair is wider than the column, both shrink together.
//
// Measured when the browser reports the column's size (after layout), every
// column read before any is changed, and never while scrolling. Sizes are
// read on screen and turned back into page pixels, so the page zoom on
// tablets and big screens cancels out.
//
// usage: devicePair(section)

const SMALL = window.matchMedia('(max-width: 900px)');
const GAP = 14; // kept clear above and below on a phone, in screen pixels
const MAX = 1.15;
const OVERLAP = 0.22; // share of the laptop's width under the phone, on a phone
const LAPTOP = 0.56; // the laptop's height against the phone's, on a phone
const columns = new Set();
let watcher = null;

const read = (el, name, fallback) => {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
};
const current = (el, name) => parseFloat(el.style.getPropertyValue(name)) || 0;

function plan(col) {
  const phone = col.querySelector(':scope > [class*="-phonebox"]');
  const lap = col.querySelector(':scope > [class*="-lapbox"]');
  if (!phone || !lap) return null;
  const c = col.getBoundingClientRect();
  if (!c.width || !c.height) return null;
  const zoom = c.width / (col.offsetWidth || c.width);
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;
  // Each device's on-screen size at scale 1: what it measures now, divided by
  // the scale it was given.
  const pr = phone.getBoundingClientRect();
  const pk = current(phone, '--pair-k') || read(phone, '--pair-k', 0.5);
  const pw = pr.width / pk;
  const ph = pr.height / pk;
  const lr = lap.getBoundingClientRect();
  if (!pw || !ph || !lr.width) return null;
  const vars = {};

  if (!SMALL.matches) {
    const h = read(col, '--pair-h', 0.74);
    const dx = read(col, '--pair-dx', 0.02);
    const dy = read(col, '--pair-dy', 0.05);
    const k = (lr.height * h) / ph;
    const right = lr.right + dx * lr.width;
    const bottom = lr.bottom + dy * lr.height;
    vars['--pair-k'] = k.toFixed(4);
    vars['--pair-x'] = `${((right - (pw * k) / 2 - cx) / zoom).toFixed(1)}px`;
    vars['--pair-y'] = `${((bottom - (ph * k) / 2 - cy) / zoom).toFixed(1)}px`;
    return { phone, lap, vars, clear: ['--lap-k', '--lap-x', '--lap-y'] };
  }

  const lk = current(lap, '--lap-k') || read(lap, '--lap-k', 0.45);
  const lw = lr.width / lk;
  const lh = lr.height / lk;
  let k = Math.min(MAX, (c.height - GAP * 2) / ph);
  let kl = (ph * k * LAPTOP) / lh;
  const width = () => lw * kl * (1 - OVERLAP) + pw * k;
  if (width() > c.width - 8) { const f = (c.width - 8) / width(); k *= f; kl *= f; }
  const left = cx - width() / 2;
  const lapCx = left + (lw * kl) / 2;
  const lapCy = cy - ph * k * 0.08;
  const phoneCx = left + lw * kl * (1 - OVERLAP) + (pw * k) / 2;
  vars['--pair-k'] = k.toFixed(4);
  vars['--pair-x'] = `${((phoneCx - cx) / zoom).toFixed(1)}px`;
  vars['--pair-y'] = '0px';
  vars['--lap-k'] = kl.toFixed(4);
  vars['--lap-x'] = `${((lapCx - cx) / zoom).toFixed(1)}px`;
  vars['--lap-y'] = `${((lapCy - cy) / zoom).toFixed(1)}px`;
  return { phone, lap, vars, clear: [] };
}

function layout(cols) {
  // Read every column first, then change them.
  const plans = [...cols].map(plan);
  plans.forEach((p) => {
    if (!p) return;
    Object.entries(p.vars).forEach(([name, value]) => {
      const el = name.startsWith('--lap') ? p.lap : p.phone;
      if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
    });
    p.clear.forEach((name) => p.lap.style.removeProperty(name));
  });
}

export function devicePair(section) {
  const col = section && section.querySelector('[data-d-pair]');
  if (!col || columns.has(col)) return;
  columns.add(col);
  if (!('ResizeObserver' in window)) return;
  if (!watcher) {
    watcher = new ResizeObserver((entries) => layout(entries.map((e) => e.target)));
    SMALL.addEventListener('change', () => layout(columns));
  }
  // The first report arrives once the column has been laid out.
  watcher.observe(col);
}
