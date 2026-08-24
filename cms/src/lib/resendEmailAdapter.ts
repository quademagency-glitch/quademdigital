import type { EmailAdapter, SendEmailOptions } from 'payload'

/**
 * Lets the CMS send email.
 *
 * Until now Payload had no email adapter at all, so it wrote messages to the
 * container log and carried on. The visible cost was password reset: the admin
 * had a "forgot password" form that took an address, said something reassuring
 * and sent nothing, which is worse than not offering it.
 *
 * Written against Resend's REST API rather than pulling in
 * `@payloadcms/email-resend`. A new dependency means regenerating
 * `pnpm-lock.yaml`, and the Dockerfile installs with `--frozen-lockfile`, so a
 * mismatch there fails the deploy outright. One fetch call is not worth that
 * risk.
 *
 * `ernest@` is the sender, not `hello@`. hello@ is not a real mailbox: it hard
 * bounced on 2026-06-05 and Resend has it suppressed, which is what silently
 * swallowed 71 days of lead notifications.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Resend wants a string or an array of strings. Payload types recipients as
 * nodemailer's, which is a string, a `{ name, address }` object, or an array
 * of either, so all three shapes have to be flattened here. A bare object was
 * reaching Resend as the literal text "[object Object]" until this handled it.
 */
const toAddressList = (value: unknown): string[] => {
  const one = (v: any): string =>
    typeof v === 'string'
      ? v.trim()
      : v?.address
        ? (v.name ? `${v.name} <${v.address}>` : String(v.address))
        : ''
  if (!value) return []
  if (Array.isArray(value)) return value.map(one).filter(Boolean)
  if (typeof value === 'object') return [one(value)].filter(Boolean)
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const resendAdapter = (args: {
  apiKey: string
  defaultFromAddress: string
  defaultFromName: string
}): EmailAdapter<unknown> => {
  const { apiKey, defaultFromAddress, defaultFromName } = args

  return ({ payload }) => ({
    name: 'resend-rest',
    defaultFromAddress,
    defaultFromName,
    sendEmail: async (message: SendEmailOptions) => {
      const to = toAddressList(message.to)
      if (!to.length) {
        payload.logger.error('Refusing to send an email with no recipient.')
        return
      }

      const from = toAddressList(message.from)[0] || `${defaultFromName} <${defaultFromAddress}>`

      const body: Record<string, unknown> = {
        from,
        to,
        subject: message.subject || '(no subject)',
      }
      if (message.html) body.html = String(message.html)
      if (message.text) body.text = String(message.text)
      if (!body.html && !body.text) body.text = ''

      const cc = toAddressList(message.cc)
      const bcc = toAddressList(message.bcc)
      const replyTo = toAddressList(message.replyTo)
      if (cc.length) body.cc = cc
      if (bcc.length) body.bcc = bcc
      if (replyTo.length) body.reply_to = replyTo

      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        /*
          Log the reason and rethrow. Payload's password reset swallows a
          failure and still tells the user to check their inbox, so a silent
          return here would put the feature straight back where it was.
        */
        const detail = await res.text().catch(() => '')
        payload.logger.error(
          { status: res.status, detail: detail.slice(0, 500), to },
          'Resend refused an email from the CMS',
        )
        throw new Error(`Resend returned ${res.status}`)
      }

      return res.json()
    },
  })
}
