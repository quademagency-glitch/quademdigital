/**
 * Choosing which video file to actually fetch.
 *
 * This exists as a module rather than inline script because two places need
 * the exact same answer: the shared <Video> component, and the homepage hero
 * carousel, which has its own hand-tuned idea of when a slide should load and
 * must not have a second mechanism loading things behind its back.
 *
 * The reason any of this is in JavaScript at all: the `media` attribute on
 * <source> is only honoured inside <picture>. Inside <video> every browser
 * ignores it, so there is no markup that says "the small one on a phone".
 */

export const NARROW = '(max-width: 640px)';
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches;

type Source = { src: string; type: string };

/**
 * Give a <video> its sources and start loading. Idempotent: calling it twice
 * on the same element does nothing the second time, which is what lets the
 * carousel and an observer both be safe to fire.
 */
export const attachVideoSources = (video: HTMLVideoElement): void => {
  if (video.dataset.attached) return;
  video.dataset.attached = 'true';

  const mobile = video.dataset.mobile;
  if (mobile && window.matchMedia(NARROW).matches) {
    // One file, chosen here, rather than a list the browser picks from with
    // no idea how wide this element is.
    video.src = mobile;
  } else {
    let sources: Source[] = [];
    try {
      sources = JSON.parse(video.dataset.sources || '[]');
    } catch {
      sources = [];
    }
    if (!sources.length) return;
    for (const s of sources) {
      const el = document.createElement('source');
      el.src = s.src;
      el.type = s.type;
      video.appendChild(el);
    }
  }

  video.load();
};

/**
 * Start a silent decorative loop. Separate from attaching because the hero
 * carousel attaches a slide well before that slide is the one on screen.
 */
export const playSilently = (video: HTMLVideoElement): void => {
  // A rejected play() is not a failure worth reporting: a backgrounded tab or
  // an OS-level block leaves the poster showing, which is a fine outcome.
  video.play().catch(() => {});
};
