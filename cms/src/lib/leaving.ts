/**
 * Ending an agreement and coming back (spec 14.1).
 *
 * The status follows the end date. An end date in the future puts someone On
 * notice; on that date the scheduled job ends the agreement. An end date today
 * or earlier ends it at once, whichever way it was set: the portal's End
 * agreement, the edit screen or the CMS admin.
 *
 * Pure, so the rules can be tested without a database. The side effects that
 * follow an end (sign-ins, leads, tasks) live in teamAccounts.ts.
 */

export type ChecklistRow = { item: string; done?: boolean | null; doneAt?: string | null; by?: unknown }

/** The exit checklist (spec 14.1). The salary line only for someone whose salary started. */
export const exitChecklist = (salaryStarted: boolean): ChecklistRow[] =>
  [
    'Brand files and logins returned',
    'Left the WhatsApp groups',
    'Handover notes received',
    'Final commission paid',
    'Final data allowance settled',
    ...(salaryStarted ? ['Final salary paid'] : []),
  ].map((item) => ({ item, done: false }))

export type LeavingInput = {
  before?: string | null
  /** The status asked for, if any. */
  asked?: string | null
  /** The end date asked for: a day, null to clear it, undefined if not sent. */
  endedAt?: string | null
  originalEndedAt?: string | null
  statusSince?: string | null
  today: string
}

export type LeavingOutcome = {
  status?: string
  endedAt?: string | null
  statusSince?: string
  /** Start the exit checklist if there is none. */
  openChecklist?: boolean
  /** Clear the checklist: the end was called off. */
  clearChecklist?: boolean
  /** Coming back after an ended agreement: keep the old one in pastAgreements. */
  rehire?: boolean
  error?: string
}

const day = (d?: string | null) => (d ? String(d).slice(0, 10) : null)

export function leavingChange(i: LeavingInput): LeavingOutcome {
  const before = i.before ?? null
  const asked = i.asked ?? null
  const status = asked ?? before
  const dateSent = i.endedAt !== undefined
  const original = day(i.originalEndedAt)
  const endedAt = dateSent ? day(i.endedAt) : original

  // Back from an ended agreement.
  if (before === 'ended' && asked && asked !== 'ended') {
    return { rehire: true, endedAt: null, clearChecklist: true }
  }

  // Notice called off.
  if (before === 'on-notice' && asked && asked !== 'on-notice' && asked !== 'ended') {
    return { endedAt: null, clearChecklist: true }
  }

  // A new end date on its own, on someone still working, means the agreement is ending.
  const newDate = dateSent && Boolean(endedAt) && endedAt !== original && (!asked || asked === before)

  if (status === 'on-notice' || status === 'ended' || newDate) {
    if (status === 'on-notice' && !endedAt) return { error: 'Set the day the agreement ends.' }
    const when = endedAt ?? day(i.statusSince) ?? i.today
    if (when <= i.today) {
      return { status: 'ended', endedAt: when, statusSince: when, openChecklist: true }
    }
    // An end in the future, however it was asked for, is notice until that day.
    return { status: 'on-notice', endedAt: when, openChecklist: true }
  }

  // Still working: no end date, or the exit rules would start applying to their commission.
  if (endedAt) return { endedAt: null }
  return {}
}

/** The last day a lead they found can still earn, if its deal is accepted and first paid by then (Agreement §11). */
export const earnUntil = (endedAt: string) => new Date(new Date(`${day(endedAt)}T00:00:00Z`).getTime() + 60 * 86_400_000).toISOString().slice(0, 10)

/** Lead stages that are finished, so the lead stays where it is when someone leaves. */
export const CLOSED_LEAD = ['won', 'lost', 'archived']
