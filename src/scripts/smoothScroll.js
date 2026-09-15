/**
 * Smooth scrolling, the way the reference page does it.
 *
 * WHY THIS EXISTS
 *
 * Measuring fluexa's page turned up something no amount of copying individual
 * effects would have reached: it runs Lenis, a smooth scroll library, on top of
 * GSAP and Webflow. Every effect on that page is therefore playing against an
 * interpolated scroll position rather than the browser's raw one, which is a
 * large part of why it feels considered and ours felt abrupt. Copying their
 * transforms without this was copying the choreography and leaving out the
 * music.
 *
 * Lenis is MIT licensed and bundled with the site, not fetched from anywhere,
 * so it satisfies the content security policy that refuses off-site scripts.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * - It does not run when the visitor asks for reduced motion. Taking over the
 *   scroll is exactly the kind of thing that setting exists to refuse.
 * - It does not run on touch. A phone's scroll is already smooth and its
 *   momentum is the operating system's job; overriding it makes a page feel
 *   laggy rather than expensive, and most of this site's traffic is on a phone.
 * - It does not transform the page. Lenis interpolates the real scroll position
 *   instead, which is what keeps `position: sticky`, scroll driven animations
 *   and anchor links all working normally underneath it.
 */
import Lenis from 'lenis';

let instance = null;
let frame = null;

const reduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Coarse pointer means a finger. Leave those alone. */
const touch = () =>
  window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export function startSmoothScroll() {
  if (instance || reduced() || touch()) return;

  instance = new Lenis({
    /*
       1.05s to settle. Lenis defaults to 1.2, which on a 13,000px page reads as
       the scroll lagging behind the wheel rather than easing with it.
    */
    duration: 1.05,
    smoothWheel: true,
    /* The operating system's, on the devices that have one. */
    syncTouch: false,
    wheelMultiplier: 1,
  });

  const raf = (time) => {
    instance.raf(time);
    frame = requestAnimationFrame(raf);
  };
  frame = requestAnimationFrame(raf);
}

export function stopSmoothScroll() {
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  if (instance) instance.destroy();
  instance = null;
}

/*
  Bound once from the module body. View Transitions swap the document without
  reloading it, and a listener added inside an init function would stack up one
  more copy of itself on every navigation.
*/
if (typeof window !== 'undefined') {
  startSmoothScroll();

  /* A swap replaces the scrolling element, so the instance has to be rebuilt. */
  document.addEventListener('astro:after-swap', () => {
    stopSmoothScroll();
    startSmoothScroll();
  });

  /* Someone turning reduced motion on mid-visit should be obeyed at once. */
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onChange = () => (mq.matches ? stopSmoothScroll() : startSmoothScroll());
  if (mq.addEventListener) mq.addEventListener('change', onChange);
}
