/* ==========================================================================
   Quadem Digital Enterprise - Main JS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sticky Navbar & Blur Effect
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenuDrawer = document.querySelector('.mobile-menu-drawer');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

    function toggleMenu() {
        mobileMenuBtn.classList.toggle('active');
        mobileMenuDrawer.classList.toggle('active');
        
        // Prevent body scroll when menu is open
        if (mobileMenuDrawer.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    mobileMenuBtn.addEventListener('click', toggleMenu);

    // Close menu when clicking a link
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenuDrawer.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    // 3. Typewriter Effect
    const phrases = [
        "build websites",
        "grow brands",
        "create content",
        "run your ads",
        "design identities"
    ];
    
    const typewriterElement = document.getElementById('typewriter');
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingDelay = 100;
    const erasingDelay = 50;
    const newPhraseDelay = 2000;
    
    function type() {
        if (!typewriterElement) return;

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
    
    if (typewriterElement) {
        setTimeout(type, newPhraseDelay);
    }

    // 4. Animated Stat Counters
    const statNumbers = document.querySelectorAll('.stat-number');
    let hasAnimatedStats = false;
    
    const animateStats = () => {
        statNumbers.forEach(stat => {
            const target = +stat.getAttribute('data-target');
            const duration = 2000; // 2 seconds
            const increment = target / (duration / 16); // 60 FPS
            
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
    if (statsSection) {
        statsObserver.observe(statsSection);
    }

    // 5. Scroll Animations
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once animated
                scrollObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.animate-on-scroll').forEach(element => {
        scrollObserver.observe(element);
    });

    // 6. Form Submission
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.getElementById('formSuccess');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            formSuccess.style.display = 'block';
            contactForm.reset();
            setTimeout(() => {
                formSuccess.style.display = 'none';
            }, 5000);
        });
    }

    // 7. Newsletter Submission
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = newsletterForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Subscribed!';
            newsletterForm.reset();
            setTimeout(() => {
                btn.textContent = originalText;
            }, 3000);
        });
    }
});
