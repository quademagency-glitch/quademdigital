/**
 * Client projects and the extras on tasks (spec 14.5): the rules that need no
 * database, so they can be tested.
 */

export const PROJECT_STATUSES = [
  { label: 'Planning', value: 'planning' },
  { label: 'In progress', value: 'active' },
  { label: 'With the client', value: 'review' },
  { label: 'Paused', value: 'paused' },
  { label: 'Done', value: 'done' },
] as const

export const DELIVERABLE_STATUSES = [
  { label: 'To do', value: 'todo' },
  { label: 'Doing', value: 'doing' },
  { label: 'Ready for review', value: 'review' },
  { label: 'Done', value: 'done' },
] as const

export const TASK_PRIORITIES = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
] as const

export const TASK_REPEATS = [
  { label: 'Does not repeat', value: 'none' },
  { label: 'Every working day', value: 'daily' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Every month', value: 'monthly' },
] as const
export type Repeat = (typeof TASK_REPEATS)[number]['value']

const DAY = 86_400_000
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6

/**
 * When the next copy of a repeating task is due, counted from when this one
 * was due (or from today when it had no date, or was finished late enough
 * that the next date has already gone). Daily skips weekends; monthly keeps
 * the day of the month, or the last day of a shorter month.
 */
export function nextDue(repeat: Repeat | string | null | undefined, due: string | null | undefined, today: string): string | null {
  if (!repeat || repeat === 'none') return null
  const base = new Date(`${(due || today).slice(0, 10)}T00:00:00.000Z`)
  const step = (d: Date): Date => {
    if (repeat === 'daily') {
      const n = new Date(d.getTime() + DAY)
      while (isWeekend(n)) n.setUTCDate(n.getUTCDate() + 1)
      return n
    }
    if (repeat === 'weekly') return new Date(d.getTime() + 7 * DAY)
    // Monthly: the same day next month, or that month's last day.
    const wanted = base.getUTCDate()
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    return new Date(Date.UTC(y, m, Math.min(wanted, last)))
  }
  let next = step(base)
  // Finished long after it was due: the next one is the first date still to come.
  while (next.toISOString().slice(0, 10) <= today) next = step(next)
  return next.toISOString().slice(0, 10)
}

/** Checklist rows from a task: "3 of 5". */
export const checklistDone = (rows: { done?: boolean | null }[] | null | undefined) => {
  const all = rows ?? []
  return { done: all.filter((r) => r.done).length, total: all.length }
}
