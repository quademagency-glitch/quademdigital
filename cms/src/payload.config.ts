import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
import { seoPlugin } from '@payloadcms/plugin-seo'

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
import { OnboardingDocuments } from './collections/OnboardingDocuments'
import { Pages } from './collections/Pages'
import { EmailCampaigns } from './collections/EmailCampaigns'

import { SiteSettings } from './globals/SiteSettings'
import { Homepage } from './globals/Homepage'
import { About } from './globals/About'
import { ContactPage } from './globals/ContactPage'
import { ServicesPage } from './globals/ServicesPage'
import { ProjectsPage } from './globals/ProjectsPage'
import { QuadERPPage } from './globals/QuadERPPage'
import { VideoProductionPage } from './globals/VideoProductionPage';
import { WebDesignPage } from './globals/WebDesignPage';
import { BrandIdentityPage } from './globals/BrandIdentityPage';
import { SeoPage } from './globals/SeoPage';

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '- Quadem CMS',
      icons: { icon: '/logo.png' },
    },
    avatar: {
      Component: './components/Avatar#Avatar',
    },
    components: {
      beforeDashboard: ['./components/BeforeDashboard#BeforeDashboard'],
      afterNavLinks: ['./components/AfterNavLinks#AfterNavLinks'],
      settingsMenu: ['./components/SettingsLocale#SettingsLocale'],
      graphics: {
        Logo: './components/Graphics#Logo',
        Icon: './components/Graphics#Icon',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Folders, Tags, Leads, BlogCategories, BlogPosts, Services, CaseStudies, Offers, Testimonials, Faqs, Webapps, Stats, ProcessSteps, PricingPlans, CalculatorServices, Clients, Invoices, OnboardingGuides, OnboardingDocuments, Pages, EmailCampaigns],
  // BrandStudioPage was removed when that page was folded into the AI Video &
  // Reels service page. Its `brand_studio_page*` tables are deliberately left
  // in Postgres: see the note in CLAUDE.md before running `migrate:create`.
  globals: [SiteSettings, Homepage, About, ContactPage, ServicesPage, ProjectsPage, QuadERPPage, VideoProductionPage, WebDesignPage, BrandIdentityPage, SeoPage],
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://cms.quademdigital.com'].filter(Boolean),
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://cms.quademdigital.com'].filter(Boolean),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: process.env.NODE_ENV === 'production'
    ? postgresAdapter({
        pool: { connectionString: process.env.DATABASE_URL || '' },
        push: true,
      })
    : sqliteAdapter({
        client: { url: 'file:./payload-dev.db' }
      }),
  sharp,
  /**
   * The jobs queue, which exists here for one reason: scheduled publishing.
   *
   * Setting `schedulePublish` on BlogPosts and Pages makes Payload register a
   * built-in `schedulePublish` task and, when an editor picks a date, queue a
   * job with `waitUntil` set to it. Nothing publishes until something runs
   * that queue.
   *
   * `autoRun` is an in-process cron, which is safe here and would not be on
   * the site: Railway keeps one long-lived Node process, whereas Vercel
   * functions are torn down between requests. Every five minutes is the
   * granularity, so a post set for 09:00 goes out by 09:05. `allQueues`
   * because the schedule handler queues into `default` and does not let the
   * caller choose, and a future queue would otherwise be missed silently.
   *
   * `shouldAutoRun` keeps it off outside production. Development runs against
   * the SQLite dev database, where a cron writing job rows is noise at best.
   *
   * The cron is only created when Payload is initialised with `cron: true`,
   * which of the built-in routes only the admin panel does. Without
   * `src/instrumentation.ts` calling it at boot, a post scheduled on Friday
   * would sit unpublished all weekend unless somebody happened to open the
   * admin.
   */
  jobs: {
    autoRun: [{ cron: '*/5 * * * *', limit: 10, allQueues: true }],
    shouldAutoRun: () => process.env.NODE_ENV === 'production',
  },
  localization: {
    locales: ['en'],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [
    /**
     * Search-engine fields: the title and description Google shows, and the
     * picture that appears when a page is shared.
     *
     * Until now every one of those was a string literal in an .astro file, so
     * they could only be changed by a developer and a deploy. `blogPosts` even
     * had its titles in an if/else chain keyed on slug.
     *
     * This plugin was already a dependency and had been enabled here once
     * before: `blog_posts`, `pages` and `services` still carry their
     * `meta_title` / `meta_description` / `meta_image_id` columns in
     * production from that time, because destructive drops are deferred by
     * policy. Re-enabling it therefore reuses those columns rather than
     * creating them. `caseStudies` and `offers` and the globals below are the
     * only ones that genuinely need new columns.
     *
     * generateTitle/Description power the "Auto-generate" button in the admin.
     * They are a starting point for the editor, not a stored default, so a
     * page with nothing filled in still falls back to the site's own wording.
     */
    seoPlugin({
      /**
       * The plugin ships its meta fields as `localized: true`. This config has
       * localization switched on (a single locale, `en`, so it does nothing
       * useful), and Payload moves every localized field out to a `<table>_locales`
       * side table. That would mean new tables for all fourteen of these, while
       * the `meta_title` / `meta_description` / `meta_image_id` columns already
       * sitting on `blog_posts`, `pages` and `services` were left orphaned.
       *
       * Production has no `_locales` table at all, which is the proof that the
       * fields were not localized the last time this plugin was enabled.
       * Stripping the flag keeps them as plain columns and reuses what is
       * already there. Revisit only if the site ever becomes multilingual, and
       * then it is a data migration, not a config change.
       */
      fields: ({ defaultFields }) => {
        const delocalise = (fields: any[]): any[] =>
          fields.map((f) => ({
            ...f,
            ...(f.localized ? { localized: false } : {}),
            ...(Array.isArray(f.fields) ? { fields: delocalise(f.fields) } : {}),
            ...(Array.isArray(f.tabs)
              ? { tabs: f.tabs.map((t: any) => ({ ...t, fields: delocalise(t.fields || []) })) }
              : {}),
          }))
        return delocalise(defaultFields)
      },
      collections: ['blogPosts', 'pages', 'services', 'caseStudies', 'offers'],
      globals: [
        'homepage',
        'about',
        'contactPage',
        'servicesPage',
        'projectsPage',
        'webDesignPage',
        'brandIdentityPage',
        'seoPage',
        'videoProductionPage',
      ],
      uploadsCollection: 'media',
      generateTitle: ({ doc }: any) => {
        const t = doc?.title || doc?.heading || doc?.name
        return t ? `${t} | Quadem Digital` : 'Quadem Digital'
      },
      generateDescription: ({ doc }: any) =>
        doc?.excerpt || doc?.description || doc?.subheading || '',
    }),
    ...(process.env.S3_BUCKET ? [
      s3Storage({
        collections: {
          media: true,
          'onboarding-documents': true,
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

