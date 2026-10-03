/**
 * Working days are Monday to Friday, in Africa/Accra (GMT all year, so a UTC
 * date is an Accra date). Public holidays join this when ops-settings holds
 * them (spec 14.6).
 */

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6

/** The day `n` working days after `from`, as yyyy-mm-dd at midnight UTC. */
export const addWorkingDays = (from: string | Date, n: number): string => {
  const d = new Date(from)
  d.setUTCHours(0, 0, 0, 0)
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (!isWeekend(d)) left -= 1
  }
  return d.toISOString()
}

/** Midnight today, Accra. */
export const todayStart = (): string => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
