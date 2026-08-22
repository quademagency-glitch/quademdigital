import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  label: 'Site Settings',
  admin: { group: 'Settings' },
  access: {
    read: () => true,
    /**
     * Admin only. This global holds `bankDetails`, which is what a client is
     * told to pay into, and the Paystack toggle. Write access was previously
     * Payload's default, meaning any authenticated user including an editor
     * could change the account number an invoice asks people to pay.
     */
    update: isAdmin,
  },
  fields: [
    { name: 'title', label: 'Site Title', type: 'text' },
    { name: 'description', label: 'Site Description', type: 'textarea' },
    { name: 'email', label: 'Contact Email', type: 'text' },
    {
      name: 'whatsappNumber',
      label: 'WhatsApp Number',
      type: 'text',
      admin: { description: 'Include country code, no spaces or + sign (e.g. 233530890302)' },
    },
    {
      name: 'whatsappMessage',
      label: 'WhatsApp Pre-fill Message',
      type: 'text',
      defaultValue: "Hi, I'd like to discuss a project with Quadem Digital.",
      admin: { description: 'Default message pre-filled when a visitor taps any WhatsApp CTA.' },
    },
    {
      name: 'socialLinks',
      label: 'Social Media Links',
      type: 'array',
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Twitter / X', value: 'twitter' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'GitHub', value: 'github' },
            { label: 'Behance', value: 'behance' },
            { label: 'Dribbble', value: 'dribbble' },
            { label: 'Threads', value: 'threads' },
            { label: 'Pinterest', value: 'pinterest' },
            { label: 'Snapchat', value: 'snapchat' },
            { label: 'Other', value: 'other' },
          ],
        },
        { name: 'url', label: 'Profile URL', type: 'text', required: true },
        {
          name: 'label',
          label: 'Custom Label',
          type: 'text',
          admin: {
            description: 'If you selected "Other", give it a name (e.g. "WhatsApp", "Discord")',
            condition: (_, siblingData) => siblingData?.platform === 'other',
          },
        },
      ],
    },
    { name: 'footerTagline', label: 'Footer Tagline', type: 'text' },
    {
      name: 'clientLogos',
      label: 'Client Logos',
      type: 'array',
      fields: [{ name: 'logo', type: 'upload', relationTo: 'media' }],
    },
    {
      name: 'navLinks',
      label: 'Navigation Links',
      type: 'array',
      fields: [
        { name: 'label', label: 'Label', type: 'text' },
        { name: 'url', label: 'URL Path (e.g. /services)', type: 'text' },
      ],
    },
    {
      name: 'footerLinks',
      label: 'Footer Links',
      type: 'array',
      fields: [{ name: 'label', label: 'Label', type: 'text' }],
    },
    {
      name: 'certifications',
      label: 'Certifications & Badges',
      type: 'array',
      admin: { description: 'Only add badges you have genuinely earned. Displayed in the footer and About page.' },
      fields: [
        { name: 'badge', label: 'Badge Image', type: 'upload', relationTo: 'media', required: true },
        { name: 'label', label: 'Label', type: 'text', required: true, admin: { description: 'e.g. "Google Ads Certified"' } },
        { name: 'verifyLink', label: 'Verify Link', type: 'text', admin: { description: 'URL where visitors can verify this credential.' } },
      ],
    },
    {
      name: 'bankDetails',
      label: 'Bank Details (For Invoices)',
      type: 'group',
      fields: [
        { name: 'bankName', label: 'Bank Name', type: 'text' },
        { name: 'accountName', label: 'Account Name', type: 'text' },
        { name: 'accountNumber', label: 'Account Number', type: 'text' },
      ],
    },
    {
      name: 'enablePaystack',
      label: 'Enable Paystack Payments',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Turn on to allow clients to pay invoices directly via Paystack.' },
    },
  ],
}
