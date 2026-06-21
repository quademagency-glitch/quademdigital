import type { CollectionAfterChangeHook, GlobalAfterChangeHook, Payload } from 'payload'

const BLOOM_MOCKUP_PROMPT =
  'Transform this into a polished, photorealistic device mockup: place the image as the screen content on a modern laptop (or phone, if the image is a vertical/mobile screenshot), shot in soft studio lighting on a clean minimal surface. Keep the original content fully legible. No added text, no watermark.'

interface BloomConfig {
  apiKey: string
  apiUrl: string
  brandSessionId: string
}

function getBloomConfig(): BloomConfig | null {
  const apiKey = process.env.BLOOM_API_KEY
  const apiUrl = process.env.BLOOM_API_URL
  const brandSessionId = process.env.BLOOM_BRAND_SESSION_ID
  if (!apiKey || !apiUrl || !brandSessionId) return null
  return { apiKey, apiUrl, brandSessionId }
}

async function bloomFetch(config: BloomConfig, path: string, init: RequestInit = {}) {
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`Bloom request to ${path} failed (${res.status}): ${JSON.stringify(json)}`)
  }
  return json
}

async function pollBloomImage(config: BloomConfig, imageId: string, timeoutMs = 120_000): Promise<string> {
  const start = Date.now()
  let current = (await bloomFetch(config, `/images/${imageId}?wait=true`, { method: 'GET' })).data

  while (current?.status !== 'completed' && Date.now() - start < timeoutMs) {
    if (current?.status === 'failed') break
    await new Promise((resolve) => setTimeout(resolve, 3000))
    current = (await bloomFetch(config, `/images/${imageId}`, { method: 'GET' })).data
  }

  if (current?.status !== 'completed' || !current?.imageUrl) {
    throw new Error(`Bloom image ${imageId} did not complete in time (status: ${current?.status})`)
  }
  return current.imageUrl as string
}

async function generateMockupFromRawMedia(payload: Payload, rawMediaId: number): Promise<number> {
  const config = getBloomConfig()
  if (!config) {
    throw new Error('Bloom is not configured (missing BLOOM_API_KEY / BLOOM_API_URL / BLOOM_BRAND_SESSION_ID)')
  }

  const rawMedia = await payload.findByID({ collection: 'media', id: rawMediaId })
  const rawImageUrl = rawMedia.url?.startsWith('http')
    ? rawMedia.url
    : `${process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || ''}${rawMedia.url || ''}`
  if (!rawImageUrl) {
    throw new Error(`Raw media ${rawMediaId} has no accessible URL`)
  }

  const uploaded = await bloomFetch(config, '/images/uploads', {
    method: 'POST',
    body: JSON.stringify({ imageUrl: rawImageUrl, brandSessionId: config.brandSessionId }),
  })
  const bloomImageId = uploaded.data.id as string

  const edited = await bloomFetch(config, `/images/${bloomImageId}/edit`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: BLOOM_MOCKUP_PROMPT,
      brandSessionId: config.brandSessionId,
      model: 'pro',
    }),
  })
  const resultImageId = edited.data.id as string

  const mockupImageUrl = await pollBloomImage(config, resultImageId)

  const downloadRes = await fetch(mockupImageUrl)
  if (!downloadRes.ok) {
    throw new Error(`Failed to download generated mockup: ${downloadRes.status}`)
  }
  const arrayBuffer = await downloadRes.arrayBuffer()
  const mimetype = downloadRes.headers.get('content-type') || 'image/png'
  const extension = mimetype.split('/')[1] || 'png'
  const filename = `mockup-${rawMediaId}-${Date.now()}.${extension}`

  const mockupDoc = await payload.create({
    collection: 'media',
    data: {
      alt: `${rawMedia.alt || 'Service'} — generated mockup`,
      kind: 'mockup',
      sourceImage: rawMediaId,
    },
    file: { data: Buffer.from(arrayBuffer), name: filename, mimetype, size: arrayBuffer.byteLength },
  })

  return mockupDoc.id as number
}

function relationId(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  return typeof value === 'object' ? (value as { id?: number }).id : (value as number)
}

/** Registered as an `afterChange` hook on the `Services` collection. */
export const generateServiceMockupHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context?.skipMockupHook) return doc

  const rawMediaId = relationId(doc.rawMedia)
  const prevRawMediaId = relationId(previousDoc?.rawMedia)
  if (!rawMediaId || rawMediaId === prevRawMediaId) return doc

  await req.payload.update({
    collection: 'services',
    id: doc.id,
    data: { mockupStatus: 'processing' },
    context: { skipMockupHook: true },
  })

  generateMockupFromRawMedia(req.payload, rawMediaId)
    .then((mockupMediaId) =>
      req.payload.update({
        collection: 'services',
        id: doc.id,
        data: { mockupMedia: mockupMediaId, mockupStatus: 'ready' },
        context: { skipMockupHook: true },
      }),
    )
    .catch((err) => {
      req.payload.logger.error(`Mockup generation failed for service ${doc.id}: ${err.message}`)
      return req.payload.update({
        collection: 'services',
        id: doc.id,
        data: { mockupStatus: 'failed' },
        context: { skipMockupHook: true },
      })
    })

  return doc
}

async function patchHeroServiceRow(payload: Payload, rowId: string, patch: Record<string, unknown>) {
  const current = await payload.findGlobal({ slug: 'homepage' })
  const heroServices = ((current as { heroServices?: Array<Record<string, unknown>> }).heroServices || []).map(
    (row) => {
      if (row.id !== rowId) {
        return { ...row, rawMedia: relationId(row.rawMedia), mockupMedia: relationId(row.mockupMedia) }
      }
      return { ...row, rawMedia: relationId(row.rawMedia), mockupMedia: relationId(row.mockupMedia), ...patch }
    },
  )
  await payload.updateGlobal({
    slug: 'homepage',
    data: { heroServices },
    context: { skipMockupHook: true },
  })
}

/** Registered as an `afterChange` hook on the `Homepage` global. */
export const generateHomepageMockupHook: GlobalAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context?.skipMockupHook) return doc

  const rows = (doc.heroServices || []) as Array<Record<string, unknown>>
  const prevRows = (previousDoc?.heroServices || []) as Array<Record<string, unknown>>

  for (const row of rows) {
    const prevRow = prevRows.find((r) => r.id === row.id)
    const rawMediaId = relationId(row.rawMedia)
    const prevRawMediaId = relationId(prevRow?.rawMedia)
    if (!rawMediaId || rawMediaId === prevRawMediaId) continue

    await patchHeroServiceRow(req.payload, row.id as string, { mockupStatus: 'processing' })

    generateMockupFromRawMedia(req.payload, rawMediaId)
      .then((mockupMediaId) =>
        patchHeroServiceRow(req.payload, row.id as string, { mockupMedia: mockupMediaId, mockupStatus: 'ready' }),
      )
      .catch((err) => {
        req.payload.logger.error(`Mockup generation failed for hero service ${row.id}: ${err.message}`)
        return patchHeroServiceRow(req.payload, row.id as string, { mockupStatus: 'failed' })
      })
  }

  return doc
}
