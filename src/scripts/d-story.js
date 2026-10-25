// Pinned scroll stories for the home page sections (row D design).
//
// Markup: <section class="d-story" data-story data-steps="6" data-seg="0.85">
//           <div class="d-track"><div class="d-stage"> ... </div></div>
//         </section>
// While the visitor scrolls through the track, the section gets --s (0 to
// steps, in "screens" of data-seg viewport heights) and the active step
// i = floor(s + 0.35). Inside the section:
//   [data-step="k"]         gets .on when k === i and .done when k < i
//   [data-step-aria="hide"] also gets aria-hidden="true" unless active
//   [data-step-aria="current"] also gets aria-current="true" when active
//   [data-jump="k"]         scrolls to step k (data-jump-offset adds a fraction of a step)
//   [data-story-count]      shows the current step as "03 / 08" (the section title's counter)
// Reduced motion keeps the same steps; each section's CSS decides how much moves.

const stories = new Set();
let ticking = false;

function measure(el) {
  const steps = Number(el.dataset.steps || 6);
  const seg = Number(el.dataset.seg || 1);
  el.style.setProperty('--d-steps', String(steps));
  el.style.setProperty('--d-seg', String(seg));
  return { steps, seg };
}

function update(el) {
  const { steps, seg } = measure(el);
  const unit = window.innerHeight * seg;
  const top = el.getBoundingClientRect().top;
  const s = Math.max(0, Math.min(steps, -top / unit));
  el.style.setProperty('--s', s.toFixed(4));
  const i = Math.max(0, Math.min(steps, Math.floor(s + 0.35)));
  if (el.__dStep === i) return;
  el.__dStep = i;
  el.dataset.active = String(i);
  const pad = (n) => String(n).padStart(2, '0');
  el.querySelectorAll('[data-story-count]').forEach((node) => { node.textContent = `${pad(i + 1)} / ${pad(steps + 1)}`; });
  el.querySelectorAll('[data-step]').forEach((node) => {
    const k = Number(node.getAttribute('data-step'));
    node.classList.toggle('on', k === i);
    node.classList.toggle('done', k < i);
    const aria = node.getAttribute('data-step-aria');
    if (aria === 'hide') node.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    if (aria === 'current') node.setAttribute('aria-current', k === i ? 'true' : 'false');
  });
  el.dispatchEvent(new CustomEvent('d-story:step', { detail: { step: i } }));
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    let pinned = false;
    stories.forEach((el) => {
      if (!el.isConnected) { stories.delete(el); return; }
      update(el);
      const r = el.getBoundingClientRect();
      if (r.top <= 0 && r.bottom >= window.innerHeight) pinned = true;
    });
    // While a pinned stage fills the screen it carries its own buttons, so the
    // floating WhatsApp button steps aside (d-system.css).
    document.body.toggleAttribute('data-in-story', pinned);
  });
}

function jump(el, k, offset) {
  const { seg } = measure(el);
  const unit = window.innerHeight * seg;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Never past the last step, or the pinned stage scrolls away (the canvas stops at the end).
  const t = k === 0 ? 0 : Math.min(k + offset, Number(el.dataset.steps || 6));
  window.scrollTo({ top: top + t * unit + 2, behavior: reduce ? 'auto' : 'smooth' });
}

// One scroll, one step (Ernest, 24 Oct 2026: "the scroll effect is too slow.
// one scroll should make a change"). While a story's stage is pinned, one
// wheel gesture, one swipe or one arrow/page key moves exactly one step, with a
// short glide. Before the first step or after the last, the page scrolls on as
// normal, so visitors are never trapped. Dragging the scrollbar, Home/End and
// the links keep working as before.
const GLIDE_MS = 620;
const IDLE_MS = 180;
let gliding = false;
let wheelIdle = true;
let wheelTimer = 0;

// The story whose steps the page is on: from its first step to its last,
// measured by the steps themselves rather than the section's height, so a
// section with extra room after its track (or a shorter track) still steps.
function pinnedStory() {
  for (const el of stories) {
    if (!el.isConnected) continue;
    const { steps, seg } = measure(el);
    const unit = window.innerHeight * seg;
    const pos = -el.getBoundingClientRect().top;
    if (pos >= -1 && pos <= steps * unit + 1) return el;
  }
  return null;
}

function stepTarget(el, dir) {
  const { steps, seg } = measure(el);
  const unit = window.innerHeight * seg;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const s = Math.max(0, Math.min(steps, (window.scrollY - top) / unit));
  const i = Math.max(0, Math.min(steps, Math.floor(s + 0.35)));
  const k = i + dir;
  if (k < 0 || k > steps) return null;
  return Math.round(top + k * unit);
}

function glide(to) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { window.scrollTo({ top: to, behavior: 'instant' }); return; }
  const from = window.scrollY;
  const start = performance.now();
  gliding = true;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const frame = (now) => {
    const t = Math.min(1, (now - start) / GLIDE_MS);
    window.scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' });
    if (t < 1) requestAnimationFrame(frame); else gliding = false;
  };
  requestAnimationFrame(frame);
}

function nearest(el) {
  const { steps, seg } = measure(el);
  const unit = window.innerHeight * seg;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const s = Math.max(0, Math.min(steps, (window.scrollY - top) / unit));
  const i = Math.max(0, Math.min(steps, Math.floor(s + 0.35)));
  return Math.round(top + i * unit);
}

// The blue wipe between sections (Ernest, 25 Oct 2026). From a story's last
// step, one more scroll sweeps the blue panel (.d-wipe in the page) across,
// moves to the next section's first step behind it and sweeps it away; from a
// story's first step, scrolling up goes to the previous section's last step.
const SECTIONS = '[data-story], #pricing, #faq, #contact';
let wiping = false;

function sectionTarget(el, dir) {
  const all = Array.from(document.querySelectorAll(SECTIONS));
  const at = all.indexOf(el);
  const next = at < 0 ? null : all[at + dir];
  if (!next) return null;
  const top = next.getBoundingClientRect().top + window.scrollY;
  if (dir < 0 && next.hasAttribute('data-story')) {
    const { steps, seg } = measure(next);
    return Math.round(top + steps * window.innerHeight * seg);
  }
  return Math.round(top);
}

function wipeTo(y) {
  const panel = document.querySelector('.d-wipe');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!panel || reduce) { window.scrollTo({ top: y, behavior: 'instant' }); return; }
  const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--d-wipe-ms')) || 420;
  wiping = true;
  gliding = true;
  panel.classList.remove('is-out', 'is-reset');
  void panel.offsetWidth;
  panel.classList.add('is-in');
  window.setTimeout(() => {
    window.scrollTo({ top: y, behavior: 'instant' });
    panel.classList.remove('is-in');
    panel.classList.add('is-out');
    window.setTimeout(() => {
      panel.classList.add('is-reset');
      panel.classList.remove('is-out');
      void panel.offsetWidth;
      panel.classList.remove('is-reset');
      wiping = false;
      gliding = false;
    }, ms);
  }, ms);
}

/** Leaves the pinned story for the next or previous section; true when it did. */
function leave(el, dir) {
  const to = sectionTarget(el, dir);
  if (to === null) return false;
  wipeTo(to);
  return true;
}

/** Moves the pinned story one step; returns true when it took the input. */
function step(dir) {
  const el = pinnedStory();
  if (!el) return false;
  const to = stepTarget(el, dir);
  if (to === null) return leave(el, dir);
  glide(to);
  return true;
}

// The story the last gesture was in. A gesture that has just carried the page
// into a story first settles it exactly on the step showing, so the intro is
// never skipped by the momentum of the scroll that arrived.
let gestureStory = null;

function onWheel(e) {
  if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
  const el = pinnedStory();
  if (!el) { gestureStory = null; return; }
  const dir = e.deltaY > 0 ? 1 : -1;
  const entering = el !== gestureStory;
  gestureStory = el;
  if (!entering && stepTarget(el, dir) === null && sectionTarget(el, dir) === null) return; // nothing beyond: scroll on as normal
  e.preventDefault();
  // A trackpad sends a stream of wheel events per swipe (and its momentum);
  // only the first event after a pause moves a step.
  const fresh = wheelIdle && !gliding;
  wheelIdle = false;
  clearTimeout(wheelTimer);
  wheelTimer = window.setTimeout(() => { wheelIdle = true; }, IDLE_MS);
  if (entering && Math.abs(nearest(el) - window.scrollY) > 24) { if (!gliding) glide(nearest(el)); return; }
  if (fresh) step(dir);
}

let touchY = null;
let touchTaken = false;
function onTouchStart(e) {
  touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
  touchTaken = false;
}
function onTouchMove(e) {
  if (touchY === null) return;
  if (touchTaken) { e.preventDefault(); return; }
  const dy = touchY - e.touches[0].clientY;
  if (Math.abs(dy) < 12) return;
  const el = pinnedStory();
  if (!el) { gestureStory = null; return; }
  if (gliding) { e.preventDefault(); return; }
  const dir = dy > 0 ? 1 : -1;
  const entering = el !== gestureStory;
  gestureStory = el;
  if (!entering && stepTarget(el, dir) === null && sectionTarget(el, dir) === null) { touchY = null; return; } // nothing beyond
  e.preventDefault();
  touchTaken = true;
  if (entering && Math.abs(nearest(el) - window.scrollY) > 24) glide(nearest(el)); else step(dir);
}
function onTouchEnd() { touchY = null; touchTaken = false; }

function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
  const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
  const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
  if (!down && !up) return;
  if (gliding) { if (pinnedStory()) e.preventDefault(); return; }
  if (step(down ? 1 : -1)) e.preventDefault();
}

let inputBound = false;
function bindStepping() {
  if (inputBound) return;
  inputBound = true;
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);
}

export function initStories(root = document) {
  bindStepping();
  root.querySelectorAll('[data-story]').forEach((el) => {
    if (stories.has(el)) return;
    stories.add(el);
    el.__dStep = undefined;
    el.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-jump]') : null;
      if (!btn || !el.contains(btn)) return;
      e.preventDefault();
      jump(el, Number(btn.getAttribute('data-jump')), Number(el.dataset.jumpOffset || 0.35));
    });
    update(el);
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
