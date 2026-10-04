import type { CollectionConfig } from 'payload'
import { isAdmin, nobody } from '../access/roles'

/**
 * One signer's progress on one request: their private link, whether they have
 * opened it, entered a code, signed or declined, and the signature itself.
 *
 * Kept apart from the request on purpose. Two people can sign within the same
 * second, and a request holding everyone's state in one record would let the
 * slower save write back a copy taken before the faster one signed. This CMS
 * has lost data to exactly that race before (the Resend webhook, August 2026).
 * Here each record is only ever written by its own signer's actions.
 *
 * Created when a request is sent, never by hand. Read in the admin through the
 * panel on the request, so the collection itself stays out of the sidebar.
 */
export const SigningSessions: CollectionConfig = {
  slug: 'signing-sessions',
  labels: { singular: 'Signer', plural: 'Signers' },
  admin: { hidden: true, useAsTitle: 'name' },
  access: { read: isAdmin, create: nobody, update: nobody, delete: isAdmin },
  fields: [
    { name: 'request', type: 'relationship', relationTo: 'signature-requests', required: true, index: true },
    /** The id of this person's row in the request's signers list. */
    { name: 'signerId', type: 'text', required: true, index: true },
    { name: 'order', type: 'number', defaultValue: 0 },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'role', type: 'text' },
    { name: 'organisation', type: 'text' },
    { name: 'title', type: 'text' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'sent',
      options: [
        { label: 'Waiting their turn', value: 'waiting' },
        { label: 'Sent', value: 'sent' },
        { label: 'Opened', value: 'opened' },
        { label: 'Signed', value: 'signed' },
        { label: 'Declined', value: 'declined' },
        { label: 'Withdrawn', value: 'cancelled' },
      ],
      index: true,
    },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, access: { read: () => false } },
    { name: 'tokenSealed', type: 'text', access: { read: () => false } },
    { name: 'sentAt', type: 'date' },
    { name: 'openedAt', type: 'date' },
    { name: 'signedAt', type: 'date' },
    { name: 'declinedAt', type: 'date' },
    { name: 'declineReason', type: 'textarea' },
    { name: 'ip', type: 'text' },
    { name: 'device', type: 'text' },
    { name: 'codeHash', type: 'text', access: { read: () => false } },
    { name: 'codeSentAt', type: 'date' },
    { name: 'codesSent', type: 'number', defaultValue: 0 },
    { name: 'codeTries', type: 'number', defaultValue: 0 },
    { name: 'codeVerified', type: 'checkbox', defaultValue: false },
    { name: 'remindedAt', type: 'date' },
    { name: 'reminders', type: 'number', defaultValue: 0 },
    /** PNG data URLs, as drawn or typed on the signing page. */
    { name: 'signature', type: 'textarea', maxLength: 600_000 },
    { name: 'initials', type: 'textarea', maxLength: 300_000 },
    // What this signer typed into their own blanks, by place id.
    { name: 'texts', type: 'json' },
    {
      name: 'events',
      type: 'array',
      fields: [
        { name: 'at', type: 'date', required: true },
        { name: 'text', type: 'text', required: true },
      ],
    },
  ],
}
