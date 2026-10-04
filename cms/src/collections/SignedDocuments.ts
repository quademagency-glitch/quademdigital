import type { CollectionConfig } from 'payload'
import { isAdmin, nobody } from '../access/roles'

/**
 * The finished copies: the original with every signature written in and the
 * signing certificate added at the end. Written once by the signing flow and
 * never changed, in the private documents bucket.
 */
export const SignedDocuments: CollectionConfig = {
  slug: 'signed-documents',
  labels: { singular: 'Signed document', plural: 'Signed documents' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'reference', 'createdAt'],
    description: 'Every completed document, with its signing certificate. Read-only: these are the legal record.',
  },
  upload: { mimeTypes: ['application/pdf'] },
  access: { read: isAdmin, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'title', type: 'text', admin: { readOnly: true } },
    { name: 'reference', type: 'text', admin: { readOnly: true } },
    { name: 'request', type: 'relationship', relationTo: 'signature-requests', admin: { readOnly: true } },
    { name: 'hash', label: 'Fingerprint (SHA-256)', type: 'text', admin: { readOnly: true } },
  ],
}
