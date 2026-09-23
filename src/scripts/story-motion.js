/* Scroll is the timeline: type unfolds, artwork fans out, then copy settles.
   All effects are progressive enhancements. No wheel interception or hidden
   server-rendered content. One frame batches reads before animation writes. */
const clamp = value => Math.max(0, Math.min(1, value));
const layoutTop = element => {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
};

export function mountStoryMotion({ signal, animate }) {
  const records = new Map();
  const visible = new Set();
  const restores = [];
  const ownedAnimations = [];
  const compact = matchMedia('(max-width: 800px)');
  let frame = 0;
  const add = (element, kind, options = {}) => {
    if (records.has(element)) return;
    element.dataset.story = kind;
    const record = { element, kind, ...options };
    records.set(element, record);
    return record;
  };

  // Preserve original text nodes, nested links and emphasis. The masks are
  // presentation only; no duplicated accessible text or removed listeners.
  //
  // These wrappers are custom element names rather than spans on purpose. A
  // heading often already contains a deliberate span, and stylesheets name it
  // loosely: `.studio-expect-grid span` for a number, `h3 a>span` for an arrow.
  // As spans the wrappers answered to those rules too, and one of them,
  // `flex: 0 0 18px`, squeezed every homepage work title to 18px so it read one
  // letter per line. An unknown element is an ordinary inline box that no rule
  // written for real content can reach by accident. Styling is by class, below.
  document.querySelectorAll('main h1, main h2, main h3, .studio-footer-cta h2').forEach(heading => {
    if (heading.closest('.lab-hero, details, [aria-hidden="true"], [data-scroll-statement], .lab-value-card, .studio-process-card')) return;
    if (!heading.textContent.trim() || heading.textContent.length > 360) return;
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim() && !walker.currentNode.parentElement.closest('svg, [aria-hidden="true"]')) nodes.push(walker.currentNode);
    }
    const words = [];
    nodes.forEach(node => {
      const textRun = document.createElement('story-run');
      textRun.className = 'story-text-run';
      const replacements = node.textContent.split(/(\s+)/).filter(Boolean).map(part => {
        if (/^\s+$/.test(part)) return document.createTextNode(part);
        const mask = document.createElement('story-mask');
        mask.className = 'story-word-mask';
        const word = document.createElement('story-word');
        word.className = 'story-word';
        word.textContent = part;
        mask.append(word); words.push(word);
        return mask;
      });
      if (!replacements.length) return;
      replacements.forEach(part => textRun.append(part));
      node.replaceWith(textRun);
      restores.push(() => textRun.replaceWith(node));
    });
    const record = add(heading, 'type', { words });
    // Above-fold titles still get a complete opening sequence on arrival.
    if (record && heading.getBoundingClientRect().top < innerHeight * .78) {
      words.forEach((word, index) => animate(word, [
        { transform: 'translate3d(0,115%,0) rotate(8deg)', opacity: .25 },
        { transform: 'none', opacity: 1 },
      ], { duration: 1150, delay: Math.min(index * 70, 500), fill: 'backwards', easing: 'cubic-bezier(.22,.75,.2,1)' }));
    }
  });

  const surfaces = (selector, kind, frames, stagger = false) => {
    const siblings = new Map();
    document.querySelectorAll(selector).forEach(element => {
      if (records.has(element) || element.closest('details, .lab-hero, [aria-live]')) return;
      const index = siblings.get(element.parentElement) || 0;
      siblings.set(element.parentElement, index + 1);
      const animation = element.animate(frames(index), { duration: 1000, fill: 'both', easing: 'linear' });
      animation.pause(); animation.currentTime = 1000;
      ownedAnimations.push(animation);
      add(element, kind, { animation, stagger: stagger ? Math.min(index * .055, .16) : 0 });
    });
  };

  surfaces('.lab-hero-project', 'fan', index => [
    { transform: `perspective(1000px) translate3d(calc(${1.5 - index} * clamp(40px,4vw,80px)),clamp(80px,10vh,160px),0) rotate(${(index - 1.5) * 10}deg) scale(.78)`, opacity: 1 },
    { transform: 'perspective(1000px) translate3d(0,0,0) rotate(0deg) scale(1)', opacity: 1 },
  ], true);
  // New service stories arrive as composed pairs; the image and its explanation
  // move together, keeping a clear reading order and avoiding detached copy.
  surfaces('.q-service-card', 'card', index => [
    { transform: `perspective(1200px) translate3d(0,70px,0) rotateX(5deg) rotate(${index % 2 ? 1.5 : -1.5}deg) scale(.97)`, opacity: .8 },
    { transform: 'perspective(1200px) translate3d(0,0,0) rotateX(0deg) rotate(0deg) scale(1)', opacity: 1 },
  ], true);
  surfaces('.pricing-card, .pc-card, .g-card, .g-proof-card, .trust-highlight-card, .studio-expect-grid>article, .blog-card, .lab-article, .lab-product, .wd-type-card, .bp-type-card, .vp-type-card, .seo-service-card, .wd-step, .bp-step, .vp-step, .seo-process-step, .offer-card-link, .lab-impact-fact, .lab-impact-promise', 'card', index => [
    { transform: `perspective(1100px) translate3d(0,clamp(72px,10vh,150px),0) rotateX(14deg) rotate(${index % 2 ? 4 : -4}deg) scale(.9)`, opacity: .65 },
    { transform: 'perspective(1100px) translate3d(0,0,0) rotateX(0deg) rotate(0deg) scale(1)', opacity: 1 },
  ], true);
  surfaces('.section-header>p, .studio-motion-heading>p, .lab-origin, .lab-cms-actions, .lab-opportunity>p, .studio-founder-panel>div>p, .studio-page-hero .studio-lede, .studio-work-info>p, .studio-work-info>dl, .studio-work-action, .lab-home-contact .contact-info, .lab-home-contact .contact-form-container, .lab-contact .contact-form-container, .lab-footer-base .footer-col, .studio-footer-cta>p, .studio-footer-cta>.studio-actions, .g-lede, .g-section-lede, .lab-intro-statement>p, .offer-form-section', 'copy', () => [
    { transform: 'translate3d(0,54px,0)', opacity: .6 },
    { transform: 'translate3d(0,0,0)', opacity: 1 },
  ]);
  surfaces('.studio-founder-image, .lab-contact-portrait, .studio-hero-art, .studio-page-hero-media:not([data-hero-art]), .g-hero-portrait, .lab-intro-image', 'image', () => [
    { clipPath: 'inset(12% 14% 12% 14% round 48px)', transform: 'translate3d(0,65px,0) scale(.94)' },
    { clipPath: 'inset(0% 0% 0% 0% round 0px)', transform: 'translate3d(0,0,0) scale(1)' },
  ]);

  // Original service artwork arrives as a raised card, rests beside its title,
  // then recedes as the next section comes into view. The entry phase also
  // handles stacked mobile layouts where the artwork begins below the fold.
  document.querySelectorAll('[data-hero-art]').forEach(element => {
    const animation = element.animate([
      { transform: 'perspective(1200px) translate3d(0,70px,0) rotateX(8deg) rotate(-3deg) scale(.94)', offset: 0 },
      { transform: 'perspective(1200px) translate3d(0,0,0) rotateX(0deg) rotate(0deg) scale(1)', offset: .5 },
      { transform: 'perspective(1200px) translate3d(0,-70px,0) rotateX(3deg) rotate(2deg) scale(.95)', offset: 1 },
    ], { duration: 1000, fill: 'both', easing: 'linear' });
    animation.pause(); animation.currentTime = 500; ownedAnimations.push(animation);
    add(element, 'hero-art', { animation });
    const image = element.querySelector('.studio-page-hero-media-image');
    const bounds = element.getBoundingClientRect();
    if (image && bounds.top < innerHeight * .78 && bounds.bottom > 0) animate(image, [
      { transform: 'translate3d(0,50px,0) scale(.94)', clipPath: 'inset(7% 7% 7% 7% round 36px)' },
      { transform: 'translate3d(0,0,0) scale(1)', clipPath: 'inset(0% 0% 0% 0% round 0px)' },
    ], { duration: 1400, delay: 120, fill: 'backwards', easing: 'cubic-bezier(.22,.75,.2,1)' });
  });

  // Service summaries slide in independently. The disclosure retains its
  // native height, hit area and open/close controller throughout.
  document.querySelectorAll('.lab-service-row').forEach(row => {
    const title = row.querySelector('summary :is(h2,h3)');
    if (!title) return;
    const animation = title.animate([
      { transform: 'translate3d(-65px,0,0)', opacity: .15 },
      { transform: 'translate3d(0,0,0)', opacity: 1 },
    ], { duration: 1000, fill: 'both' });
    animation.pause(); animation.currentTime = 1000; ownedAnimations.push(animation);
    add(row, 'service', { animation });
  });

  // Work artwork opens like a viewfinder while the project remains readable.
  document.querySelectorAll('.studio-work-image img, .lab-process-image').forEach(image => {
    const anchor = image.closest('.studio-work-image, .studio-process-card');
    if (!anchor) return;
    const animation = image.animate([
      { transform: 'scale(1.22)', clipPath: 'inset(0 18% 0 18%)' },
      { transform: 'scale(1)', clipPath: 'inset(0 0% 0 0%)' },
    ], { duration: 1000, fill: 'both' });
    animation.pause(); animation.currentTime = 1000; ownedAnimations.push(animation);
    add(image, 'viewfinder', { animation, anchor });
  });

  const draw = () => {
    frame = 0;
    if (document.hidden) return;
    const viewport = innerHeight;
    const scroll = scrollY;
    // Read all layout before changing any transform. offsetTop ignores the
    // effect on the target itself, preventing animation/measurement feedback.
    const updates = [...visible].map(record => {
      const { element, anchor = element, kind, stagger = 0 } = record;
      const pinned = anchor.closest('[data-stack-active], [data-process-active], .studio-motion-heading');
      const top = pinned && kind === 'type' ? anchor.getBoundingClientRect().top : layoutTop(anchor) - scroll;
      if (kind === 'hero-art') {
        const entry = clamp((viewport * .94 - top) / (viewport * .5));
        const exit = clamp((Math.min(120, viewport * .15) - top) / Math.max(400, element.offsetHeight * .7));
        return { record, progress: entry < 1 ? entry * .5 : .5 + exit * .5 };
      }
      const isSurface = ['fan', 'card', 'image'].includes(kind);
      const range = viewport * (kind === 'viewfinder' ? .55 : isSurface ? (compact.matches ? .52 : .72) : .48);
      const progress = element.contains(document.activeElement) ? 1 : clamp((viewport * .96 - top) / range - stagger);
      return { record, progress };
    });
    updates.forEach(({ record, progress }) => {
      const { element, words, animation } = record;
      // Smooth ease-out without a timer: reversing scroll reverses the story.
      const eased = progress * progress * (3 - 2 * progress);
      if (words) words.forEach((word, index) => {
        const p = clamp((progress - index / Math.max(1, words.length - 1) * .32) / .68);
        word.style.setProperty('--word-reveal', (1 - Math.pow(1 - p, 2)).toFixed(4));
      });
      if (animation) animation.currentTime = eased * 1000;
      element.dataset.storyState = progress >= 1 ? 'settled' : 'moving';
    });
  };
  const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const record = records.get(entry.target);
      if (entry.isIntersecting) visible.add(record);
      else {
        visible.delete(record);
        // A jump, find-in-page or keyboard navigation can skip the timeline.
        // Anything above the viewport must always finish fully visible.
        if (entry.boundingClientRect.top < 0) {
          if (record.animation) record.animation.currentTime = 1000;
          record.words?.forEach(word => word.style.setProperty('--word-reveal', '1'));
        }
      }
    });
    schedule();
  }, { rootMargin: '160px 0px 160px 0px' });
  records.forEach(record => observer.observe(record.element));
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', schedule, { passive: true, signal });
  document.addEventListener('visibilitychange', schedule, { signal });
  document.addEventListener('focusin', schedule, { signal });
  document.addEventListener('toggle', schedule, { capture: true, signal });
  document.addEventListener('quadem:filter-change', schedule, { signal });
  // Covers CMS images and disclosure height changes without a polling loop.
  const resize = new ResizeObserver(schedule);
  const main = document.querySelector('main');
  if (main) resize.observe(main);
  schedule();
  return () => {
    cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    ownedAnimations.forEach(animation => animation.cancel());
    records.forEach(({ element }) => { delete element.dataset.story; delete element.dataset.storyState; });
    restores.forEach(restore => restore());
  };
}
