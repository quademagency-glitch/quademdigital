import 'dotenv/config'
import { getPayload } from 'payload'
import config from './payload.config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const EXPORT_DATA_PATH = path.resolve(dirname, '../../studio/export_data/production-export-2026-06-12t20-34-42-192z/data.ndjson')

async function run() {
  console.log('Starting migration script...')
  console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 15))
  console.log('PAYLOAD_SECRET is set:', !!process.env.PAYLOAD_SECRET)
  
  console.log('Initializing Payload...')
  const payload = await getPayload({ config })
  console.log('Payload initialized!')
  
  if (!fs.existsSync(EXPORT_DATA_PATH)) {
    console.error(`Export data not found at ${EXPORT_DATA_PATH}`)
    process.exit(1)
  }

  const fileStream = fs.createReadStream(EXPORT_DATA_PATH)
  const rl = readline.createInterface({ input: fileStream })
  
  let count = 0
  
  for await (const line of rl) {
    if (!line.trim()) continue
    
    try {
      const doc = JSON.parse(line)
      
      switch (doc._type) {
        case 'siteSettings':
          await payload.updateGlobal({
            slug: 'siteSettings',
            data: {
              title: doc.title,
              description: doc.description,
              email: doc.email,
              whatsappNumber: doc.whatsappNumber,
              footerTagline: doc.footerTagline,
              enablePaystack: doc.enablePaystack,
              // Note: References like images (clientLogos) and complex arrays (socialLinks, navLinks) need specific mapping if preserving data
            }
          })
          break
          
        case 'homepage':
          await payload.updateGlobal({
            slug: 'homepage',
            data: {
              heroHeadline: doc.heroHeadline,
              heroTagline: doc.heroTagline,
              heroServices: doc.heroServices?.map((s: string) => ({ service: s })),
              founderTitle: doc.founderTitle,
              founderText: doc.founderText?.map((t: string) => ({ paragraph: t })),
              newsletterHeading: doc.newsletterHeading,
              newsletterSubheading: doc.newsletterSubheading,
              contactHeading: doc.contactHeading,
              contactSubheading: doc.contactSubheading,
              contactInfoTitle: doc.contactInfoTitle,
              contactInfoText: doc.contactInfoText,
              contactWhatsappButtonText: doc.contactWhatsappButtonText,
              contactSubmitButtonText: doc.contactSubmitButtonText,
              contactFormSuccessMessage: doc.contactFormSuccessMessage,
            }
          })
          break
          
        case 'about':
          await payload.updateGlobal({
            slug: 'about',
            data: {
              title: doc.title,
              headline: doc.headline,
              bio: doc.bio,
              mission: doc.mission,
              vision: doc.vision,
              coreValues: doc.coreValues?.map((v: any) => ({ title: v.title, description: v.description }))
            }
          })
          break

        case 'blogCategory':
          await payload.create({
            collection: 'blogCategories',
            data: {
              title: doc.title,
              slug: doc.slug?.current || doc.title.toLowerCase().replace(/\\s+/g, '-'),
              description: doc.description,
            }
          })
          break

        case 'blogPost':
          await payload.create({
            collection: 'blogPosts',
            data: {
              title: doc.title,
              slug: doc.slug?.current || doc.title.toLowerCase().replace(/\\s+/g, '-'),
              excerpt: doc.excerpt,
              linkedInPost: doc.linkedInPost,
              publishedAt: doc.publishedAt,
              author: doc.author,
              seoDescription: doc.seoDescription,
              body: doc.body, // Preserved as JSON
              // Note: category and coverImage are references and need to be resolved if maintaining relations
            }
          })
          break

        case 'service':
          await payload.create({
            collection: 'services',
            data: {
              title: doc.title,
              slug: doc.slug?.current || doc.title.toLowerCase().replace(/\\s+/g, '-'),
              description: doc.description,
              tags: doc.tags?.map((t: string) => ({ tag: t })),
              iconSvg: doc.iconSvg,
              order: doc.order,
              body: doc.body, // Preserved as JSON
            }
          })
          break

        case 'caseStudy':
          await payload.create({
            collection: 'caseStudies',
            data: {
              title: doc.title,
              slug: doc.slug?.current || doc.title.toLowerCase().replace(/\\s+/g, '-'),
              tag: doc.tag,
              description: doc.description,
              resultMetric: doc.resultMetric,
              resultText: doc.resultText,
              order: doc.order,
              body: doc.body, // Preserved as JSON
            }
          })
          break

        case 'offer':
          await payload.create({
            collection: 'offers',
            data: {
              title: doc.title,
              slug: doc.slug?.current || doc.title.toLowerCase().replace(/\\s+/g, '-'),
              description: doc.description,
              cta: doc.cta,
              publishedAt: doc.publishedAt,
            }
          })
          break

        case 'testimonial':
          await payload.create({
            collection: 'testimonials',
            data: {
              authorName: doc.authorName,
              authorRole: doc.authorRole,
              quote: doc.quote,
              stars: doc.stars,
              videoUrl: doc.videoUrl,
              order: doc.order,
            }
          })
          break

        case 'faq':
          await payload.create({
            collection: 'faqs',
            data: {
              question: doc.question,
              answer: doc.answer,
              order: doc.order,
            }
          })
          break
          
        case 'formSubmission':
          await payload.create({
            collection: 'leads',
            data: {
              source: doc.source,
              name: doc.name,
              email: doc.email,
              message: doc.message,
              status: doc.status || 'new',
              submittedAt: doc.submittedAt || doc._createdAt,
              metadata: doc.metadata ? JSON.parse(doc.metadata) : null,
            }
          })
          break
          
        case 'webapp':
          await payload.create({
            collection: 'webapps',
            data: {
              name: doc.name,
              tagline: doc.tagline,
              description: doc.description,
              status: doc.status,
              link: doc.link,
              order: doc.order,
            }
          })
          break

        case 'stat':
          await payload.create({
            collection: 'stats',
            data: {
              value: doc.value,
              label: doc.label,
              prefix: doc.prefix,
              suffix: doc.suffix,
              order: doc.order,
            }
          })
          break

        case 'processStep':
          await payload.create({
            collection: 'processSteps',
            data: {
              title: doc.title,
              description: doc.description,
              stepNumber: doc.stepNumber,
              iconSvg: doc.iconSvg,
            }
          })
          break

        case 'pricingPlan':
          await payload.create({
            collection: 'pricingPlans',
            data: {
              name: doc.name,
              price: doc.price,
              description: doc.description,
              isPopular: doc.isPopular,
              features: doc.features?.map((f: string) => ({ feature: f })),
              order: doc.order,
            }
          })
          break

        case 'calculatorService': {
          // priceUSD/priceGHS are required: the site shows one or the other by
          // visitor country and never converts between them. The Sanity source
          // only carries a single basePrice, so if a doc arrives without both,
          // seeding it would quote the same figure as dollars AND as cedis —
          // which is how an overseas visitor ended up being quoted $1,500 for a
          // GH₵1,500 service. Fall back so seeding still works, but say so
          // loudly, because the row needs a real price before it goes live.
          const priceUSD = doc.priceUSD ?? doc.basePrice
          const priceGHS = doc.priceGHS ?? doc.basePrice
          if (doc.priceUSD == null || doc.priceGHS == null) {
            console.warn(
              `[migrate] calculatorService "${doc.name}" seeded with basePrice for both ` +
              `currencies (USD ${priceUSD} / GHS ${priceGHS}). Set real per-currency ` +
              `prices in the admin before this is shown to visitors.`,
            )
          }
          await payload.create({
            collection: 'calculatorServices',
            data: {
              name: doc.name,
              basePrice: doc.basePrice,
              priceUSD,
              priceGHS,
              description: doc.description,
              order: doc.order,
            }
          })
          break
        }
      }
      count++
    } catch (e) {
      console.error(`Error migrating document:`, e)
    }
  }
  
  console.log(`Migration completed! Processed ${count} documents.`)
  process.exit(0)
}

run().catch(console.error)
