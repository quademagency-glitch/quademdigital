import type { CollectionConfig } from 'payload'
import { nobody } from '../access/roles'

const internal = { read: nobody, create: nobody, update: nobody, delete: nobody }
const admin = { hidden: true as const }

/** Internal records are reachable only through the caller-scoped endpoints. */
export const SecurityChallenges: CollectionConfig = {
  slug: 'security-challenges', admin, access: internal,
  fields: [
    { name: 'challenge', type: 'text', required: true, unique: true },
    { name: 'bucket', type: 'text', required: true, unique: true },
    { name: 'userId', type: 'number', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'attempts', type: 'number', defaultValue: 0, required: true },
    { name: 'usedAt', type: 'date' },
  ],
}

export const DeviceSessions: CollectionConfig = {
  slug: 'device-sessions', admin, access: internal,
  fields: [
    { name: 'sid', type: 'text', required: true, unique: true },
    { name: 'userId', type: 'number', required: true, index: true },
    { name: 'label', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}

export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions', admin, access: internal,
  fields: [
    { name: 'endpointHash', type: 'text', required: true, unique: true },
    { name: 'userId', type: 'number', required: true, index: true },
    { name: 'sid', type: 'text', required: true, index: true },
    { name: 'subscription', type: 'json', required: true },
  ],
}

export const OfflineSubmissions: CollectionConfig = {
  slug: 'offline-submissions', admin, access: internal,
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'userId', type: 'number', required: true, index: true },
    { name: 'kind', type: 'text', required: true },
    { name: 'inputHash', type: 'text', required: true },
    { name: 'recordId', type: 'number' },
    { name: 'path', type: 'text' },
  ],
}

export const OperationsHealth: CollectionConfig = {
  slug: 'operations-health', admin, access: internal,
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'value', type: 'json' },
  ],
}
