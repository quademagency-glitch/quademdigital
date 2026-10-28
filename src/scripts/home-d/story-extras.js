// What the problem and solutions stories need on top of d-story.js.
//
// d-story.js pins the stage, sets --s (0 to data-steps) and moves exactly one
// step per wheel gesture, swipe or key, landing on whole numbers of --s. The
// canvas designs of these two sections do not rest on whole numbers: a
// solutions app is fully open at k + 0.2, and a problem rests twice, once with
// the problem played (k + 0.24) and once with its fix (k + 0.45). So each
// section passes the list of resting moments (`stops`, in the canvas's own
// scroll units, chapter k = k), sets data-steps to stops.length - 1, and this
// maps --s onto the canvas units, piece by piece between stops:
//
//  - --d-m on the section: the canvas progress (its CSS reads it instead of --s)
//  - --d-q on the section: the same, held on the nearest stop, which reduced
//    motion (the device setting or the site's Pause motion button) uses, so
//    nothing slides while scrolling and every stop shows its finished state
//  - [data-dstep="k"] gets .on (k is the chapter showing) or .done (before it),
//    [data-dstep-aria="hide"] also gets aria-hidden unless it is showing
//  - [data-dcount] shows the chapter as "03 / 08" (the section title's counter)
//  - [data-dtab] links and buttons are tabbable only in the chapter showing
//  - a 'd-story:chapter' event with { chapter } when the chapter changes
//
// usage: storyExtras(section, { stops: [0, 1.2, 2.2, ...], chapters: 8 })

const pad = (n) => String(n).padStart(2, '0');

export function storyExtras(section, { stops, chapters }) {
  if (!section || section.__dExtras || !Array.isArray(stops) || stops.length < 2) return;
  section.__dExtras = true;
  const last = stops.length - 1;
  const seg = () => Number(section.dataset.seg || 1);
  const progress = () => Math.max(0, Math.min(last, -section.getBoundingClientRect().top / (window.innerHeight * seg())));
  const map = (n) => {
    const i = Math.min(last - 1, Math.floor(n));
    return stops[i] + (stops[i + 1] - stops[i]) * (n - i);
  };
  const nearest = (n) => stops[Math.max(0, Math.min(last, Math.floor(n + 0.35)))];

  let chapter = -1;
  const show = (c) => {
    if (c === chapter) return;
    chapter = c;
    section.querySelectorAll('[data-dstep]').forEach((node) => {
      const k = Number(node.getAttribute('data-dstep'));
      node.classList.toggle('on', k === c);
      node.classList.toggle('done', k < c);
      if (node.getAttribute('data-dstep-aria') === 'hide') node.setAttribute('aria-hidden', k === c ? 'false' : 'true');
    });
    section.querySelectorAll('[data-dtab]').forEach((el) => {
      const host = el.closest('[data-dstep]');
      el.tabIndex = host && Number(host.getAttribute('data-dstep')) === c ? 0 : -1;
    });
    section.querySelectorAll('[data-dcount]').forEach((node) => { node.textContent = `${pad(c + 1)} / ${pad(chapters)}`; });
    section.dispatchEvent(new CustomEvent('d-story:chapter', { detail: { chapter: c } }));
  };

  // The position comes from d-story.js, which measures every story once per
  // frame and announces it (d-story:progress); this used to measure the page
  // again on its own scroll listener, after other sections had changed it,
  // which made the browser lay the page out twice a frame (28 Oct 2026). Only
  // the first call, before d-story has run, measures for itself.
  const update = (n = progress()) => {
    if (!section.isConnected) return;
    const m = map(n);
    const q = nearest(n);
    section.style.setProperty('--d-m', m.toFixed(4));
    section.style.setProperty('--d-q', q.toFixed(4));
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body?.dataset.motion === 'paused';
    show(Math.max(0, Math.min(chapters - 1, Math.floor((still ? q : m) + 0.35))));
  };
  section.addEventListener('d-story:progress', (e) => update(Math.max(0, Math.min(last, Number(e.detail?.s) || 0))));
  update();
}
