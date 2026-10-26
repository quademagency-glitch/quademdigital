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
  // Setting --s makes the browser recheck the whole section, so only do it
  // when this section's position actually changed (off-screen sections sit
  // at 0 or at their last step and are left alone while the page moves).
  const sv = s.toFixed(4);
  if (el.__dS !== sv) { el.__dS = sv; el.style.setProperty('--s', sv); }
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
    holdEdge();
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
const GLIDE_MS = 480;
const IDLE_MS = 200;
let gliding = false;
const wheelDeltas = [];
let peakSinceStep = 0;
let easedOff = true;
let lastWheelAt = 0;
let glideEndedAt = 0;
// A swipe that arrives while the page is still moving is kept and taken as
// soon as the move ends, so quick swipes are never lost.
let queued = 0;

function moved() {
  gliding = false;
  glideEndedAt = performance.now();
  if (queued) { const dir = queued; queued = 0; step(dir); }
}

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

// The site sets html { scroll-behavior: smooth }, and not every browser honours
// scrollTo({ behavior: 'instant' }) (older Safari treats it as smooth or
// rejects it). So while this script moves the page it switches the page's
// smooth scrolling off and uses the plain scrollTo(x, y) every browser knows.
const rootEl = document.documentElement;
let heldBehavior = null;
function holdInstant() { if (heldBehavior === null) { heldBehavior = rootEl.style.scrollBehavior; rootEl.style.scrollBehavior = 'auto'; } }
function releaseInstant() { if (heldBehavior !== null) { rootEl.style.scrollBehavior = heldBehavior; heldBehavior = null; } }
function setScroll(y) { window.scrollTo(0, y); }

function glide(to) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  holdInstant();
  if (reduce) { setScroll(to); releaseInstant(); return; }
  const from = window.scrollY;
  const start = performance.now();
  gliding = true;
  // Starts moving at once and settles gently, so a swipe feels answered.
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const frame = (now) => {
    const t = Math.min(1, (now - start) / GLIDE_MS);
    setScroll(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(frame); else { releaseInstant(); moved(); }
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
// Only the home page's story sections: the site's footer also carries
// data-story="copy" for its own reveal, which is not a story.
const STORY = '.d-story[data-story]';
// A page's long, freely scrolling sections carry data-d-page (the home page's
// Prices, FAQ and Contact; the check-up and service pages' own).
const SECTIONS = `${STORY}, [data-d-page]`;
let wiping = false;

function sectionTarget(el, dir) {
  const all = Array.from(document.querySelectorAll(SECTIONS));
  const at = all.indexOf(el);
  const next = at < 0 ? null : all[at + dir];
  if (!next) return null;
  const top = next.getBoundingClientRect().top + window.scrollY;
  if (dir < 0 && next.matches(STORY)) {
    const { steps, seg } = measure(next);
    return Math.round(top + steps * window.innerHeight * seg);
  }
  // Going back up into a long section lands at its end, where it was left.
  if (dir < 0) return Math.max(Math.round(top), Math.round(next.getBoundingClientRect().bottom + window.scrollY - window.innerHeight));
  return Math.round(top);
}

// Prices, FAQ and Contact are longer than a screen, so they scroll as normal
// inside. Each is still a page of its own (Ernest, 25 Oct 2026: "the
// transition between pages is still not working"): scrolling stops at its
// edge, and one more scroll there sweeps the wipe to the next section.
const FLAT = '[data-d-page]';

/** The long section the top of the screen is in, with the scroll positions of its two ends. */
function flatPage() {
  const y = window.scrollY;
  for (const el of document.querySelectorAll(FLAT)) {
    const r = el.getBoundingClientRect();
    const top = Math.round(r.top + y);
    const bottom = Math.round(r.bottom + y);
    if (y >= top - 1 && y < bottom - 1) return { el, top, end: Math.max(top, bottom - window.innerHeight) };
  }
  return null;
}

function atEdge(page, dir) {
  return dir > 0 ? window.scrollY >= page.end - 1 : window.scrollY <= page.top + 1;
}

// A browser that animates wheel scrolling (a mouse wheel on Windows, say) is
// still catching up when the next event arrives, so stopping at the edge
// beforehand can come too late. The long section a wheel was last scrolling
// is remembered for a moment, and a scroll that ran past its edge is put
// back on the edge; the next swipe then wipes as usual.
let nativeIn = null;
function holdEdge() {
  if (!nativeIn || gliding) return;
  if (performance.now() > nativeIn.until) { nativeIn = null; return; }
  const { page } = nativeIn;
  const y = window.scrollY;
  const edge = y > page.end + 1 && sectionTarget(page.el, 1) !== null ? page.end
    : y < page.top - 1 && sectionTarget(page.el, -1) !== null ? page.top : null;
  if (edge === null) return;
  nativeIn = null;
  holdInstant(); setScroll(edge); releaseInstant();
  easedOff = false;
  usedUp = true;
}

// CSS time in milliseconds. The production build writes 340ms as .34s, and
// reading that as 0.34 made the wipe vanish on the live preview (25 Oct 2026).
function cssMs(value, fallback) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  if (/ms\s*$/i.test(value)) return n;
  if (/s\s*$/i.test(value)) return n * 1000;
  return n;
}

function wipeTo(y) {
  const panel = document.querySelector('.d-wipe');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!panel || reduce) { holdInstant(); setScroll(y); releaseInstant(); return; }
  const ms = cssMs(getComputedStyle(document.documentElement).getPropertyValue('--d-wipe-ms'), 420);
  wiping = true;
  gliding = true;
  panel.classList.remove('is-out', 'is-reset');
  void panel.offsetWidth;
  panel.classList.add('is-in');
  window.setTimeout(() => {
    holdInstant();
    setScroll(y);
    releaseInstant();
    panel.classList.remove('is-in');
    panel.classList.add('is-out');
    window.setTimeout(() => {
      panel.classList.add('is-reset');
      panel.classList.remove('is-out');
      void panel.offsetWidth;
      panel.classList.remove('is-reset');
      wiping = false;
      moved();
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

/** Moves the pinned story one step, or leaves a long section from its edge; true when it took the input. */
function step(dir) {
  const el = pinnedStory();
  if (!el) {
    const page = flatPage();
    return !!page && atEdge(page, dir) && leave(page.el, dir);
  }
  const to = stepTarget(el, dir);
  if (to === null) return leave(el, dir);
  glide(to);
  return true;
}

// The story the last gesture was in. A gesture that has just carried the page
// into a story first settles it exactly on the step showing, so the intro is
// never skipped by the momentum of the scroll that arrived.
let gestureStory = null;

// Trackpads keep sending fading wheel events (momentum) for a second or more
// after the fingers lift. What counts as a new intention is the shape of the
// movement: a wheel notch after a pause, a trackpad swipe whose deltas build
// up over four events, or anything after a real rest. Fading deltas are
// momentum and never move a step. Times come from the event itself (when the
// hardware sent it), so a busy frame that delivers events late does not look
// like a pause.
function readGesture(e) {
  const clock = performance.now();
  const now = e.timeStamp > 0 && e.timeStamp <= clock + 50 ? e.timeStamp : clock;
  const gap = now - lastWheelAt;
  if (gap > IDLE_MS) wheelDeltas.length = 0;
  lastWheelAt = now;
  const a = Math.abs(e.deltaY);
  wheelDeltas.push(a);
  if (wheelDeltas.length > 8) wheelDeltas.shift();
  // After a step, a rise only counts once the swipe that caused it has eased
  // off (fallen below half its peak), so one long push never moves two steps.
  // A new swipe always starts slower than the last one peaked, which eases off.
  if (a > peakSinceStep) peakSinceStep = a;
  if (!easedOff && a < peakSinceStep * 0.5) easedOff = true;
  const n = wheelDeltas.length;
  // A wheel click after a pause. Right after a step it needs a longer pause,
  // so one quick spin of a mouse wheel never moves two steps.
  const notch = gap > IDLE_MS && (e.deltaMode !== 0 || a >= 40) && (easedOff || gap > 400);
  const rested = gap > 600;
  // A coasting trackpad wobbles (5, 4, 5, 6), so a rise must be a clear one:
  // four events that keep growing, by a real amount, to a real speed.
  const [d1, d2, d3, d4] = wheelDeltas.slice(-4).reverse();
  const rising = n >= 4 && d1 >= d2 && d2 >= d3 && d3 >= d4 && d1 >= 6 && d1 - d4 >= Math.max(3, d4 * 0.6);
  const fresh = notch || rested || (easedOff && rising);
  return { now, a, fresh, starts: fresh || gap > IDLE_MS };
}

/** Acts on a fresh gesture: one step, or one wipe (kept for later while the page still moves). */
function take(dir, g) {
  if (!g.fresh || (!gliding && g.now - glideEndedAt <= 60)) return;
  peakSinceStep = g.a;
  easedOff = false;
  usedUp = true;
  if (gliding) queued = dir; else step(dir);
}

// The swipe that moved a step, swept a wipe or reached a long section's edge
// is used up: its momentum never scrolls the page on. A new swipe does.
let usedUp = false;

function onWheel(e) {
  if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
  const g = readGesture(e);
  const dir = e.deltaY > 0 ? 1 : -1;
  const el = pinnedStory();
  if (!el) { gestureStory = null; flatWheel(e, dir, g); return; }
  const entering = el !== gestureStory;
  gestureStory = el;
  if (!entering && stepTarget(el, dir) === null && sectionTarget(el, dir) === null) return; // nothing beyond: scroll on as normal
  e.preventDefault();
  if (entering && Math.abs(nearest(el) - window.scrollY) > 24) { if (!gliding) glide(nearest(el)); return; }
  take(dir, g);
}

function flatWheel(e, dir, g) {
  const page = flatPage();
  if (!page) return;
  if (gliding) { e.preventDefault(); take(dir, g); return; }
  if (usedUp && !g.starts) { e.preventDefault(); return; }
  usedUp = false;
  if (sectionTarget(page.el, dir) === null) return; // the end of Contact: on into the footer as normal
  if (!atEdge(page, dir)) {
    // Free scrolling inside the section, stopped exactly at its edge. The
    // swipe that arrives there is used up, so leaving takes a new one.
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    const edge = dir > 0 ? page.end : page.top;
    if (dir > 0 ? window.scrollY + px > edge : window.scrollY + px < edge) {
      e.preventDefault();
      holdInstant(); setScroll(edge); releaseInstant();
      peakSinceStep = g.a;
      easedOff = false;
      usedUp = true;
      return;
    }
    nativeIn = { page, until: performance.now() + 600 };
    return;
  }
  e.preventDefault();
  take(dir, g);
}

let touchY = null;
let touchX = null;
let touchTaken = false;
let touchEdges = null;
function onTouchStart(e) {
  touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
  touchX = e.touches.length === 1 ? e.touches[0].clientX : null;
  touchTaken = false;
  // A phone's momentum cannot be stopped at an edge, so in a long section only
  // a swipe that starts at its edge leaves it with the wipe.
  const page = touchY === null || pinnedStory() ? null : flatPage();
  touchEdges = page ? { page, down: atEdge(page, 1), up: atEdge(page, -1) } : null;
}
function onTouchMove(e) {
  if (touchY === null) return;
  if (touchTaken) { e.preventDefault(); return; }
  const dy = touchY - e.touches[0].clientY;
  // A carousel story (data-swipe-steps, the Work section) also steps on a
  // sideways swipe: right to left is the next frame, as on any carousel.
  const dx = touchX === null ? 0 : touchX - e.touches[0].clientX;
  if (Math.abs(dx) >= 24 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    const story = pinnedStory();
    if (story && story.hasAttribute('data-swipe-steps') && e.target instanceof Element && story.contains(e.target)) {
      e.preventDefault();
      touchTaken = true;
      gestureStory = story;
      const side = dx > 0 ? 1 : -1;
      if (gliding) queued = side; else step(side);
      return;
    }
  }
  if (Math.abs(dy) < 12) return;
  const dir = dy > 0 ? 1 : -1;
  const el = pinnedStory();
  if (!el) {
    gestureStory = null;
    const edge = touchEdges && (dir > 0 ? touchEdges.down : touchEdges.up);
    if (!edge || sectionTarget(touchEdges.page.el, dir) === null) return;
    e.preventDefault();
    touchTaken = true;
    if (gliding) queued = dir; else leave(touchEdges.page.el, dir);
    return;
  }
  if (gliding) { e.preventDefault(); touchTaken = true; queued = dir; return; }
  const entering = el !== gestureStory;
  gestureStory = el;
  if (!entering && stepTarget(el, dir) === null && sectionTarget(el, dir) === null) { touchY = null; return; } // nothing beyond
  e.preventDefault();
  touchTaken = true;
  if (entering && Math.abs(nearest(el) - window.scrollY) > 24) glide(nearest(el)); else step(dir);
}
function onTouchEnd() { touchY = null; touchX = null; touchTaken = false; touchEdges = null; }

function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
  const sideways = (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && pinnedStory()?.hasAttribute('data-swipe-steps');
  const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey) || (sideways && e.key === 'ArrowRight');
  const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) || (sideways && e.key === 'ArrowLeft');
  if (!down && !up) return;
  const dir = down ? 1 : -1;
  if (gliding) { if (pinnedStory() || flatPage()) { e.preventDefault(); if (!e.repeat) queued = dir; } return; }
  if (step(dir)) { e.preventDefault(); return; }
  // Inside a long section keys scroll as normal, but stop at its edge.
  const page = !pinnedStory() && flatPage();
  if (!page || sectionTarget(page.el, dir) === null) return;
  const move = e.key.startsWith('Arrow') ? 40 : window.innerHeight * 0.875;
  const edge = dir > 0 ? page.end : page.top;
  if (dir > 0 ? window.scrollY + move > edge : window.scrollY - move < edge) { e.preventDefault(); glide(edge); }
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
  // Capture phase: Astro's page router also listens for clicks on links and
  // would treat #work as an ordinary jump before this ran.
  document.addEventListener('click', onGoto, true);
}

// A link that opens a step of another story, such as the hero's results
// strip opening a project in Our work: <a href="/#work" data-goto="work"
// data-goto-step="1">. It goes there behind the blue wipe, like any move
// between sections; without this script the plain link still works. Written
// /#work, not #work: main.js smooth-scrolls every a[href^="#"] itself, and
// that scroll fought the wipe and overshot the project.
function onGoto(e) {
  const link = e.target instanceof Element ? e.target.closest('[data-goto]') : null;
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const el = document.getElementById(link.getAttribute('data-goto') || '');
  if (!el || !stories.has(el)) return;
  e.preventDefault();
  if (gliding) return;
  // data-goto-dir="1" or "-1": the next or previous step, like one scroll.
  const dir = Number(link.getAttribute('data-goto-dir'));
  if (dir) { if (pinnedStory() === el) step(dir > 0 ? 1 : -1); return; }
  const { steps, seg } = measure(el);
  const k = Math.max(0, Math.min(steps, Math.round(Number(link.getAttribute('data-goto-step')) || 0)));
  const top = el.getBoundingClientRect().top + window.scrollY;
  const to = Math.round(top + k * window.innerHeight * seg);
  gestureStory = el;
  // Within the story already showing it glides; from elsewhere it wipes.
  if (pinnedStory() === el) glide(to); else wipeTo(to);
}

export function initStories(root = document) {
  bindStepping();
  root.querySelectorAll(STORY).forEach((el) => {
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
