/*
  The phone menu: the button in the site header opens the drawer, Escape and a
  link close it, and Tab stays inside it while it is open.

  Its own module since 25 October 2026 because GlobalLayout now draws the same
  header (src/components/SiteHeader.astro) and needs the same menu, but does
  not load main.js (no exit popup, no WhatsApp float on /global).
*/
export function initMobileMenu() {
    const button = document.querySelector('.mobile-menu-btn');
    const drawer = document.querySelector('.mobile-menu-drawer');
    if (!button || !drawer) return;
    const close = (restoreFocus = false) => {
        button.classList.remove('active');
        drawer.classList.remove('active');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Open navigation');
        drawer.inert = true;
        drawer.removeAttribute('aria-modal');
        document.body.style.overflow = '';
        if (restoreFocus) button.focus();
    };
    close();
    button.onclick = () => {
        if (button.getAttribute('aria-expanded') === 'true') return close(true);
        button.classList.add('active');
        drawer.classList.add('active');
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Close navigation');
        drawer.inert = false;
        drawer.setAttribute('aria-modal', 'true');
        document.body.style.overflow = 'hidden';
        drawer.querySelector('a')?.focus();
    };
    drawer.onclick = (event) => { if (event.target.closest('a')) close(); };
    window._menuKeydown && document.removeEventListener('keydown', window._menuKeydown);
    window._menuKeydown = (event) => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.nav-pages[open]').forEach(menu => { menu.open = false; menu.querySelector('summary')?.focus(); });
            if (button.getAttribute('aria-expanded') === 'true') close(true);
        }
        if (event.key !== 'Tab' || button.getAttribute('aria-expanded') !== 'true') return;
        const focusable = [button, ...drawer.querySelectorAll('a[href]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', window._menuKeydown);
    // A drawer opened on a phone must release its scroll lock when the full
    // navigation takes over. Read the actual CSS state so the two cannot drift.
    window._menuResize && window.removeEventListener('resize', window._menuResize);
    window._menuResize = () => {
        if (getComputedStyle(button).display === 'none') close();
    };
    window.addEventListener('resize', window._menuResize, { passive: true });
}
