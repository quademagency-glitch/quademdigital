import { describe, expect, it } from 'vitest'
import type { CollectionAfterErrorHook } from 'payload'
import { securityChallengeResponse } from '../../src/lib/securityChallengeResponse'

const challenge = 'ab'.repeat(32)
const run = (properties: Record<string, unknown>) => securityChallengeResponse({
  collection: { slug: 'users' } as Parameters<CollectionAfterErrorHook>[0]['collection'],
  context: {},
  req: {} as Parameters<CollectionAfterErrorHook>[0]['req'],
  // Deliberately not an APIError instance: instrumentation and REST can load
  // separate constructors in the production build.
  error: Object.assign(new Error('Enter the six-digit code sent to your email.'), {
    name: 'n', status: 428, isPublic: true, data: { securityChallenge: challenge }, ...properties,
  }),
})

describe('Public email-code response across server bundles', () => {
  it('restores the challenge when the framework only preserved the message', async () => {
    expect(await run({})).toEqual({
      status: 428,
      response: { errors: [{ message: 'Enter the six-digit code sent to your email.', data: { securityChallenge: challenge } }] },
    })
  })

  it('never serializes additional error data', async () => {
    const result = await run({ data: { securityChallenge: challenge, password: 'private', securityCode: '123456', token: 'private' } })
    expect(result?.response?.errors?.[0].data).toEqual({ securityChallenge: challenge })
    expect(result?.response).not.toHaveProperty('stack')
  })

  it.each([
    { isPublic: false }, { isPublic: undefined }, { status: 500 }, { status: 401 }, { status: 429 },
    { data: undefined }, { data: { securityChallenge: '' } }, { data: { securityChallenge: '123456' } },
    { data: { securityChallenge: { value: challenge } } },
  ])('leaves private, unrelated and malformed errors unchanged: %j', async (properties) => {
    expect(await run(properties)).toBeUndefined()
  })
})
