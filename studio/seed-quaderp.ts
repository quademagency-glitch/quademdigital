import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function seedQuadERP() {
  console.log('🚀 Seeding QuadERP Landing Page document...')

  await client.createOrReplace({
    _id: 'quaderpPage',
    _type: 'quaderpPage',

    // ===== HERO =====
    heroBadge: '🚀 Introducing QuadERP',
    heroTitle: 'Take Control of Your',
    heroTitleGradient: 'Store Operations',
    heroSubtitle: 'Real-time sales tracking, smart inventory management, staff oversight, and theft prevention — all in one powerful platform built for modern retail.',
    trustBadges: ['No credit card required', '14-day free trial', 'Setup in under 5 minutes'],

    // ===== FEATURES =====
    featuresHeading: 'Everything You Need to Run Your Store',
    featuresSubtitle: 'Powerful tools designed for retail businesses of every size — from single shops to multi-location chains.',
    features: [
      {
        _key: 'feat-1',
        title: 'Sales Dashboard',
        description: 'Track revenue, transactions, average order value, and weekly trends with real-time visual analytics.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
      },
      {
        _key: 'feat-2',
        title: 'Sales POS',
        description: 'A fast, intuitive point-of-sale with product search, cart management, and multi-payment support.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      },
      {
        _key: 'feat-3',
        title: 'Inventory Management',
        description: 'Monitor stock levels with color-coded health indicators, SKU tracking, and automatic low-stock alerts.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2H9z"/><path d="M3 7v10a2 2 0 0 0 2 2h6"/><line x1="12" y1="11" x2="16" y2="11"/><line x1="12" y1="15" x2="16" y2="15"/></svg>',
      },
      {
        _key: 'feat-4',
        title: 'Loss Prevention Alerts',
        description: 'Track voids, suspicious patterns, shrinkage, stock discrepancies, and after-hours activity in real time.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      },
      {
        _key: 'feat-5',
        title: 'CRM & Team Management',
        description: 'Manage customers, staff roles and permissions, and track team performance across all locations.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      },
      {
        _key: 'feat-6',
        title: 'Accounting & Invoicing',
        description: 'Generate invoices, reconcile payments, and keep your books clean with built-in accounting tools.',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      },
    ],

    // ===== SHOWCASE =====
    showcaseHeading: 'See QuadERP in Action',
    showcaseItems: [
      {
        _key: 'show-1',
        label: 'Sales Dashboard',
        heading: 'Know Your Numbers',
        headingGradient: 'In Real Time',
        description: 'Get a bird\'s-eye view of your entire business. Revenue, top products, staff performance — updated live as every sale happens.',
        bulletPoints: ['Live revenue & profit tracking', 'Top-selling product rankings', 'Staff performance metrics', 'Weekly & monthly trend charts'],
      },
      {
        _key: 'show-2',
        label: 'Inventory Management',
        heading: 'Never Run',
        headingGradient: 'Out of Stock',
        description: 'Color-coded health indicators show exactly which products need attention. Set reorder alerts and track every unit across locations.',
        bulletPoints: ['Color-coded stock health (Green/Yellow/Red)', 'Automatic low-stock alerts', 'SKU & barcode tracking', 'Multi-location inventory sync'],
      },
      {
        _key: 'show-3',
        label: 'Point of Sale',
        heading: 'Fast, Intuitive',
        headingGradient: 'Checkout',
        description: 'A POS designed for speed. Search products, manage the cart, apply discounts, split payments — all in a few taps.',
        bulletPoints: ['Quick product search & barcode scan', 'Cart with quantity & discount controls', 'Multi-payment: Cash, Card, Mobile Money', 'Instant receipt generation'],
      },
    ],

    // ===== PRICING =====
    pricingHeading: 'Simple, Transparent Pricing',
    pricingSubtitle: 'Start free. Scale as you grow. No hidden fees, ever.',
    pricingPlans: [
      {
        _key: 'plan-1',
        name: 'Starter',
        price: '$29',
        period: '/mo',
        description: 'Perfect for small retail stores getting started with digital management.',
        features: ['1 Store Location', 'Up to 500 Products', 'Basic Sales Dashboard', 'Inventory Tracking', '2 Staff Accounts', 'Email Support'],
        isPopular: false,
        buttonText: 'Get Started',
      },
      {
        _key: 'plan-2',
        name: 'Growth',
        price: '$79',
        period: '/mo',
        description: 'The ideal plan for growing businesses with multiple staff and advanced needs.',
        features: ['Up to 3 Locations', 'Unlimited Products', 'Advanced Analytics', 'Theft & Loss Alerts', '10 Staff Accounts', 'Priority Support', 'Custom Reports'],
        isPopular: true,
        buttonText: 'Get Started',
      },
      {
        _key: 'plan-3',
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'Tailored solutions for large retail chains and franchise operations.',
        features: ['Unlimited Locations', 'Unlimited Products', 'AI-Powered Insights', 'Advanced Security', 'Unlimited Staff', 'Dedicated Account Manager', 'API Access', 'White-label Option'],
        isPopular: false,
        buttonText: 'Contact Sales',
      },
    ],
    pricingNote: '🔒 All plans include a 14-day free trial. Prices are placeholder and subject to change.',

    // ===== CONTACT =====
    contactHeading: 'Get Started With QuadERP',
    contactSubtitle: "Tell us about your business and we'll set you up with the perfect plan.",
    formspreeEndpoint: 'https://formspree.io/f/xgobwrdw',
    calendlyUrl: 'https://calendly.com/quademdigitalenterprise/quaderp-demo-call',
    whatsappNumber: '233530890302',
    whatsappMessage: "Hi Quadem! I'm interested in QuadERP for my store. Can we talk?",

    // ===== SEO =====
    seoTitle: 'QuadERP — All-in-One Store Management Platform | Quadem Digital',
    seoDescription: 'QuadERP is a powerful, cloud-based ERP for retail stores. Track sales, manage inventory, oversee staff, and prevent losses — all in one app.',
  })

  console.log('✅ QuadERP Landing Page document created!')
  console.log('   → Open Sanity Studio → "QuadERP Landing Page" to edit.')
}

seedQuadERP().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
