/* ==========================================================================
   Quadem Digital Enterprise - Main JS
   ========================================================================== */

// Analytics Tracking Helper
// The vendors queue for us: window.dataLayer (gtag) and window.vaq (Vercel) are
// stubbed in BaseLayout's head script, so events fired before the deferred
// analytics bundles land are replayed on load. Do not add a queue here — it would
// sit in front of those two and double-send everything fired before ~3.5s.
window.trackEvent = function(eventName, eventData = {}) {
    if (typeof window.va !== 'undefined') {
        window.va('event', eventName, eventData);
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
   every astro:after-swap, and module bodies do not — so this binds exactly once
   per full page load and survives every View Transition without a guard. It also
   covers transition:persist nodes (navbar, WhatsApp float) whose listeners would
   otherwise stack.

   Tag any element with data-track="event_name". Extra data-* attributes ride
   along as event params, so data-loc="hero" arrives as { loc: "hero" }.
   -------------------------------------------------------------------------- */
function trackFromElement(el, fallbackName) {
    const { track, ...params } = el.dataset;
    const name = track || fallbackName;
    if (!name) return;
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
    initLoadingScreen();
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
    initParallax();
    initFaqAccordion();
    initExitIntent();
    syncThemeIcon();
    initCalculator();
    initFaqSearch();
    initGridFilters();
    initVideoModal();
    initProjectWizard();
    initDynamicPricing();
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
                    formError.style.display = 'block';
                    setTimeout(() => { formError.style.display = 'none'; }, 5000);
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
        const services = formData.getAll('services[]');
        const data = {
            source: formData.get('source'),
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message'),
            budget: formData.get('budget'),
            services,
            metadata: { services, budget: formData.get('budget') },
        };

        try {
            const formspreeEndpoint = contactForm.getAttribute('action');

            if (formspreeEndpoint) {
                const response = await fetch(formspreeEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error('Form submission failed');
            }
            
            if (formSuccess) formSuccess.style.display = 'block';
            contactForm.reset();
            setTimeout(() => { if (formSuccess) formSuccess.style.display = 'none'; }, 5000);
            
        } catch (error) {
            console.error('Form error:', error);
            if (formError) formError.style.display = 'block';
            setTimeout(() => { if (formError) formError.style.display = 'none'; }, 5000);
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
    const newsletterForm = document.getElementById('newsletterForm') || document.querySelector('.newsletter-form');
    if (!newsletterForm || newsletterForm.dataset.initialized) return;
    newsletterForm.dataset.initialized = 'true';

    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = newsletterForm.querySelector('button');
        const emailInput = newsletterForm.querySelector('input[type="email"]');
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
            const formAction = newsletterForm.getAttribute('action');
            if (formAction) {
                const response = await fetch(formAction, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });
                if (!response.ok) throw new Error('Subscription failed');
            }
            
            if (btn) btn.textContent = '✓ Subscribed!';
            newsletterForm.reset();
            setTimeout(() => { if (btn) btn.textContent = originalText; }, 3000);
            
        } catch (error) {
            console.error('Newsletter error:', error);
            if (btn) btn.textContent = 'Try Again';
            setTimeout(() => { if (btn) btn.textContent = originalText; }, 3000);
        } finally {
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
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

// 12. Loading Screen (first visit per session only)
function dismissLoader(loader) {
    loader.classList.add('loaded');
    document.body.classList.add('loader-done');
    document.dispatchEvent(new CustomEvent('quadem:loaderdone'));
}

function initLoadingScreen() {
    const loader = document.getElementById('loadingScreen');
    if (!loader) {
        // No splash on this page render — let hero animations run immediately.
        document.body.classList.add('loader-done');
        document.dispatchEvent(new CustomEvent('quadem:loaderdone'));
        return;
    }

    // Only show on first visit in this session
    if (sessionStorage.getItem('quadem-loaded')) {
        dismissLoader(loader);
        return;
    }

    // Dismiss after animation completes (~1.5s), then let hero content animate in
    setTimeout(() => {
        dismissLoader(loader);
        sessionStorage.setItem('quadem-loaded', 'true');
    }, 1800);
}

// 13. Parallax Scroll for floating orbs
function initParallax() {
    const orbs = document.querySelectorAll('.parallax-orb[data-parallax-speed]');
    if (orbs.length === 0) return;
    
    // Remove old listener
    window._parallaxScroll && window.removeEventListener('scroll', window._parallaxScroll);
    
    window._parallaxScroll = () => {
        const scrollY = window.scrollY;
        orbs.forEach(orb => {
            const speed = parseFloat(orb.dataset.parallaxSpeed) || 0.03;
            orb.style.transform = `translateY(${scrollY * speed * -1}px)`;
        });
    };
    
    window.addEventListener('scroll', window._parallaxScroll, { passive: true });
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
        // of any kind — a sideways exit, or any exit inside the arming window —
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
// navbar, so the element survives View Transitions while initAll re-runs — a
// re-bound listener meant one click ran two handlers (light -> dark -> light)
// and the toggle looked broken. Delegating from document binds exactly once.
function syncThemeIcon() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
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
        
        totalDisplay.textContent = convertedTotal > 0 ? config.format(convertedTotal) : config.format(0);
    }

    function updateLabels() {
        const labels = document.querySelectorAll('.dynamic-calc-label');
        const config = window.pricingConfig;
        if (!config || config.rate === 1) return; // Default is USD

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

    let currentStep = 1;
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

    function updateWizard() {
        // Update Progress Bar
        const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressFill.style.width = `${progressPercentage}%`;

        // Update indicators
        indicators.forEach((indicator, index) => {
            const stepNum = index + 1;
            if (stepNum <= currentStep) {
                indicator.style.background = 'var(--accent)';
                indicator.style.color = 'white';
                indicator.style.border = 'none';
            } else {
                indicator.style.background = '#1a1a24';
                indicator.style.color = 'rgba(255,255,255,0.5)';
                indicator.style.border = '1px solid rgba(255,255,255,0.2)';
            }
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

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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

// 22. Dynamic Geolocation Pricing
async function initDynamicPricing() {
    const priceElements = document.querySelectorAll('.dynamic-price');
    const isPricingOrCalcPage = priceElements.length > 0 || document.getElementById('calcTotal');
    if (!isPricingOrCalcPage) return;

    window.pricingConfig = {
        currency: 'USD',
        rate: 1,
        format: (val) => `$${val.toLocaleString()}`
    };

    try {
        const geoRes = await fetch('https://ipapi.co/json/');
        if (!geoRes.ok) return;
        const geoData = await geoRes.json();
        
        const currency = geoData.currency;
        const country = geoData.country;

        // If in Ghana, use the fixed GHS price config
        if (country === 'GH' || currency === 'GHS') {
            window.pricingConfig = {
                currency: 'GHS',
                rate: 11.49,
                format: (val) => `GH₵ ${val.toLocaleString()}`
            };

            priceElements.forEach(el => {
                const ghs = el.getAttribute('data-ghs');
                const cycle = el.getAttribute('data-cycle') || '';
                if (ghs && parseInt(ghs.replace(/,/g, '')) > 0) {
                    el.textContent = `GH₵ ${parseInt(ghs.replace(/,/g, '')).toLocaleString()}${cycle}`;
                }
            });
            window.dispatchEvent(new Event('pricingReady'));
            return;
        }

        // If not in US and not in Ghana, fetch live exchange rates and convert
        if (currency && currency !== 'USD') {
            const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
            if (!rateRes.ok) return;
            const rateData = await rateRes.json();
            const rate = rateData.rates[currency];

            if (rate) {
                const formatter = new Intl.NumberFormat(geoData.languages?.split(',')[0] || 'en-US', {
                    style: 'currency',
                    currency: currency,
                    maximumFractionDigits: 0
                });

                window.pricingConfig = {
                    currency: currency,
                    rate: rate,
                    format: (val) => formatter.format(val)
                };

                priceElements.forEach(el => {
                    const usd = el.getAttribute('data-usd');
                    const cycle = el.getAttribute('data-cycle') || '';
                    if (usd && parseInt(usd.replace(/,/g, '')) > 0) {
                        const converted = Math.round(parseInt(usd.replace(/,/g, '')) * rate);
                        el.textContent = `${formatter.format(converted)}${cycle}`;
                    }
                });
            }
        }
    } catch (e) {
        console.error("Pricing localization failed. Falling back to USD.", e);
    } finally {
        // Always dispatch so calculator can render fallback USD if needed
        window.dispatchEvent(new Event('pricingReady'));
    }
}
