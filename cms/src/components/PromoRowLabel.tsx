'use client'

import { useRowLabel } from '@payloadcms/ui'

/**
 * Names each homepage promo card by its heading rather than "Item 1".
 *
 * Four collapsed rows all reading "Item n" cannot be reordered with any
 * confidence, which is the one thing this array exists to let someone do.
 */
export const PromoRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ heading?: string; headingAccent?: string }>()
  const heading = [data?.heading, data?.headingAccent].filter(Boolean).join(' ').trim()
  return <span>{heading || `Card ${(rowNumber ?? 0) + 1}`}</span>
}
