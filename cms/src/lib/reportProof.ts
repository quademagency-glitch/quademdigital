/*
  Proof of the work a daily report counts (Settings > Job roles > Daily report).

  Each count in a job role says what proves one of it:
    none   nothing extra
    words  the words sent or received, pasted when the contact is recorded
    link   a link, such as to a published post
    file   a screenshot or a file
  and whether that proof is required for it to count. A pipeline count can
  also ask for a screenshot of the message, no, optional or required.

  Pipeline counts are proved where the work is recorded, on the lead
  (lib/leadRules.ts /:id/log); typed counts with proof are added one item at a
  time (collections/WorkItems.ts) and the count is the number of items. Pure,
  so the rules are tested.
*/

export type Proof = 'none' | 'words' | 'link' | 'file'
export type ReportCountRule = { label: string; source: string; proof?: Proof | null; proofRequired?: boolean | null; screenshot?: 'no' | 'optional' | 'required' | null }

/** The note a contact record gets when nothing is typed: it says nothing about what was sent. */
export const AUTO_NOTES = new Set(['First message sent', 'Follow-up sent', 'They replied', 'Call', 'Proposal sent', 'Note'])

const SOURCE_OF_TYPE: Record<string, string> = { 'first-message': 'firstMessages', 'follow-up': 'followUps', reply: 'replies' }

/** The job role's rule for a kind of contact, if the role counts it. */
export function ruleForType(counts: ReportCountRule[] | null | undefined, type: string): ReportCountRule | null {
  const source = SOURCE_OF_TYPE[type]
  return source ? ((counts ?? []).find((c) => c.source === source) ?? null) : null
}

/** Whether a contact record carries real words, not the note filled in for it. */
export const hasWords = (note: unknown) => {
  const t = String(note ?? '').trim()
  return t.length > 0 && !AUTO_NOTES.has(t)
}

/** What is missing from a contact being recorded, in the words the person sees, or null. */
export function logProblem(rule: ReportCountRule | null, type: string, note: unknown, screenshot: unknown): string | null {
  if (!rule) return null
  if (rule.proof === 'words' && rule.proofRequired !== false && !hasWords(note)) {
    return type === 'reply' ? 'Paste or sum up what they said. It is needed for the reply to count.' : 'Paste the message you sent. It is needed for it to count.'
  }
  if (rule.screenshot === 'required' && !screenshot) return 'Add a screenshot of the message. Your role needs one for it to count.'
  return null
}

const LINK = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

/** What is missing from an item of typed work, or null. */
export function itemProblem(rule: ReportCountRule | null, item: { text?: unknown; link?: unknown; file?: unknown }): string | null {
  if (!rule) return 'Your job role does not count that. Refresh the page and try again.'
  const text = String(item.text ?? '').trim()
  const link = String(item.link ?? '').trim()
  if (link && !LINK.test(link)) return 'That link does not look right. Paste the whole address, starting with https://.'
  if (rule.proofRequired === false) return text || link || item.file ? null : 'Say what it was, or add its link or file.'
  if (rule.proof === 'link' && !link) return 'Paste the link to it. It is needed for it to count.'
  if (rule.proof === 'file' && !item.file) return 'Add the screenshot or file. It is needed for it to count.'
  if (rule.proof === 'words' && !text) return 'Say what it was. It is needed for it to count.'
  if (!text && !link && !item.file) return 'Say what it was, or add its link or file.'
  return null
}

/** A typed count is added one item at a time when its role asks for proof. */
export const byItems = (rule: Pick<ReportCountRule, 'source' | 'proof'> | null | undefined) => Boolean(rule && rule.source === 'typed' && rule.proof && rule.proof !== 'none')
