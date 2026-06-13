import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { Leads } from './collections/Leads'
import { BlogCategories } from './collections/BlogCategories'
import { BlogPosts } from './collections/BlogPosts'
import { Services } from './collections/Services'
import { CaseStudies } from './collections/CaseStudies'
import { Offers } from './collections/Offers'
import { Testimonials } from './collections/Testimonials'
import { Faqs } from './collections/Faqs'
import { Webapps } from './collections/Webapps'
import { Stats } from './collections/Stats'
import { ProcessSteps } from './collections/ProcessSteps'
import { PricingPlans } from './collections/PricingPlans'
import { CalculatorServices } from './collections/CalculatorServices'
import { Clients } from './collections/Clients'
import { Invoices } from './collections/Invoices'
import { OnboardingGuides } from './collections/OnboardingGuides'

import { SiteSettings } from './globals/SiteSettings'
import { Homepage } from './globals/Homepage'
import { About } from './globals/About'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Folders, Tags, Leads, BlogCategories, BlogPosts, Services, CaseStudies, Offers, Testimonials, Faqs, Webapps, Stats, ProcessSteps, PricingPlans, CalculatorServices, Clients, Invoices, OnboardingGuides],
  globals: [SiteSettings, Homepage, About],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: process.env.NODE_ENV === 'production' 
    ? postgresAdapter({
        pool: { connectionString: process.env.DATABASE_URL || '' },
      })
    : sqliteAdapter({
        client: { url: 'file:./payload-dev.db' }
      }),
  sharp,
  localization: {
    locales: ['en'],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [
    ...(process.env.S3_BUCKET ? [
      s3Storage({
        collections: {
          media: true,
        },
        bucket: process.env.S3_BUCKET,
        config: {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          },
          region: process.env.S3_REGION || 'auto',
          endpoint: process.env.S3_ENDPOINT || undefined,
        },
      })
    ] : [])
  ],
})
