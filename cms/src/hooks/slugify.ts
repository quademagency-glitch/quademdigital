import type { FieldHook } from 'payload'

export const makeSlugHook = (sourceField: string): FieldHook =>
  ({ value, data }) => {
    if (!value && data?.[sourceField]) {
      return (data[sourceField] as string)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }
    return value
  }
