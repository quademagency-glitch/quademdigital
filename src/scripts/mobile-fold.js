/*
  On a phone, a price card shows its first three features and a button for
  the rest (20 October 2026). Six cards with every feature open came to about
  four thousand pixels on the home page, so the prices further down were never
  reached.

  The folding itself is CSS in src/styles/mobile.css, under the same 800px
  breakpoint, keyed on data-folded. This script only marks the lists and adds
  the button, so without it every feature shows, and on a wider screen the
  button is hidden and nothing is folded.
*/

const LISTS = 'ul.tier-features, ul.pc-features';
const SHOWN = 3;

function fold(root = document) {
  root.querySelectorAll(LISTS).forEach((list) => {
    if (list.hasAttribute('data-fold')) return;
    const count = list.children.length;
    if (count <= SHOWN + 1) return; // one hidden line is not worth a button
    list.setAttribute('data-fold', '');
    list.setAttribute('data-folded', '');
    if (!list.id) list.id = `features-${Math.random().toString(36).slice(2, 9)}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'q-fold-toggle';
    button.setAttribute('aria-controls', list.id);
    button.setAttribute('aria-expanded', 'false');
    const more = `Show all ${count} included`;
    button.textContent = more;
    button.addEventListener('click', () => {
      const open = list.hasAttribute('data-folded');
      list.toggleAttribute('data-folded', !open);
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? 'Show less' : more;
    });
    list.after(button);
  });
}

fold();
document.addEventListener('astro:page-load', () => fold());
