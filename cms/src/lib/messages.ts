/**
 * Messages, channels, polls and how each person hears about things (spec
 * 14.8): the rules that need no database, so they can be tested.
 */

export const CHANNEL_KINDS = [
  { label: 'Everyone', value: 'everyone' },
  { label: 'A job role', value: 'role' },
  { label: 'Two people', value: 'direct' },
] as const

/** One key per channel, so the same conversation is never made twice. */
export const channelKey = {
  everyone: () => 'everyone',
  role: (roleId: unknown) => `role:${String(roleId)}`,
  /** The same two people, whichever of them starts it. */
  direct: (a: unknown, b: unknown) => `dm:${[String(a), String(b)].sort((x, y) => Number(x) - Number(y) || x.localeCompare(y)).join(':')}`,
}

/** A message as a line in a list: one line, at most 120 characters. */
export const preview = (body: string | null | undefined, hasFile = false) => {
  const text = String(body ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return hasFile ? 'Sent a file' : ''
  return text.length > 120 ? `${text.slice(0, 119).trimEnd()}…` : text
}

export const NOTIFY_CHOICES = [
  { label: 'Email me straight away', value: 'now' },
  { label: 'One email a day with everything', value: 'digest' },
  { label: 'In the portal only', value: 'portal' },
] as const
export type NotifyChoice = (typeof NOTIFY_CHOICES)[number]['value']

/**
 * What happens to the email side of a notice, by the person's choice. An
 * important notice (a written warning, the end of an agreement) is emailed
 * whatever they chose, because it must reach them.
 */
export function emailFor(choice: string | null | undefined, n: { email?: boolean; important?: boolean }): 'now' | 'digest' | 'none' {
  if (n.email === false) return 'none'
  if (n.important) return 'now'
  if (choice === 'portal') return 'none'
  if (choice === 'digest') return 'digest'
  return 'now'
}

/** A poll's results: each choice with its count and share, in the poll's order. */
export function tally(choices: { id?: string | null; text: string }[], votes: { choice?: string | null }[]) {
  const total = votes.length
  return choices.map((c) => {
    const count = votes.filter((v) => v.choice === c.id).length
    return { id: c.id ?? '', text: c.text, count, share: total ? Math.round((count / total) * 100) : 0 }
  })
}
