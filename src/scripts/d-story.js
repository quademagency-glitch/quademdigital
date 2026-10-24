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
    stories.forEach((el) => { if (el.isConnected) update(el); else stories.delete(el); });
  });
}

function jump(el, k, offset) {
  const { seg } = measure(el);
  const unit = window.innerHeight * seg;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: top + (k === 0 ? 0 : (k + offset) * unit) + 2, behavior: reduce ? 'auto' : 'smooth' });
}

export function initStories(root = document) {
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
