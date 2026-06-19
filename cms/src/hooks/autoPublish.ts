import type { CollectionBeforeChangeHook, GlobalBeforeChangeHook } from 'payload'

/**
 * Forces _status to 'published' on every save so that
 * draft-enabled collections never stay in draft state.
 * This effectively makes "Save" behave like "Save & Publish".
 */
export const autoPublishCollectionHook: CollectionBeforeChangeHook = ({ data }) => {
  if (data && '_status' in data) {
    data._status = 'published'
  } else if (data) {
    // For draft-enabled collections, always set published even if field isn't present yet
    data._status = 'published'
  }
  return data
}

export const autoPublishGlobalHook: GlobalBeforeChangeHook = ({ data }) => {
  if (data && '_status' in data) {
    data._status = 'published'
  }
  return data
}
