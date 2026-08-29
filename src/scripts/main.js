/* ==========================================================================
   Quadem Digital Enterprise - Main JS
   ========================================================================== */

// Analytics Tracking Helper
// The vendors queue for us: window.dataLayer (gtag) and window.vaq (Vercel) are
// stubbed in BaseLayout's head script, so events fired before the deferred
// analytics bundles land are replayed on load. Do not add a queue here: it would
// sit in front of those two and double-send everything fired before ~3.5s.
window.trackEvent = function(eventName, eventData = {}) {
    if (typeof window.va !== 'undefined') {
        // Vercel's signature is va('event', { name, data }): a single object.
        // This was passing the name as a bare second argument, which made their
        // script throw "Cannot read properties of undefined (reading 'length')"
        // on every tracked event. It surfaced as an uncaught promise rejection
        // rather than a visible break, so GA4 kept working and nothing looked
        // wrong, while Vercel recorded no custom events at all.
        try {
            window.va('event', { name: eventName, data: eventData });
        } catch (e) {
            // Analytics must never be able to break a form submission.
            if (import.meta.env.DEV) console.warn('va event failed:', e);
        }
    }
    if (typeof window.gtag !== 'undefined') {
        window.gtag('event', eventName, eventData);
    }
    if (import.meta.env.DEV) {
        console.log('Event Tracked:', eventName, eventData);
    }
};

/* --------------------------------------------------------------------------
   Delegated conversion tracking

   Registered once at module scope, NOT inside initAll(). initAll() re-runs on
   every astro:after-swap, and module bodies do not, so this binds exactly once
   per full page load and survives every View Transition without a guard. It also
   covers transition:persist nodes (navbar, WhatsApp float) whose listeners would
   otherwise stack.

   Tag any element with data-track="event_name". Extra data-* attributes ride
   along as event params, so data-loc="hero" arrives as { loc: "hero" }.
   -------------------------------------------------------------------------- */
function trackFromElement(el, fallbackName) {
    const { track, ...rest } = el.dataset;
    const name = track || fallbackName;
    if (!name) return;

    // Astro adds data-astro-cid-* for scoped styles (and more attributes in
    // dev), which land in dataset and would otherwise be sent as event
    // parameters on every single event.
    const params = {};
    for (const [key, value] of Object.entries(rest)) {
        if (key.startsWith('astro')) continue;
        params[key] = value;
    }

    window.trackEvent(name, { ...params, page: window.location.pathname });
}

document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    // closest() returns the nearest match only, so nested tagged elements
    // cannot double-fire from a single click.
    const tagged = target.closest('[data-track]');
    if (tagged) {
        trackFromElement(tagged);
        return;
    }

    // Untagged-but-important destinations: infer the event from the href so
    // WhatsApp and Calendly are measured even where markup wasn't updated.
    const link = target.closest('a[href*="wa.me"], a[href*="calendly.com"]');
    if (link) {
        const href = link.getAttribute('href') || '';
        trackFromElement(link, href.includes('wa.me') ? 'whatsapp_click' : 'calendly_click');
    }
});

document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || typeof form.closest !== 'function') return;
    const tagged = form.closest('form[data-track]');
    if (tagged) trackFromElement(tagged);
}, true);

// View Transitions swap the document without a navigation, so GA4 never sees a
// second page_view. gtag('config') already counted the first one.
let isFirstPageLoad = true;
document.addEventListener('astro:page-load', () => {
    if (isFirstPageLoad) {
        isFirstPageLoad = false;
        return;
    }
    window.trackEvent('page_view', { page_path: window.location.pathname });
});

// Re-initialize on View Transition navigation
function initAll() {
    initNavbar();
    initMobileMenu();
    initTypewriter();
    initStatCounters();
    initScrollAnimations();
    initContactForm();
    initNewsletter();
    initSmoothScroll();
    initBackToTop();
    initTestimonialCarousel();
    initFaqAccordion();
    initExitIntent();
    syncThemeIcon();
    initCalculator();
    initFaqSearch();
    initGridFilters();
    initVideoModal();
    initProjectWizard();
    initDynamicPricing();
    initGhanaOnlyLinks();
}

// Run on first load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}

// Re-run after Astro View Transition navigations
document.addEventListener('astro:after-swap', initAll);

// 1. Sticky Navbar & Blur Effect
function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    // Remove old listener first to avoid duplicates
    window._navbarScroll && window.removeEventListener('scroll', window._navbarScroll);
    
    let ticking = false;
    window._navbarScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
                ticking = false;
            });
            ticking = true;
        }
    };
    window.addEventListener('scroll', window._navbarScroll, { passive: true });
}

// 2. Mobile Menu Toggle
function initMobileMenu() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenuDrawer = document.querySelector('.mobile-menu-drawer');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

    function toggleMenu() {
        if (!mobileMenuBtn || !mobileMenuDrawer) return;
        mobileMenuBtn.classList.toggle('active');
        mobileMenuDrawer.classList.toggle('active');
        
        const isExpanded = mobileMenuBtn.classList.contains('active');
        mobileMenuBtn.setAttribute('aria-expanded', isExpanded.toString());
        
        document.body.style.overflow = isExpanded ? 'hidden' : '';
    }

    if (mobileMenuBtn) {
        // Remove old listener
        const newBtn = mobileMenuBtn.cloneNode(true);
        mobileMenuBtn.parentNode.replaceChild(newBtn, mobileMenuBtn);
        newBtn.addEventListener('click', toggleMenu);
    }

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenuDrawer && mobileMenuDrawer.classList.contains('active')) {
                toggleMenu();
            }
        });
    });
}

// 3. Typewriter Effect
function initTypewriter() {
    const typewriterElement = document.getElementById('typewriter');
    if (!typewriterElement || typewriterElement.dataset.initialized) return;
    typewriterElement.dataset.initialized = 'true';

    let phrases = ["build websites", "grow brands", "create content", "run your ads", "design identities"];
    
    if (typewriterElement.dataset.services) {
        try { phrases = JSON.parse(typewriterElement.dataset.services); } catch(e) {}
    }

    let phraseIndex = 0;
    // Start with the first phrase already fully typed (matches server-rendered HTML)
    let charIndex = phrases[0].length;
    let isDeleting = true; // Begin by deleting the pre-populated phrase
    const typingDelay = 100, erasingDelay = 50, newPhraseDelay = 2000;
    
    function type() {
        if (!document.body.contains(typewriterElement)) return;
        const currentPhrase = phrases[phraseIndex];
        
        if (isDeleting) {
            typewriterElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typewriterElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }
        
        let typeSpeed = isDeleting ? erasingDelay : typingDelay;
        
        if (!isDeleting && charIndex === currentPhrase.length) {
            typeSpeed = newPhraseDelay;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typeSpeed = 500;
        }
        
        setTimeout(type, typeSpeed);
    }
    
    // Wait briefly, then start the delete-and-cycle animation
    setTimeout(type, newPhraseDelay);
}

// 4. Animated Stat Counters
function initStatCounters() {
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length === 0) return;
    
    let hasAnimatedStats = false;
    
    const animateStats = () => {
        statNumbers.forEach(stat => {
            const target = +stat.getAttribute('data-target');
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            
            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    stat.textContent = Math.ceil(current) + (target > 100 ? '+' : '');
                    requestAnimationFrame(updateCounter);
                } else {
                    stat.textContent = target + (target > 100 ? '+' : '');
                }
            };
            updateCounter();
        });
    };
    
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasAnimatedStats) {
                animateStats();
                hasAnimatedStats = true;
            }
        });
    }, { threshold: 0.5 });
    
    const statsSection = document.getElementById('stats');
    if (statsSection) statsObserver.observe(statsSection);
}

// 5. Scroll Animations
function initScrollAnimations() {
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        el.classList.remove('is-visible'); // Reset for view transitions
        const rect = el.getBoundingClientRect();
        const alreadyInViewport = rect.top < window.innerHeight && rect.bottom > 0;
        if (alreadyInViewport) {
            // Avoid replaying the fade-in on top of the page's own view transition
            el.classList.add('no-transition', 'is-visible');
            requestAnimationFrame(() => el.classList.remove('no-transition'));
        } else {
            scrollObserver.observe(el);
        }
    });
}

// Email validation (format + common disposable domains)
function isValidEmail(email) {
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    const DISPOSABLE_DOMAINS = new Set([
        'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
        'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'grr.la',
        'sharklasers.com', 'tempmail.com', 'throwaway.email', 'yopmail.com',
        'spam4.me', 'trashmail.com', 'trashmail.me', 'fakeinbox.com', 'getnada.com',
        'maildrop.cc', '10minutemail.com', 'temp-mail.org', 'dispostable.com',
        'nada.email', 'getairmail.com', 'filzmail.com', 'spamgourmet.com',
        'spamgourmet.net', 'spamgourmet.org', 'mailnull.com', 'spamfree24.org',
        'mytrashmail.com', 'throwam.com', 'tempr.email', 'discard.email',
        'mailnesia.com', 'trashmail.at', 'trashmail.io', 'crap.email',
    ]);
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) return { valid: false, reason: 'Please enter a valid email address.' };
    const domain = trimmed.split('@')[1].toLowerCase();
    if (DISPOSABLE_DOMAINS.has(domain)) return { valid: false, reason: 'Disposable email addresses are not allowed.' };
    return { valid: true };
}

/**
 * Show a form result where the person can actually see it.
 *
 * The success and error boxes sit at the TOP of the contact form and the submit
 * button at the bottom. On a phone that puts the confirmation several hundred
 * pixels off-screen: you tap Send, nothing appears to happen, and you either
 * submit again or leave believing it failed. Nothing scrolled to it.
 *
 * They also hid themselves after 5 seconds, so scrolling up to look could find
 * nothing there. A confirmation that a lead was sent should stay put.
 */
function revealFormMessage(el) {
    el.style.display = 'block';
    // Announce it too: a sighted user gets the scroll, a screen reader user
    // gets nothing without this.
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// 6. Contact Form Submission
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm || contactForm.dataset.initialized) return;
    contactForm.dataset.initialized = 'true';

    const formSuccess = document.getElementById('formSuccess');
    const formError = document.getElementById('formError');
    const contactSubmitBtn = document.getElementById('contactSubmitBtn');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (formSuccess) formSuccess.style.display = 'none';
        if (formError) formError.style.display = 'none';

        const emailInput = contactForm.querySelector('input[type="email"]');
        if (emailInput) {
            const check = isValidEmail(emailInput.value);
            if (!check.valid) {
                if (formError) {
                    formError.textContent = check.reason;
                    // Same reason as the submit path: this box is above the
                    // fold of a long form, and a validation message that
                    // vanishes after 5s leaves the visitor stuck with no idea
                    // why nothing happened.
                    revealFormMessage(formError);
                }
                return;
            }
        }

        const originalBtnText = contactSubmitBtn ? contactSubmitBtn.textContent : 'Send Message';
        if (contactSubmitBtn) {
            contactSubmitBtn.textContent = 'Sending...';
            contactSubmitBtn.disabled = true;
            contactSubmitBtn.style.opacity = '0.7';
        }

        const formData = new FormData(contactForm);
        // Read both keys: some forms use a services[] checkbox group, others a
        // single <select name="service">, whose value used to be dropped.
        const services = [...formData.getAll('services[]'), ...formData.getAll('service')]
            .map(String)
            .filter(Boolean);
        const data = {
            // Set by the wizard once it has captured the lead at step 2; the
            // endpoint then patches that record instead of creating a second.
            leadId: contactForm.dataset.leadId || undefined,
            source: formData.get('source'),
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message'),
            budget: formData.get('budget'),
            services,
            // Unticked means the box was never sent at all, which is exactly
            // what "no" should look like. See NewsletterOptIn.astro.
            newsletterOptIn: formData.get('newsletterOptIn') === 'yes',
            metadata: { services, budget: formData.get('budget') },
        };

        try {
            const endpoint = contactForm.getAttribute('action') || '/api/submit-form/';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Form submission failed');

            window.trackEvent('generate_lead', {
                source: data.source || 'unknown',
                services: services.join(','),
                budget: data.budget || undefined,
            });

            if (formSuccess) revealFormMessage(formSuccess);
            contactForm.reset();

        } catch (error) {
            console.error('Form error:', error);
            if (formError) revealFormMessage(formError);
        } finally {
            if (contactSubmitBtn) {
                contactSubmitBtn.textContent = originalBtnText;
                contactSubmitBtn.disabled = false;
                contactSubmitBtn.style.opacity = '1';
            }
        }
    });
}

// 7. Newsletter Submission
function initNewsletter() {
    // querySelectorAll over every variant, not getElementById || querySelector.
    // The footer form's class is .mini-newsletter-form, which the old selector
    // never matched, and on any page without #newsletterForm the function
    // bailed entirely, so the footer form fell through to a native GET on a
    // POST-only route and dropped the subscriber on a 404.
    const forms = document.querySelectorAll(
        '#newsletterForm, .newsletter-form, .mini-newsletter-form'
    );

    forms.forEach((form) => {
        if (form.dataset.initialized) return;
        form.dataset.initialized = 'true';

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = form.querySelector('button');
            const emailInput = form.querySelector('input[type="email"]');
            const originalText = btn ? btn.textContent : 'Subscribe';

            if (!emailInput || !emailInput.value) return;

            const check = isValidEmail(emailInput.value);
            if (!check.valid) {
                emailInput.setCustomValidity(check.reason);
                emailInput.reportValidity();
                setTimeout(() => emailInput.setCustomValidity(''), 3000);
                return;
            }
            emailInput.setCustomValidity('');

            if (btn) { btn.textContent = 'Subscribing...'; btn.disabled = true; btn.style.opacity = '0.7'; }

            try {
                const formAction = form.getAttribute('action') || '/api/newsletter/';
                const response = await fetch(formAction, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });
                if (!response.ok) throw new Error('Subscription failed');

                /*
                  Not "Subscribed" any more, because they are not yet. Nobody
                  joins the list until they click the link in the email, so
                  saying otherwise here sends people away expecting the next
                  newsletter and never getting one.
                */
                if (btn) btn.textContent = '✓ Check your inbox';
                form.reset();
                window.trackEvent('newsletter_subscribe', {
                    location: form.classList.contains('mini-newsletter-form') ? 'footer' : 'page'
                });
                setTimeout(() => { if (btn) btn.textContent = originalText; }, 6000);

            } catch (error) {
                console.error('Newsletter error:', error);
                if (btn) btn.textContent = 'Try Again';
                setTimeout(() => { if (btn) btn.textContent = originalText; }, 3000);
            } finally {
                if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
            }
        });
    });
}

// 8. Smooth scroll
function initSmoothScroll() {
    const navbar = document.getElementById('navbar');
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetHash = this.getAttribute('href');
            if (targetHash.startsWith('#')) {
                e.preventDefault();
                const targetEl = document.querySelector(targetHash);
                if (targetEl) {
                    const navHeight = navbar ? navbar.offsetHeight : 80;
                    const top = targetEl.getBoundingClientRect().top + window.scrollY - navHeight;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            }
        });
    });
}

// 9. Back to top
function initBackToTop() {
    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
        backToTop.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

// 10. Custom Cursor removed for performance
// 11. Testimonial Carousel with Auto-Rotate
function initTestimonialCarousel() {
    const track = document.querySelector('.testimonial-track');
    const dotsContainer = document.querySelector('.carousel-dots');
    const prevBtn = document.querySelector('.carousel-btn.prev');
    const nextBtn = document.querySelector('.carousel-btn.next');
    
    if (!track) return;
    // Without this, every View Transition stacks another 4s autoplay interval
    // on the same track and the carousel accelerates with each navigation.
    if (track.dataset.bound) return;
    track.dataset.bound = 'true';

    const cards = track.querySelectorAll('.testimonial-card');
    if (cards.length === 0) return;

    // Determine cards per view based on screen width
    function getCardsPerView() {
        if (window.innerWidth >= 1024) return 3;
        if (window.innerWidth >= 768) return 2;
        return 1;
    }
    
    let currentIndex = 0;
    let cardsPerView = getCardsPerView();
    let maxIndex = Math.max(0, cards.length - cardsPerView);
    let autoPlayInterval;
    
    function updateCarousel() {
        const cardWidth = 100 / cardsPerView;
        track.style.transform = `translateX(-${currentIndex * cardWidth}%)`;
        
        // Update dots
        if (dotsContainer) {
            dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }
    }
    
    function goToSlide(index) {
        currentIndex = Math.max(0, Math.min(index, maxIndex));
        updateCarousel();
    }
    
    function nextSlide() {
        goToSlide(currentIndex >= maxIndex ? 0 : currentIndex + 1);
    }
    
    function prevSlide() {
        goToSlide(currentIndex <= 0 ? maxIndex : currentIndex - 1);
    }
    
    // Create dots
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        for (let i = 0; i <= maxIndex; i++) {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
            dot.addEventListener('click', () => { goToSlide(i); resetAutoPlay(); });
            dotsContainer.appendChild(dot);
        }
    }
    
    // Arrow controls
    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetAutoPlay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetAutoPlay(); });
    
    // Auto-play
    function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 4000);
    }
    
    function resetAutoPlay() {
        clearInterval(autoPlayInterval);
        startAutoPlay();
    }
    
    startAutoPlay();
    
    // Pause on hover
    track.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    track.addEventListener('mouseleave', startAutoPlay);
    
    // Handle resize
    window.addEventListener('resize', () => {
        cardsPerView = getCardsPerView();
        maxIndex = Math.max(0, cards.length - cardsPerView);
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        updateCarousel();
        
        // Rebuild dots
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            for (let i = 0; i <= maxIndex; i++) {
                const dot = document.createElement('button');
                dot.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
                dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
                dot.addEventListener('click', () => { goToSlide(i); resetAutoPlay(); });
                dotsContainer.appendChild(dot);
            }
        }
    });
}

// 14. FAQ Accordion
function initFaqAccordion() {
    document.querySelectorAll('.faq-question').forEach(btn => {
        // initAll() re-runs on every View Transition; without this guard each
        // navigation stacks another click listener on every question.
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';

        btn.setAttribute('aria-expanded', 'false');

        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const wasActive = item.classList.contains('active');
            // Close all
            document.querySelectorAll('.faq-item').forEach(i => {
                i.classList.remove('active');
                const q = i.querySelector('.faq-question');
                if (q) q.setAttribute('aria-expanded', 'false');
            });
            // Toggle clicked
            if (!wasActive) {
                item.classList.add('active');
                btn.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

// 15. Exit-Intent Popup (shows once per session, desktop only)
function initExitIntent() {
    const popup = document.getElementById('exitPopup');
    if (!popup || sessionStorage.getItem('quadem-exit-shown')) return;
    if (popup.dataset.bound) return;
    popup.dataset.bound = 'true';

    const closePopup = () => {
        popup.classList.remove('active');
        sessionStorage.setItem('quadem-exit-shown', 'true');
    };

    const closeBtn = document.getElementById('exitPopupClose');
    const skipBtn = document.getElementById('exitPopupSkip');
    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (skipBtn) skipBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });

    // Desktop only: arm after a short dwell, then fire on an upward exit.
    if (window.matchMedia('(pointer: fine)').matches) {
        let canShow = false;
        setTimeout(() => { canShow = true; }, 8000);

        // Not { once: true }: that consumed the listener on the FIRST mouseleave
        // of any kind, a sideways exit, or any exit inside the arming window,
        // after which the popup could never show again. Unsubscribe only once
        // it has actually fired.
        const onLeave = (e) => {
            if (e.clientY >= 10 || !canShow) return;
            if (sessionStorage.getItem('quadem-exit-shown')) return;
            popup.classList.add('active');
            sessionStorage.setItem('quadem-exit-shown', 'true');
            document.removeEventListener('mouseleave', onLeave);
        };
        document.addEventListener('mouseleave', onLeave);
    }
}

// 16. Dark/Light Mode Toggle
// Deliberately NOT in initAll(). The toggle lives inside the transition:persist
// navbar, so the element survives View Transitions while initAll re-runs: a
// re-bound listener meant one click ran two handlers (light -> dark -> light)
// and the toggle looked broken. Delegating from document binds exactly once.
function syncThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Mobile browser chrome follows this; it was pinned dark in both themes.
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', isDark ? '#0d0d14' : '#f8f9fc');

    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.textContent = isDark ? '☀️' : '🌙';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    if (!target.closest('#themeToggle')) return;

    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('quadem-theme', next); } catch (err) { /* private mode */ }
    syncThemeIcon();
});

// Astro's swapRootAttributes() wipes every attribute off <html> and re-applies
// only those present on the incoming document. Server-rendered HTML never emits
// data-theme (it is set by the head bootstrap), so without this the attribute is
// destroyed on every client-side navigation and light mode flashes dark.
document.addEventListener('astro:before-swap', (e) => {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) e.newDocument.documentElement.setAttribute('data-theme', theme);
});

// The markup ships the dark glyph; correct it once the stored theme is known.
document.addEventListener('astro:after-swap', syncThemeIcon);

// 17. Project Cost Calculator
function initCalculator() {
    const calcCheckboxes = document.querySelectorAll('.calc-checkbox input');
    const calcRadios = document.querySelectorAll('.calc-radio input');
    const totalDisplay = document.getElementById('calcTotal');
    
    if (!calcCheckboxes.length || !totalDisplay) return;

    function updateTotal() {
        const config = window.pricingConfig || { rate: 1, currency: 'USD', format: (val) => `$${val.toLocaleString()}` };
        
        let baseTotal = 0;
        calcCheckboxes.forEach(cb => {
            if (cb.checked) {
                if (config.currency === 'GHS' && cb.getAttribute('data-ghs')) {
                    baseTotal += parseInt(cb.getAttribute('data-ghs'), 10);
                } else {
                    // For USD and live exchange rates, calculate via the USD base
                    baseTotal += parseInt(cb.value, 10);
                }
            }
        });

        let multiplier = 1;
        const activeRadio = document.querySelector('.calc-radio input:checked');
        if (activeRadio) {
            multiplier = parseFloat(activeRadio.value);
        }

        const finalTotal = baseTotal * multiplier;
        
        let convertedTotal;
        if (config.currency === 'GHS') {
            // Already added exact GHS values, no need to multiply by rate
            convertedTotal = Math.round(finalTotal);
        } else {
            // Convert USD sum via the live exchange rate
            convertedTotal = Math.round(finalTotal * config.rate);
        }
        
        /*
          "from", not a bare number. Every price on the site is a floor that a
          real quote moves, and a calculator that answers "$6,000" reads as a
          promise the rest of the site does not make. The summary line underneath
          already says the scope decides it; this stops the number contradicting
          that line before anyone reaches it.
        */
        totalDisplay.textContent =
            convertedTotal > 0 ? `from ${config.format(convertedTotal)}` : config.format(0);
    }

    function updateLabels() {
        const labels = document.querySelectorAll('.dynamic-calc-label');
        const config = window.pricingConfig;
        if (!config) return;

        /*
          Skip only when the visitor is getting the currency the server already
          rendered, which is USD.

          This used to test `config.rate === 1` and mean "still on the USD
          default". The Ghana config also has rate 1, because cedi prices are
          exact rather than converted, so this returned early for Ghana and the
          calculator kept its dollar labels while the packages beside it showed
          cedis. Two currencies on one page, which is the first thing the global
          spec lists as a problem.
        */
        if (config.currency === 'USD') return;

        labels.forEach(label => {
            const cycle = label.getAttribute('data-cycle') || '';
            
            if (config.currency === 'GHS') {
                const ghs = label.getAttribute('data-ghs');
                if (ghs) {
                    label.textContent = `From ${config.format(parseInt(ghs.replace(/,/g, '')))}${cycle}`;
                }
            } else {
                const usd = label.getAttribute('data-usd');
                if (usd) {
                    const converted = Math.round(parseInt(usd.replace(/,/g, '')) * config.rate);
                    label.textContent = `From ${config.format(converted)}${cycle}`;
                }
            }
        });
    }

    let hasTrackedCalc = false;
    calcCheckboxes.forEach(cb => cb.addEventListener('change', () => {
        updateTotal();
        if (!hasTrackedCalc) {
            window.trackEvent('calculator_interaction');
            hasTrackedCalc = true;
        }
    }));
    calcRadios.forEach(rb => rb.addEventListener('change', () => {
        updateTotal();
        if (!hasTrackedCalc) {
            window.trackEvent('calculator_interaction');
            hasTrackedCalc = true;
        }
    }));

    // Listen for dynamic pricing to finish loading
    window.addEventListener('pricingReady', () => {
        updateLabels();
        updateTotal();
    });

    updateTotal();
}

// 18. FAQ Search
function initFaqSearch() {
    const searchInput = document.getElementById('faqSearchInput');
    const faqItems = document.querySelectorAll('.faq-list .faq-item');
    
    if (!searchInput || !faqItems.length) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question span').textContent.toLowerCase();
            const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
            
            if (question.includes(query) || answer.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// 19. Grid Filters (Projects & Blog)
function initGridFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (!filterBtns.length) return;

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-color)';
            });
            
            btn.classList.add('active');
            btn.style.background = 'rgba(0,174,239,0.1)';
            btn.style.color = 'var(--accent)';

            const filterValue = btn.getAttribute('data-filter');
            
            // Handle project cards
            const projectCards = document.querySelectorAll('.work-card');
            projectCards.forEach(card => {
                const category = card.getAttribute('data-category');
                if (filterValue === 'all' || category === filterValue) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });

            // Handle blog cards
            const blogCards = document.querySelectorAll('.blog-card');
            blogCards.forEach(card => {
                const category = card.getAttribute('data-category');
                if (filterValue === 'all' || category === filterValue) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// 20. Video Modal
function initVideoModal() {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.getElementById('videoModalClose');
    const iframeContainer = document.getElementById('videoIframeContainer');
    const playBtns = document.querySelectorAll('.play-video-btn');

    if (!modal || !playBtns.length) return;
    if (modal.dataset.bound) return;
    modal.dataset.bound = 'true';

    const closeModal = () => {
        modal.classList.remove('active');
        iframeContainer.innerHTML = ''; // Stop video playing
    };

    playBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = btn.getAttribute('data-video-url');
            if (url) {
                // simple YouTube extract for embed
                let embedUrl = url;
                if (url.includes('youtube.com/watch?v=')) {
                    embedUrl = url.replace('watch?v=', 'embed/');
                } else if (url.includes('youtu.be/')) {
                    embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
                }
                
                iframeContainer.innerHTML = `<iframe src="${embedUrl}?autoplay=1" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="width: 100%; height: 60vh; border-radius: 12px;"></iframe>`;
                modal.classList.add('active');
                window.trackEvent('video_testimonial_played', { url: embedUrl });
            }
        });
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// 21. Project Wizard Navigation
function initProjectWizard() {
    const wizardForm = document.querySelector('.wizard-form');
    if (!wizardForm) return;
    // initContactForm() guards the same element via dataset.initialized; this
    // one had no guard, so navigations stacked duplicate step handlers and a
    // single "Next" click could jump two steps.
    if (wizardForm.dataset.wizardBound) return;
    wizardForm.dataset.wizardBound = 'true';

    /*
      The server decides which step opens. Arriving from a service page with
      ?enquiry=<slug> means the first question, "what do you need help with?",
      is already answered, so contact.astro renders step two visible and says so
      here. Starting at 1 regardless would leave this counter disagreeing with
      what is on screen, and the first Next would jump backwards.
    */
    let currentStep = Number(wizardForm.dataset.startStep) || 1;
    const totalSteps = 3;
    
    const steps = [
        document.getElementById('wizardStep1'),
        document.getElementById('wizardStep2'),
        document.getElementById('wizardStep3')
    ];
    
    const indicators = document.querySelectorAll('.step-indicator');
    const progressFill = document.getElementById('wizardProgressFill');
    const nextBtns = document.querySelectorAll('.wizard-next-btn');
    const prevBtns = document.querySelectorAll('.wizard-prev-btn');

    // Sync the progress bar and indicators when the form does not open on step
    // one. The markup already shows the right step; this catches the furniture
    // around it, which is otherwise stuck at 0% until the first click.
    if (currentStep !== 1) requestAnimationFrame(() => updateWizard());

    function updateWizard() {
        // Update Progress Bar
        const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressFill.style.width = `${progressPercentage}%`;

        /*
          Update indicators by class, not by writing colours.

          This used to set '#1a1a24' and rgba(255,255,255,0.5) inline, which are
          dark-mode values, so in light mode the numbers on the steps ahead were
          near-white on a light circle and could not be read. Colours written
          from JavaScript are also invisible to the theme guard, which reads
          stylesheets and markup and not this file.
        */
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index + 1 <= currentStep);
        });

        // Show/Hide steps
        steps.forEach((step, index) => {
            if (index + 1 === currentStep) {
                step.style.display = 'block';
                // Trigger a small animation
                step.style.opacity = '0';
                step.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    step.style.transition = '0.4s ease';
                    step.style.opacity = '1';
                    step.style.transform = 'translateY(0)';
                }, 10);
            } else {
                step.style.display = 'none';
            }
        });
    }

    /*
      Step order is services -> name/email -> budget. The lead is submitted as
      soon as step 2 is valid, and the budget answer patches it afterwards.
      Previously budget came second and nothing was sent until the very end, so
      everyone who hesitated at "what's your budget?" left nothing behind at all.
    */
    let capturedLeadId = null;

    // The Next buttons are type="button", which bypasses native constraint
    // validation entirely, so steps had no validation of any kind and the
    // qualification could be clicked straight through.
    function validateStep(step) {
        const container = steps[step - 1];
        if (!container) return true;

        if (step === 1) {
            const chosen = container.querySelectorAll('input[type="checkbox"]:checked').length;
            if (chosen === 0) {
                const first = container.querySelector('input[type="checkbox"]');
                if (first) {
                    first.setCustomValidity('Pick at least one service.');
                    first.reportValidity();
                    setTimeout(() => first.setCustomValidity(''), 3000);
                }
                return false;
            }
            return true;
        }

        const fields = container.querySelectorAll('input[required], textarea[required]');
        for (const field of fields) {
            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
            if (field.type === 'email') {
                const check = isValidEmail(field.value);
                if (!check.valid) {
                    field.setCustomValidity(check.reason);
                    field.reportValidity();
                    setTimeout(() => field.setCustomValidity(''), 3000);
                    return false;
                }
            }
        }
        return true;
    }

    // Capture the lead the moment we have a usable name and email.
    async function captureLead() {
        if (capturedLeadId) return;
        const fd = new FormData(wizardForm);
        const services = fd.getAll('services[]').map(String).filter(Boolean);
        try {
            const res = await fetch(wizardForm.getAttribute('action') || '/api/submit-form/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    source: fd.get('source') || 'contact-form',
                    name: fd.get('name'),
                    email: fd.get('email'),
                    message: fd.get('message'),
                    services,
                    // The tick box is on the last step and this runs on step 2,
                    // so it is almost always absent here. The final submit
                    // carries it and the endpoint acts on it there.
                    newsletterOptIn: fd.get('newsletterOptIn') === 'yes',
                    metadata: { services, partial: true },
                }),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.leadId) {
                capturedLeadId = data.leadId;
                // Tells initContactForm to enrich rather than create a duplicate.
                wizardForm.dataset.leadId = String(data.leadId);
                window.trackEvent('generate_lead', {
                    source: fd.get('source') || 'contact-form',
                    services: services.join(','),
                    stage: 'partial',
                });
            }
        } catch (err) {
            // Non-fatal: the final submit still creates the lead normally.
            console.error('Early lead capture failed:', err);
        }
    }

    nextBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!validateStep(currentStep)) return;
            if (currentStep === 2) await captureLead();
            if (currentStep < totalSteps) {
                currentStep++;
                updateWizard();
                window.trackEvent('wizard_step_' + currentStep);
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateWizard();
            }
        });
    });

    wizardForm.addEventListener('submit', () => {
        window.trackEvent('wizard_completed');
    });

    // Make radio and checkboxes active visually
    const checkboxes = wizardForm.querySelectorAll('.wizard-checkbox input');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                cb.parentElement.style.background = 'rgba(0,174,239,0.1)';
                cb.parentElement.style.borderColor = 'var(--accent)';
            } else {
                cb.parentElement.style.background = 'rgba(0,0,0,0.2)';
                cb.parentElement.style.borderColor = 'var(--border-color)';
            }
        });
    });

    const radios = wizardForm.querySelectorAll('.wizard-radio input');
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            // reset all
            radios.forEach(r => {
                r.parentElement.style.background = 'rgba(0,0,0,0.2)';
                r.parentElement.style.borderColor = 'var(--border-color)';
            });
            // activate checked
            if (radio.checked) {
                radio.parentElement.style.background = 'rgba(0,174,239,0.1)';
                radio.parentElement.style.borderColor = 'var(--accent)';
            }
        });
    });
}

// 22. Geo-aware pricing
//
// Was: a client call to ipapi.co (free tier ~1k/day) that returned early on any
// non-OK response, so once the quota was hit every Ghanaian visitor silently
// saw dollar prices; followed by a SECOND third-party call to an FX API, so the
// price visibly changed twice while the buyer was reading it. The cedi rate was
// also pinned at 11.49 in the source and went stale on its own.
//
// Now: one same-origin call for the country, and the Ghana price comes from the
// CMS priceGHS field rather than being converted. Two numbers you control, no
// quota, no stale rate, and nothing to translate.
/*
  23. /offers is the Ghana path, and only the Ghana path.

  The discounts there read as value to a buyer in Accra and as risk to one in
  London or Dallas, which is the reason /global exists at all. Rather than
  deleting them, links into /offers are marked data-ghana-only in BaseLayout and
  removed here for a visitor outside Ghana.

  Removed after the lookup rather than hidden before it, because public pages are
  edge-cached for 60 seconds: HTML that varies by country would be cached and
  served to the wrong one. Ghana is the main site's primary audience, so that is
  the reading that never flickers.

  Fails open to showing them, which is the safe direction: a Ghanaian visitor
  with a blocked geo call still sees the offers they are meant to see.
*/
async function initGhanaOnlyLinks() {
    const marked = document.querySelectorAll('[data-ghana-only]');
    if (marked.length === 0) return;

    let country = '';
    try {
        const res = await fetch('/api/geo/', { headers: { Accept: 'application/json' } });
        if (res.ok) country = (await res.json()).country || '';
    } catch (err) {
        return;
    }
    if (!country || country === 'GH') return;

    marked.forEach((el) => el.remove());
}

async function initDynamicPricing() {
    const priceElements = document.querySelectorAll('.dynamic-price');
    if (priceElements.length === 0 && !document.getElementById('calcTotal')) return;

    window.pricingConfig = {
        currency: 'USD',
        rate: 1,
        format: (val) => `$${val.toLocaleString()}`
    };

    const done = () => window.dispatchEvent(new Event('pricingReady'));

    let country = '';
    try {
        const res = await fetch('/api/geo/', { headers: { Accept: 'application/json' } });
        if (res.ok) country = (await res.json()).country || '';
    } catch (err) {
        // Fail closed to USD, which is the safe default for everyone else.
        console.error('Geo lookup failed; showing USD prices.', err);
    }

    /*
      Say which currency this is, once the country is known.

      Revealed rather than server-rendered: the middleware edge-caches public
      pages for 60 seconds, so a label baked into the HTML would be cached and
      served to the wrong country, which is the same trap the geo endpoint's own
      comment describes.
    */
    const notes = document.querySelectorAll('[data-currency-note]');
    const showNote = (text) => {
        notes.forEach((el) => {
            el.textContent = text;
            el.removeAttribute('hidden');
        });
    };

    /*
      Reveal the tier list for this visitor's market.

      Ghana and everyone else are shown different tiers, not the same tiers in a
      different currency, so this swaps whole lists rather than digits. Both are
      in the HTML and one carries `hidden`, for the same reason the currency note
      is: the page is edge-cached for 60 seconds, so the server cannot decide.

      If the market it is asked for is not on the page, it leaves the visible one
      alone. Before the pricing seed runs there is only one list, and hiding it
      would show a stranger an empty pricing section.
    */
    const showMarket = (market) => {
        const groups = document.querySelectorAll('[data-market]');
        if (!document.querySelector(`[data-market="${market}"]`)) return;
        groups.forEach((el) => {
            if (el.getAttribute('data-market') === market) el.removeAttribute('hidden');
            else el.setAttribute('hidden', '');
        });
    };

    if (country !== 'GH') {
        showNote('All prices in USD.');
        showMarket('international');
        done();
        return;
    }

    showNote('All prices in Ghana cedis.');
    showMarket('ghana');

    window.pricingConfig = {
        currency: 'GHS',
        rate: 1,
        format: (val) => `GH\u20b5 ${val.toLocaleString()}`
    };

    priceElements.forEach((el) => {
        const ghs = parseInt(String(el.getAttribute('data-ghs') || '').replace(/,/g, ''), 10);
        const cycle = el.getAttribute('data-cycle') || '';
        // A plan with no priceGHS keeps its USD label rather than showing 0.
        if (Number.isFinite(ghs) && ghs > 0) {
            el.textContent = `GH\u20b5 ${ghs.toLocaleString()}${cycle}`;
        }
    });

    done();
}
