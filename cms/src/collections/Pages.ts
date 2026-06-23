import type { CollectionConfig } from 'payload'
import {
  lexicalHTMLField,
  lexicalEditor,
  UploadFeature
} from '@payloadcms/richtext-lexical'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { isAnyone } from '../access/isAnyone'
import { autoPublishCollectionHook } from '../hooks/autoPublish'

import { HeroSection } from '../blocks/HeroSection'
import { TextBlock } from '../blocks/TextBlock'
import { ImageGallery } from '../blocks/ImageGallery'
import { CallToAction } from '../blocks/CallToAction'
import { FeatureGrid } from '../blocks/FeatureGrid'
import { TestimonialSlider } from '../blocks/TestimonialSlider'
import { FAQAccordion } from '../blocks/FAQAccordion'
import { VideoEmbed } from '../blocks/VideoEmbed'
import { PricingCards } from '../blocks/PricingCards'
import { TeamGrid } from '../blocks/TeamGrid'
import { LogoCloud } from '../blocks/LogoCloud'
import { MediaAndText } from '../blocks/MediaAndText'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    components: {
      edit: {
        PublishButton: '../components/RedirectAfterSave#PublishAndRedirectButton',
        SaveDraftButton: '../components/HiddenButton#HiddenButton',
      },
    },
  },
  versions: {
    drafts: true,
  },
  hooks: {
    beforeChange: [autoPublishCollectionHook],
  },
  access: {
    read: isAnyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'title', label: 'Page Title', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    {
      name: 'pageBuilder',
      label: 'Page Builder',
      type: 'blocks',
      blocks: [
        HeroSection,
        TextBlock,
        ImageGallery,
        CallToAction,
        FeatureGrid,
        TestimonialSlider,
        FAQAccordion,
        VideoEmbed,
        PricingCards,
        TeamGrid,
        LogoCloud,
        MediaAndText
      ]
    }
  ],
}
