import type { CollectionAfterErrorHook } from 'payload'

/** Keep the public code challenge intact across Next's separate server bundles. */
export const securityChallengeResponse: CollectionAfterErrorHook = ({ error }) => {
  // Production initializes Payload in instrumentation before REST handles a
  // request. Its APIError constructor differs from the REST bundle's, so
  // Payload's instanceof-based formatter drops data and leaves only a message.
  const challengeError = error as Error & {
    status?: number
    isPublic?: boolean
    data?: { securityChallenge?: unknown; method?: unknown }
  }
  const challenge = challengeError.data?.securityChallenge
  // Which code the form should ask for: an email code, or one from an authenticator app.
  const method = challengeError.data?.method === 'app' ? 'app' : 'email'
  if (challengeError.status !== 428 || challengeError.isPublic !== true ||
    typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge)) return

  // Return only the opaque challenge that the sign-in form needs. Never copy
  // arbitrary error data, the submitted password/code, or a session token.
  return {
    status: 428,
    response: { errors: [{ message: error.message, data: { securityChallenge: challenge, method } }] },
  }
}
