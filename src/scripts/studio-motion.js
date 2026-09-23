import { mountStoryMotion } from './story-motion.js';

/* Reference: marketinglab.framer.ai.
   Focal sequence: the process joins a row, then real projects stack in native
   scroll flow. Continuity: interrupted disclosures and menus keep their state.
   Feedback: CTA labels roll, hero lines and section contents arrive in sequence.
   Scroll-scrubbed stories replay in both directions; ambient motion pauses offscreen.
   No scroll hijacking, animation library or hidden default content. */
let cleanup = () => {};
let mountedBody;
let sessionMotion;
const ease = 'cubic-bezier(.16, 1, .3, 1)';

function mount(force = false, motionOverride) {
  if (!force && mountedBody === document.body) return;
  cleanup();
  mountedBody = document.body;
  if (!document.body.classList.contains('studio')) return;
  const abort = new AbortController();
  const { signal } = abort;
  // Start motion automatically, independent of the device preference.
  // Only an explicit pause on this website disables decorative motion.
  // Retain that choice across client navigation even when storage is blocked.
  let choice = sessionMotion;
  try {
    const stored = localStorage.getItem('quadem-motion');
    choice = ['full', 'paused'].includes(stored) ? stored : undefined;
  } catch { /* Session-only choice remains available. */ }
  if (motionOverride !== undefined) choice = motionOverride;
  sessionMotion = choice;
  const mode = choice === 'paused' ? 'paused' : 'full';
  const reduced = { matches: mode !== 'full' };
  document.body.dataset.motion = mode;
  if (reduced.matches) document.querySelectorAll('.wizard-step').forEach(step => {
    step.getAnimations().forEach(animation => animation.cancel());
  });
  const control = document.querySelector('[data-motion-control]');
  if (control) {
    control.hidden = false;
    control.disabled = false;
    control.setAttribute('aria-pressed', String(reduced.matches));
    control.querySelector('[data-motion-label]').textContent = mode === 'paused' ? 'Resume motion' : 'Pause motion';
    control.title = mode === 'paused' ? 'Resume decorative motion throughout the website' : 'Pause decorative motion throughout the website';
    control.addEventListener('click', () => {
      const next = reduced.matches ? 'full' : 'paused';
      try { localStorage.setItem('quadem-motion', next); } catch { /* Session-only fallback below. */ }
      mount(true, next);
    }, { signal });
  }
  const animations = new Set();
  const observers = [];
  const cleanups = [];
  const animate = (el, frames, options) => {
    if (!el || reduced.matches || !el.animate) return null;
    const animation = el.animate(frames, { easing: ease, fill: 'none', ...options });
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  };

  document.querySelectorAll('a.btn, a.g-btn, a.gl-nav-cta').forEach(link => {
    if (link.querySelector('.studio-button-label') || !link.textContent.trim()) return;
    const label = document.createElement('span');
    label.className = 'studio-button-label';
    const original = document.createElement('span');
    while (link.firstChild) original.append(link.firstChild);
    const copy = original.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    label.append(original, copy);
    link.append(label);
    link.classList.add('studio-motion-link');
  });

  const homeHero = document.querySelector('.lab-hero');
  if (homeHero) {
    const observer = new IntersectionObserver(entries => {
      document.body.toggleAttribute('data-past-hero', !entries[0].isIntersecting);
    });
    observer.observe(homeHero); observers.push(observer);
    cleanups.push(() => document.body.removeAttribute('data-past-hero'));
  }

  const disclosures = new Map();
  document.querySelectorAll('[data-motion-disclosure], .g-faq details').forEach(details => {
    const summary = details.querySelector(':scope > summary');
    const panel = details.querySelector(':scope > [data-disclosure-panel]') || summary?.nextElementSibling;
    if (!summary || !panel) return;
    let animation = null;
    let panelAnimations = [];
    let expanded = details.open;
    const restore = () => { details.style.removeProperty('height'); details.style.removeProperty('overflow'); };
    const keepHeadingVisible = () => {
      if (!expanded || document.activeElement !== summary) return;
      const clearance = Math.max(24, (document.getElementById('navbar')?.getBoundingClientRect().bottom || 0) + 24);
      const top = summary.getBoundingClientRect().top;
      if (top < clearance) window.scrollBy({ top: top - clearance, behavior: 'instant' });
    };
    const setOpen = (next, immediate = false) => {
      const start = details.getBoundingClientRect().height;
      if (animation) { animation.cancel(); animation = null; }
      panelAnimations.forEach(animation => animation?.cancel());
      panelAnimations = [];
      expanded = next;
      if (next) details.open = true;
      restore();
      if (immediate || reduced.matches) { details.open = next; keepHeadingVisible(); return; }
      if (next) {
        const picture = panel.querySelector('.studio-service-media img, .about-image-wrapper img');
        panelAnimations.push(animate(picture, [{ clipPath: 'inset(0 0 26% 0)', transform: 'scale(1.08)' }, { clipPath: 'inset(0)', transform: 'none' }], { duration: 800 }));
        panel.querySelectorAll('.studio-service-content>div:last-child>*, .about-content-col>*').forEach((item, index) => {
          panelAnimations.push(animate(item, [{ transform: 'translateY(24px)', opacity: .15 }, { transform: 'none', opacity: 1 }], { duration: 650, delay: 80 + Math.min(index * 65, 195), fill: 'backwards' }));
        });
      }
      const border = parseFloat(getComputedStyle(details).borderTopWidth) + parseFloat(getComputedStyle(details).borderBottomWidth);
      const end = next ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + border;
      details.style.overflow = 'clip';
      animation = animate(details, [{ height: `${start}px` }, { height: `${end}px` }], { duration: next ? 380 : 250 });
      if (!animation) { details.open = next; restore(); return; }
      animation.onfinish = () => { details.open = next; animation = null; restore(); keepHeadingVisible(); };
    };
    const controller = { setOpen, isOpen: () => expanded };
    disclosures.set(details, controller);
    summary.addEventListener('click', event => {
      event.preventDefault();
      const next = !expanded;
      const group = details.closest('[data-disclosure-group], .g-faq');
      if (next && group) disclosures.forEach((other, el) => {
        if (el !== details && el.closest('[data-disclosure-group], .g-faq') === group && other.isOpen()) other.setOpen(false);
      });
      setOpen(next);
    }, { signal });
    details.addEventListener('toggle', () => { if (!animation) expanded = details.open; }, { signal });
    cleanups.push(() => { animation?.cancel(); panelAnimations.forEach(animation => animation?.cancel()); details.open = expanded; restore(); });
  });
  const revealHash = () => {
    if (!location.hash) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const detail = target?.closest('details[data-motion-disclosure]');
    if (detail) {
      disclosures.get(detail)?.setOpen(true, true);
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };
  revealHash();
  window.addEventListener('hashchange', revealHash, { signal });

  const menu = document.querySelector('.nav-pages');
  if (menu) {
    let timer;
    const summary = menu.querySelector('summary');
    const panel = menu.querySelector('.nav-pages-menu');
    const clear = () => clearTimeout(timer);
    menu.addEventListener('pointerenter', event => {
      clear();
      if (event.pointerType === 'mouse' && matchMedia('(hover: hover)').matches) timer = setTimeout(() => { menu.open = true; }, 100);
    }, { signal });
    summary?.addEventListener('click', clear, { signal });
    menu.addEventListener('pointerleave', () => {
      clear();
      if (!menu.contains(document.activeElement)) timer = setTimeout(() => { menu.open = false; }, 180);
    }, { signal });
    menu.addEventListener('toggle', () => {
      if (menu.open && panel) animate(panel, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
    }, { signal });
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; }, { signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { clear(); if (menu.open) { menu.open = false; summary?.focus(); } }
    }, { signal });
    menu.addEventListener('focusout', event => { if (!menu.contains(event.relatedTarget)) menu.open = false; }, { signal });
    cleanups.push(clear);
  }

  if (!reduced.matches) {
    // Reference ribbon travels only while visible; preference changes stop it.
    const ribbon = document.querySelector('.lab-service-ribbon');
    if (ribbon) {
      let inView = false;
      const update = () => ribbon.toggleAttribute('data-ribbon-active', inView && !document.hidden);
      const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update(); });
      observer.observe(ribbon); observers.push(observer);
      document.addEventListener('visibilitychange', update, { signal });
      cleanups.push(() => ribbon.removeAttribute('data-ribbon-active'));
    }
    const statement = document.querySelector('[data-scroll-statement]');
    if (statement) {
      const text = statement.textContent.trim();
      const words = text.split(/\s+/).map(word => {
        const span = document.createElement('span'); span.className = 'lab-word'; span.textContent = word;
        return span;
      });
      statement.replaceChildren(...words.flatMap((word, index) => index ? [document.createTextNode(' '), word] : [word]));
      let visible = false, frame = 0;
      const draw = () => {
        frame = 0;
        const rect = statement.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (innerHeight * .85 - rect.top) / (innerHeight * .5)));
        words.forEach((word, index) => word.toggleAttribute('data-read', index / words.length < progress));
      };
      const schedule = () => { if (visible && !frame) frame = requestAnimationFrame(draw); };
      const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); });
      observer.observe(statement); observers.push(observer);
      window.addEventListener('scroll', schedule, { passive: true, signal });
      window.addEventListener('resize', schedule, { passive: true, signal });
      cleanups.push(() => { cancelAnimationFrame(frame); statement.textContent = text; });
    }
    cleanups.push(mountStoryMotion({ signal, animate }));

    // The opening behaves like a physical print: it lifts towards the pointer,
    // then recedes into its paper ground as the next section comes forward.
    // A finite settling loop runs only after input, and stops offscreen.
    const scene = homeHero?.closest('.lab-hero-scene');
    if (scene) {
      let visible = true;
      let frame = 0;
      let lastTime = 0;
      let targetX = 0, targetY = 0, x = 0, y = 0, progress = 0;
      const pointer = matchMedia('(hover: hover) and (pointer: fine)');
      const draw = now => {
        frame = 0;
        if (!visible || document.hidden) return;
        const rect = scene.getBoundingClientRect();
        const nextProgress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height * .75)));
        // Duration follows elapsed time, so a larger display or slower frame
        // rate cannot turn the same gesture into seconds of delayed movement.
        const elapsed = lastTime ? now - lastTime : 1000 / 60;
        lastTime = now;
        x += (targetX - x) * (1 - Math.exp(-elapsed / 110));
        y += (targetY - y) * (1 - Math.exp(-elapsed / 110));
        progress += (nextProgress - progress) * (1 - Math.exp(-elapsed / 85));
        const settling = Math.abs(x - targetX) + Math.abs(y - targetY) + Math.abs(progress - nextProgress) > .002;
        if (!settling) { x = targetX; y = targetY; progress = nextProgress; }
        const tilt = 1 - progress;
        homeHero.style.setProperty('--hero-progress', progress.toFixed(4));
        homeHero.style.setProperty('--hero-rx', `${(-y * 4 * tilt + progress * 8).toFixed(3)}deg`);
        homeHero.style.setProperty('--hero-ry', `${(x * 5 * tilt).toFixed(3)}deg`);
        homeHero.style.setProperty('--hero-lift', `${(-Math.max(Math.abs(x), Math.abs(y)) * 12 * tilt + progress * 65).toFixed(2)}px`);
        homeHero.style.setProperty('--hero-scale', (1 - progress * .17).toFixed(4));
        homeHero.style.setProperty('--hero-image-x', `${(-x * 22).toFixed(2)}px`);
        homeHero.style.setProperty('--hero-image-y', `${(-y * 18 + progress * 65).toFixed(2)}px`);
        if (settling) schedule();
        else lastTime = 0;
      };
      const schedule = () => { if (visible && !document.hidden && !frame) frame = requestAnimationFrame(draw); };
      scene.addEventListener('pointermove', event => {
        if (!pointer.matches || event.pointerType !== 'mouse') return;
        const rect = scene.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        targetY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        schedule();
      }, { passive: true, signal });
      scene.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; schedule(); }, { signal });
      window.addEventListener('scroll', schedule, { passive: true, signal });
      window.addEventListener('resize', schedule, { passive: true, signal });
      const updateAmbient = () => homeHero.toggleAttribute('data-hero-visible', visible && !document.hidden);
      document.addEventListener('visibilitychange', () => { updateAmbient(); schedule(); }, { signal });
      const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        updateAmbient();
        if (visible) schedule();
        else { cancelAnimationFrame(frame); frame = 0; lastTime = 0; targetX = 0; targetY = 0; }
      });
      observer.observe(scene); observers.push(observer);
      homeHero.setAttribute('data-card-motion', '');
      schedule();
      animate(homeHero.querySelector('.lab-hero-image'), [{ scale: '1.22' }, { scale: '1' }], { duration: 2000, easing: 'cubic-bezier(.22,.75,.2,1)' });
      if (homeHero.getBoundingClientRect().top < innerHeight) {
        homeHero.querySelectorAll('h1>span').forEach((line, index) => {
          animate(line, [{ clipPath: 'inset(0 0 100% 0)', translate: `${index ? '10%' : '-10%'} 100px`, rotate: `${index ? 6 : -6}deg` }, { clipPath: 'inset(0)', translate: '0 0', rotate: '0deg' }], { duration: 1650, delay: 150 + index * 250, fill: 'backwards', easing: 'cubic-bezier(.22,.75,.2,1)' });
        });
        homeHero.querySelectorAll('.lab-hero-eyebrow, .lab-hero-intro>*').forEach((item, index) => {
          animate(item, [{ opacity: .15, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 850, delay: 350 + index * 75, fill: 'backwards' });
        });
        homeHero.querySelectorAll('.lab-hero-facts>div').forEach((item, index) => {
          animate(item, [{ opacity: .15, transform: 'translateY(35px)' }, { opacity: 1, transform: 'none' }], { duration: 850, delay: 500 + index * 100, fill: 'backwards' });
        });
      }
      cleanups.push(() => {
        cancelAnimationFrame(frame);
        homeHero.removeAttribute('data-card-motion');
        homeHero.removeAttribute('data-hero-visible');
        ['rx', 'ry', 'lift', 'scale', 'image-x', 'image-y', 'progress'].forEach(name => homeHero.style.removeProperty(`--hero-${name}`));
      });
    }

    const process = document.querySelector('.studio-process-stage');
    if (process) {
      const section = process.closest('.studio-process');
      const heading = section.querySelector('.studio-motion-heading');
      const updateProcess = () => {
        const cardHeight = Math.max(...[...process.children].map(card => card.offsetHeight));
        const headingHeight = heading.offsetHeight;
        const gap = Math.min(64, innerHeight * .05);
        const headingTop = Math.max(24, (innerHeight - cardHeight - headingHeight - gap) / 2);
        const cardTop = headingTop + headingHeight + gap;
        const fits = matchMedia('(min-width: 1200px) and (min-height: 700px)').matches &&
          cardHeight <= innerHeight - cardTop - 24;
        section.style.setProperty('--process-heading-top', `${headingTop}px`);
        process.style.setProperty('--process-card-top', `${cardTop}px`);
        process.toggleAttribute('data-process-active', fits);
      };
      const observer = new ResizeObserver(updateProcess);
      [...process.children].forEach(card => observer.observe(card));
      observer.observe(heading);
      observers.push(observer);
      window.addEventListener('resize', updateProcess, { passive: true, signal });
      updateProcess();
      cleanups.push(() => {
        process.removeAttribute('data-process-active');
        process.style.removeProperty('--process-card-top');
        section.style.removeProperty('--process-heading-top');
      });
      // A short laptop or phone cannot fit a pinned card. Keep the arrival
      // sequence in ordinary flow instead of silently removing all movement.
      const arrival = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (!process.hasAttribute('data-process-active')) {
          const index = [...process.children].indexOf(entry.target);
          animate(entry.target, [{ transform: 'translateY(58px) rotateX(5deg)' }, { transform: 'none' }], { duration: 700, delay: Math.min(index * 60, 180) });
        }
        arrival.unobserve(entry.target);
      }), { threshold: .12 });
      [...process.children].forEach(card => arrival.observe(card)); observers.push(arrival);
    }
    const values = document.querySelector('[data-values-story]');
    if (values) {
      const track = values.querySelector('.lab-values-track');
      let visible = false;
      let frame = 0;
      const draw = () => {
        frame = 0;
        const rect = track.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (innerHeight * .65 - rect.top) / rect.height));
        const cards = [...values.querySelectorAll('.lab-value')];
        const tops = cards.map(card => card.getBoundingClientRect().top);
        values.style.setProperty('--values-progress', String(progress));
        cards.forEach((card, index) => {
          const reveal = Math.max(0, Math.min(1, (innerHeight * .92 - tops[index]) / (innerHeight * .48)));
          card.style.setProperty('--value-reveal', String(reveal));
        });
      };
      const schedule = () => { if (visible && !frame) frame = requestAnimationFrame(draw); };
      const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); });
      observer.observe(values); observers.push(observer);
      window.addEventListener('scroll', schedule, { passive: true, signal });
      window.addEventListener('resize', schedule, { passive: true, signal });
      cleanups.push(() => {
        cancelAnimationFrame(frame); values.style.removeProperty('--values-progress');
        values.querySelectorAll('.lab-value').forEach(card => card.style.removeProperty('--value-reveal'));
      });
    }
    const stack = document.querySelector('[data-work-stack]');
    if (stack) {
      const cards = [...stack.children];
      const library = stack.closest('.studio-project-library');
      const heading = stack.closest('.studio-selected-work')?.querySelector('.studio-motion-heading');
      const filters = library?.querySelector('.studio-project-filters');
      const desktop = matchMedia('(min-width: 1000px) and (min-height: 760px)');
      let visible = false;
      let frame = 0;
      const draw = () => {
        frame = 0;
        const shown = cards.filter(card => card.getClientRects().length);
        const top = library ? Math.max(110, 20 + (filters?.offsetHeight || 0) + 24) :
          Math.max(240, 30 + (heading?.offsetHeight || 190) + 24);
        const fits = desktop.matches && shown.every(card => card.offsetHeight <= innerHeight - top - 24);
        stack.style.setProperty('--work-stack-top', `${top}px`);
        stack.toggleAttribute('data-stack-active', fits);
        if (!fits) { cards.forEach(card => card.style.removeProperty('--stack-scale')); return; }
        const rects = shown.map(card => card.getBoundingClientRect());
        shown.forEach((card, i) => {
          const next = rects[i + 1];
          const progress = next ? Math.max(0, Math.min(1, (rects[i].bottom - next.top) / Math.max(1, rects[i].height))) : 0;
          card.style.setProperty('--stack-scale', String(1 - progress * .09));
        });
      };
      const schedule = () => { if (visible && !frame) frame = requestAnimationFrame(draw); };
      const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { rootMargin: '100px' });
      observer.observe(stack); observers.push(observer);
      const resize = new ResizeObserver(schedule);
      cards.forEach(card => resize.observe(card));
      if (heading) resize.observe(heading);
      if (filters) resize.observe(filters);
      observers.push(resize);
      window.addEventListener('scroll', schedule, { passive: true, signal });
      window.addEventListener('resize', schedule, { passive: true, signal });
      document.addEventListener('quadem:filter-change', schedule, { signal });
      cleanups.push(() => { cancelAnimationFrame(frame); stack.removeAttribute('data-stack-active'); stack.style.removeProperty('--work-stack-top'); cards.forEach(card => card.style.removeProperty('--stack-scale')); });
    }
  }
  cleanup = () => {
    abort.abort();
    animations.forEach(animation => animation.cancel());
    observers.forEach(observer => observer.disconnect());
    cleanups.forEach(fn => fn());
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
else mount();
document.addEventListener('astro:page-load', () => mount());
document.addEventListener('astro:before-swap', () => { cleanup(); mountedBody = null; });
