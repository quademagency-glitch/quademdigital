#!/usr/bin/env node
// Hits every public collection/global API route and fails loudly on any
// non-2xx response. Run after any deploy or production migration:
//   pnpm smoke-test
//   pnpm smoke-test --base-url=https://cms.quademdigital.com

const baseUrlArg = process.argv.find((arg) => arg.startsWith('--base-url='))
const baseUrl = baseUrlArg
  ? baseUrlArg.split('=')[1]
  : process.env.SMOKE_TEST_BASE_URL || 'https://cms.quademdigital.com'

const collections = [
  'users', 'media', 'folders', 'tags', 'leads', 'blogCategories', 'blogPosts',
  'services', 'caseStudies', 'offers', 'testimonials', 'faqs', 'webapps',
  'stats', 'processSteps', 'pricingPlans', 'calculatorServices', 'clients',
  'invoices', 'onboarding-guides', 'onboarding-documents', 'pages', 'emailCampaigns', 'redirects',
]

const globals = [
  'siteSettings', 'homepage', 'about', 'contactPage', 'servicesPage',
  'projectsPage', 'videoProductionPage', 'webDesignPage',
  'brandIdentityPage', 'seoPage',
]

const routes = [
  ...collections.map((slug) => ({ kind: 'collection', slug, url: `${baseUrl}/api/${slug}?limit=1` })),
  ...globals.map((slug) => ({ kind: 'global', slug, url: `${baseUrl}/api/globals/${slug}` })),
]

let failures = 0

for (const route of routes) {
  try {
    const res = await fetch(route.url)
    // 401/403 means the route is correctly auth-gated, not broken.
    const ok = (res.status >= 200 && res.status < 300) || res.status === 401 || res.status === 403
    if (!ok) {
      failures++
      const body = await res.text()
      console.error(`✗ ${route.kind} ${route.slug} -> ${res.status}\n  ${body.slice(0, 300)}`)
    } else {
      console.log(`✓ ${route.kind} ${route.slug} -> ${res.status}`)
    }
  } catch (err) {
    failures++
    console.error(`✗ ${route.kind} ${route.slug} -> request failed: ${err.message}`)
  }
}

console.log(`\n${routes.length - failures}/${routes.length} routes OK`)
if (failures > 0) {
  console.error(`${failures} route(s) failed.`)
  process.exit(1)
}
