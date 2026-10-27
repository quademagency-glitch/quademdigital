/*
  The site header: its scroll state (the compact glass bar once the page
  moves) and the phone menu (the button opens the drawer, Escape and a link
  close it, and Tab stays inside it while it is open).

  Its own module since 25 October 2026 because GlobalLayout draws the same
  header (src/components/SiteHeader.astro) and needs the same behaviour, but
  does not load main.js (no exit popup, no WhatsApp float on /global).
*/
export function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    // Remove old listener first to avoid duplicates
    window._navbarScroll && window.removeEventListener('scroll', window._navbarScroll);
    
    // The header stays on screen. On a page built from the new sections (the
    // home page, the check-up page) it takes the colour of the section under
    // it: white words and a navy bar over the dark ones (.d-dark), dark words
    // and a paper bar over the light ones. Read from what is actually below
    // the bar, so a section that changes ground never needs a list updated.
    const themed = !!document.querySelector('.d-dark, .d-light');
    const tone = () => {
        if (!themed) return;
        const y = navbar.getBoundingClientRect().bottom + 1;
        const under = document.elementFromPoint(window.innerWidth / 2, y);
        const ground = under && under.closest('.d-dark, .d-light');
        navbar.classList.toggle('on-dark', !!ground && ground.classList.contains('d-dark'));
    };
    let ticking = false;
    window._navbarScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                // toggle with a force writes only when the state changes; add()
                // rewrote the class on every scroll frame, and the browser
                // restyled the whole header each time (27 Oct 2026).
                navbar.classList.toggle('scrolled', window.scrollY > 50);
                tone();
                ticking = false;
            });
            ticking = true;
        }
    };
    window.addEventListener('scroll', window._navbarScroll, { passive: true });
    window._navbarScroll();
}

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
