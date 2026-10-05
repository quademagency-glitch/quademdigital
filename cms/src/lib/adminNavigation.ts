export const WORKSPACES = ['Sales', 'Content', 'Marketing', 'Team', 'Finance', 'Settings'] as const
export type Workspace = (typeof WORKSPACES)[number]

const destinations: Record<Workspace, string[]> = {
  Sales: [
    'leads',
    'clients',
    'proposals',
    'quote-requests',
    'pitches',
    'signature-requests',
    'signed-documents',
    'onboarding-documents',
    'client-journey-steps',
  ],
  Content: [
    'homepage',
    'pages',
    'blogPosts',
    'media',
    'caseStudies',
    'services',
    'about',
    'contactPage',
    'servicesPage',
    'projectsPage',
    'webDesignPage',
    'brandIdentityPage',
    'videoProductionPage',
    'seoPage',
    'testimonials',
    'faqs',
    'webapps',
    'stats',
    'processSteps',
    'blogCategories',
  ],
  Marketing: ['emailCampaigns', 'subscribers', 'offers', 'campaignEvents'],
  Team: [
    'users',
    'tasks',
    'projects',
    'deliverables',
    'time-off',
    'monthly-reviews',
    'warnings',
    'appraisals',
    'goals',
    'training-modules',
    'training-progress',
    'meetings',
    'know-how',
    'openings',
    'applicants',
    'channels',
    'messages',
    'polls',
    'daily-reports',
    'announcements',
    'documents',
    'member-terms',
    'notifications',
    'comments',
  ],
  Finance: ['invoices', 'client-payments', 'payouts', 'expense-claims'],
  Settings: [
    'siteSettings',
    'ops-settings',
    'pricingPlans',
    'calculatorServices',
    'journey-templates',
    'onboarding-guides',
    'terms-templates',
    'job-roles',
    'redirects',
    'audit-log',
  ],
}

export type NavDestination = { slug: string; label: string; href: string; group: Workspace }
export function workspaceFor(slug: string): Workspace {
  return WORKSPACES.find((group) => destinations[group].includes(slug)) || 'Settings'
}

export function sortDestinations(items: NavDestination[]) {
  return [...items].sort((a, b) => {
    const group = WORKSPACES.indexOf(a.group) - WORKSPACES.indexOf(b.group)
    if (group) return group
    const order = destinations[a.group]
    const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length)
    return rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label)
  })
}
