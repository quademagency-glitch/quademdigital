import type { Block } from 'payload'

export const FAQAccordion: Block = {
  slug: 'faqAccordion',
  interfaceName: 'FAQAccordionBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'faqs',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'textarea', required: true }
      ]
    }
  ]
}
