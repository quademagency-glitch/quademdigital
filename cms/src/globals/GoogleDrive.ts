import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'

/*
  The connection to Ernest's Google Drive (lib/googleDrive.ts), made and
  removed from the portal (Settings, Google Drive). Only the CMS writes it.
  The refresh token is sealed with PAYLOAD_SECRET and never leaves the CMS:
  no one can read it through the API, admins included.
*/
export const GoogleDrive: GlobalConfig = {
  slug: 'google-drive',
  label: 'Google Drive connection',
  admin: { group: 'Settings', hidden: true },
  access: { read: isAdmin, update: () => false },
  fields: [
    { name: 'email', type: 'text', label: 'Connected as', admin: { readOnly: true } },
    {
      name: 'refreshToken',
      type: 'text',
      access: { read: () => false, create: () => false, update: () => false },
      admin: { hidden: true },
    },
    { name: 'rootFolderId', type: 'text', admin: { readOnly: true } },
    { name: 'rootFolderUrl', type: 'text', label: '"Quadem clients" folder', admin: { readOnly: true } },
    { name: 'connectedAt', type: 'date', admin: { readOnly: true } },
    { name: 'lastError', type: 'text', admin: { readOnly: true } },
  ],
}
