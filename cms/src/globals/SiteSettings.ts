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
      /*
        The header navigation, in order, and now the whole of it. BaseLayout
        used to force QuadERP and Offers back in after reading this, so those
        two could not be removed or moved no matter what was set here.
      */
      name: 'navLinks',
      label: 'Navigation Links',
      type: 'array',
      admin: {
        description:
          'The full header menu, in order. Leave empty to fall back to the built-in list.',
      },
      fields: [
        { name: 'label', label: 'Label', type: 'text' },
        { name: 'url', label: 'URL Path (e.g. /services)', type: 'text' },
      ],
    },
    {
      /*
        The footer's two link columns.
        
        Each row is one heading and the links beneath it. `column` decides
        which of the two columns it lands in, which is what the footer grid
        gives us: brand, links, links, contact.

        This field existed before with a single `label` and nothing else, was
        read into a variable in BaseLayout, and was never rendered: the footer
        columns were typed into the layout. `label` stays the heading and `url`
        reuses a column production already had, so nothing is dropped.

        Nothing is `required`. There is a row in production with every value
        null, left from when this field did nothing, and requiring a heading
        would make the whole global fail to save. Rows without a heading are
        skipped at render instead.
      */
      name: 'footerLinks',
      label: 'Footer Link Columns',
      type: 'array',
      admin: {
        description:
          'Leave empty to fall back to the built-in footer. Rows without a heading are ignored.',
      },
      fields: [
        { name: 'label', label: 'Heading', type: 'text' },
        {
          name: 'url',
          label: 'Heading Link',
          type: 'text',
          admin: { description: 'Optional. Makes the heading itself clickable, e.g. /offers/' },
        },
        {
          name: 'column',
          label: 'Which Column',
          type: 'select',
          defaultValue: 'left',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
        },
        {
          name: 'links',
          label: 'Links',
          type: 'array',
          fields: [
            { name: 'label', label: 'Label', type: 'text' },
            { name: 'url', label: 'URL', type: 'text' },
          ],
        },
      ],
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
    /*
      Tracking codes. These were literals in `BaseLayout.astro`, some of them
      inside `is:inline` scripts, so changing a property or adding a tool meant
      a code change and a deploy.

      Every one falls back to the code's value when left empty, and the layout
      refuses anything that is not the right shape for its field, so a typo
      here leaves tracking exactly as it was rather than silently killing it.
      That guard matters twice over: three of these are interpolated into
      inline JavaScript.
    */
    {
      name: 'analytics',
      label: 'Tracking Codes',
      type: 'group',
      admin: {
        description:
          'Leave a box empty to keep the code the site already uses. A code in the wrong format is ignored rather than applied.',
      },
      fields: [
        {
          name: 'gtmId',
          label: 'Google Tag Manager container',
          type: 'text',
          admin: { description: 'Looks like GTM-XXXXXXX. This is what loads Google Analytics and the chat widget.' },
          validate: (value: unknown) =>
            !value || /^GTM-[A-Z0-9]{4,20}$/.test(String(value).trim())
              ? true
              : 'A container ID looks like GTM-5CPTKQDB.',
        },
        {
          name: 'ga4Id',
          label: 'Google Analytics 4 measurement ID',
          type: 'text',
          admin: { description: 'Looks like G-XXXXXXXXXX.' },
          validate: (value: unknown) =>
            !value || /^G-[A-Z0-9]{6,20}$/.test(String(value).trim())
              ? true
              : 'A measurement ID looks like G-VWQNS4KFSX.',
        },
        {
          name: 'ahrefsKey',
          label: 'Ahrefs Analytics key',
          type: 'text',
          admin: { description: 'The data-key Ahrefs gives you when you add the site.' },
          validate: (value: unknown) =>
            !value || /^[A-Za-z0-9+/=_-]{10,64}$/.test(String(value).trim())
              ? true
              : 'That does not look like an Ahrefs key.',
        },
        {
          name: 'metricoolHash',
          label: 'Metricool tracking hash',
          type: 'text',
          admin: { description: 'The long string of letters and numbers from the Metricool tracking snippet.' },
          validate: (value: unknown) =>
            !value || /^[a-f0-9]{16,64}$/.test(String(value).trim())
              ? true
              : 'A Metricool hash is 16 to 64 characters, digits and the letters a to f.',
        },
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
