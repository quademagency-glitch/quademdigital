# QuadERP page copy (retired from the CMS)

QuadERP has its own site at https://quaderp.app , so quademdigital.com never
got a QuadERP page and the `quaderpPage` global was never read by anything.
It was removed on 2026-08-24 along with its seven database tables, six of
which were empty.

The copy is kept here because it was written and is not otherwise recorded.
Nothing reads this file; it is a note, not a source of truth.

## Copy as it stood

- **heroBadge**: 🚀 Introducing QuadERP
- **heroTitle**: Take Control of Your
- **heroTitleGradient**: Store Operations
- **heroSubtitle**: Real-time sales tracking, smart inventory management, staff oversight, and theft prevention, all in one powerful platform built for modern retail.
- **trustBadges**: (empty)
- **featuresHeading**: Everything You Need to Run Your Store
- **featuresSubtitle**: Powerful tools designed for retail businesses of every size, from single shops to multi-location chains.
- **features**: (empty)
- **showcaseHeading**: See QuadERP in Action
- **showcaseItems**: (empty)
- **pricingHeading**: Simple, Transparent Pricing
- **pricingSubtitle**: Start free. Scale as you grow. No hidden fees, ever.
- **pricingPlans**: (empty)
- **pricingNote**: 🔒 All plans include a 14-day free trial. Prices are placeholder and subject to change.
- **contactHeading**: Get Started With QuadERP
- **contactSubtitle**: Tell me about your business and I'll set you up with the perfect plan.
- **formspreeEndpoint**: https://formspree.io/f/xgobwrdw
- **calendlyUrl**: https://calendly.com/quademdigitalenterprise/quaderp-demo-call
- **whatsappNumber**: 233530890302
- **whatsappMessage**: Hi Quadem! I'm interested in QuadERP for my store. Can we talk?
- **seoTitle**: (empty)
- **seoDescription**: (empty)

## Worth knowing

- `pricingNote` said the prices were placeholders, so nothing here is a
  committed figure.
- `formspreeEndpoint` pointed at Formspree, which the site stopped using when
  forms moved to `/api/submit-form`. It was the last reference to Formspree in
  any live config.
- The Calendly link is a QuadERP demo booking, separate from the general
  booking link on the contact page.

