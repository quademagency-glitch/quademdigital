// Chapter pictures that are two or more chapters away are skipped by the
// browser until they come near.
//
// The home page stories pass the scroll position down as a variable that every
// element in the section inherits, so on every scroll frame the browser
// restyled the whole section: up to 1,150 elements in the problem section,
// most of them screens, cards and phones for chapters nowhere near the screen
// (measured 27 Oct 2026; styling was most of the work of scrolling the page).
// A chapter's pictures are only ever on screen within one chapter of their
// own, so the ones further away get data-d-far, which d-system.css turns into
// content-visibility: hidden. They are styled again one chapter before they
// can appear. Checked by comparing screenshots with and without, through
// every story at laptop and phone size and with motion paused: the same
// picture throughout (a few edge pixels of a half-transparent window differ
// while it opens). About a third fewer elements restyled per scroll frame.
// Only pictures: the chapter text is always rendered, and so is anything a
// chapter shows outside its own chapter (the services toolkit's tiles, on
// the phone's home screen, are left out for that reason).
//
// Pictures are found by their chapter class (dq-k3 is chapter 3). The marks
// change with the chapter, never per frame.
//
// usage: skipFarChapters(section, '.dq-scr, .dq-fly, .dq-fx', 'd-story:chapter')

const chapterOf = (el) => {
  const name = [...el.classList].find((c) => /^d[a-z]{1,3}-k\d+$/.test(c));
  return name ? Number(name.split('-k')[1]) : null;
};

export function skipFarChapters(section, selector, eventName) {
  if (!section || section.__dFar) return;
  section.__dFar = true;
  const blocks = [...section.querySelectorAll(selector)]
    .map((el) => ({ el, k: chapterOf(el) }))
    .filter((block) => block.k !== null);
  const apply = (chapter) => {
    blocks.forEach(({ el, k }) => el.toggleAttribute('data-d-far', Math.abs(k - chapter) >= 2));
  };
  section.addEventListener(eventName, (e) => {
    const { chapter, step } = e.detail || {};
    apply(Number(chapter ?? step ?? 0));
  });
  // Already showing a chapter (the page was set up before this ran)
  const on = section.querySelector('[data-dstep].on');
  apply(on ? Number(on.getAttribute('data-dstep')) : Number(section.dataset.active || 0));
}
