import type { PayloadRequest } from 'payload'

/**
 * One entry in the audit log (collections/AuditLog.ts). It never throws: a
 * record that could not be written must not undo the change it describes, so
 * a failure goes to the log instead.
 */
export type AuditEntry = {
  action: string
  summary: string
  person?: number | string | null
  subjectType?: string
  subjectId?: number | string | null
  reason?: string | null
  changes?: { field: string; from: unknown; to: unknown }[]
  actor?: number | string | null
}

export async function audit(req: PayloadRequest, e: AuditEntry) {
  try {
    await req.payload.create({
      collection: 'audit-log',
      data: {
        action: e.action,
        summary: e.summary.slice(0, 500),
        actor: (e.actor ?? req.user?.id ?? null) as never,
        person: (e.person ?? null) as never,
        subjectType: e.subjectType ?? null,
        subjectId: e.subjectId == null ? null : String(e.subjectId),
        reason: e.reason ?? null,
        changes: e.changes?.length ? e.changes : null,
      },
      overrideAccess: true,
      req,
    })
  } catch (err) {
    req.payload.logger.error({ err, action: e.action }, 'Could not write to the audit log')
  }
}

/** "2026-11-02" → "2 Nov 2026", the way dates read everywhere else. */
export const dayText = (iso: unknown) => {
  const d = new Date(String(iso ?? ''))
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' }).format(d)
}

const SYMBOL: Record<string, string> = { GHS: 'GH₵', NGN: '₦', USD: '$', KES: 'KSh ', ZAR: 'R', GBP: '£', EUR: '€' }
const money = (minor: unknown, currency?: string | null) =>
  minor === null || minor === undefined || minor === '' ? '' : `${SYMBOL[String(currency ?? '')] ?? ''}${(Number(minor) / 100).toLocaleString('en-GB')}`

const TERMS_LABELS: Record<string, string> = {
  currency: 'Paid in',
  'commission.share': 'Commission on a new deal',
  'commission.retainerFromMonth': 'Retainer rate from month',
  'commission.retainerRate': 'Retainer rate',
  'commission.afterSalaryRate': 'Commission after the salary starts',
  'salaryTrigger.monthlyGHSMinor': 'Salary trigger each month',
  'salaryTrigger.months': 'Salary trigger months in a row',
  'salary.amountMinor': 'Monthly salary',
  'salary.yearlyRaisePercent': 'Yearly rise, %',
  'foundingPartner.totalGHSMinor': 'Founding Partner total',
  'foundingPartner.retainerGHSMinor': 'Founding Partner from retainers',
  'foundingPartner.withinMonths': 'Founding Partner within months',
  'dataAllowance.amountMinor': 'Data allowance',
  'dataAllowance.reportsNeeded': 'Reports needed for the allowance',
  'leave.daysPerYear': 'Days off a year',
  'targets.countedDealsPerMonth': 'Counted deals a month',
  'missedMonths.graceMonths': 'Missed months not counted for the first',
  'missedMonths.meetingAt': 'Review meeting at missed months',
  'missedMonths.endAt': 'Agreement ends at missed months',
}

/** The difference between two sets of terms, in words and money. */
export function termsChanges(before: Record<string, any> | null | undefined, after: Record<string, any>) {
  const out: { field: string; from: unknown; to: unknown }[] = []
  const show = (path: string, v: unknown, currency?: string | null) => {
    if (v === null || v === undefined || v === '') return '-'
    if (path.endsWith('GHSMinor')) return money(v, 'GHS')
    if (path.endsWith('amountMinor')) return money(v, currency)
    return String(v)
  }
  for (const path of Object.keys(TERMS_LABELS)) {
    const get = (o: Record<string, any> | null | undefined) => path.split('.').reduce<any>((x, k) => (x == null ? x : x[k]), o)
    const a = get(before)
    const b = get(after)
    if (String(a ?? '') !== String(b ?? '')) {
      out.push({ field: TERMS_LABELS[path], from: show(path, a, before?.currency), to: show(path, b, after.currency) })
    }
  }
  return out
}
