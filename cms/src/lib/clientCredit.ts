import type { CollectionBeforeChangeHook, Field, FieldAccess } from 'payload'
import { adminOrSiteField } from '../access/roles'
import { refId } from './moneyContext'

/**
 * A team member's view of a client (spec 3.2): the clients credited to them,
 * and on those only these fields. Everything else on the record, the access
 * code, the contact details, the notes, the onboarding state, stays with
 * Ernest and the website's account.
 *
 * `creditTo` and `creditType` are on the list for a reason that is easy to
 * undo by accident. Payload checks field read access against the whole query
 * it runs, including the `creditTo = me` filter the collection's own access
 * rule adds, so hiding `creditTo` makes every team read fail with "The
 * following path cannot be queried". The value is always the reader anyway.
 *
 * The same check is what stops a team member filtering on a hidden field,
 * such as `where[accessCode][like]=a`, to learn it a character at a time.
 * That protection exists only because these are real field access rules
 * rather than an afterRead hook that deletes keys from the response.
 */
export const TEAM_CLIENT_FIELDS: ReadonlySet<string> = new Set([
  'clientName',
  'service',
  'package',
  'price',
  'currency',
  'pipelineStatus',
  'projectStatus',
  'startDate',
  'creditTo',
  'creditType',
])

const adminOrSiteAnd =
  (existing?: FieldAccess): FieldAccess =>
  async (args) =>
    Boolean(adminOrSiteField(args)) && (existing ? Boolean(await existing(args)) : true)

/**
 * Hide every named field not in `allowed` from anyone but admins and the
 * website, walking through rows, collapsibles and unnamed tabs, which hold
 * fields without being fields themselves. A named group or array is hidden as
 * a whole. Any read rule a field already has still applies on top.
 */
export function limitTeamRead(fields: Field[], allowed: ReadonlySet<string>): Field[] {
  return fields.map((field): Field => {
    if (field.type === 'ui') return field
    if ('name' in field && field.name) {
      if (allowed.has(field.name)) return field
      return { ...field, access: { ...field.access, read: adminOrSiteAnd(field.access?.read) } } as Field
    }
    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({
          ...tab,
          // A named tab stores its fields under its name; if the name is not
          // allowed, nothing inside it is either.
          fields: limitTeamRead(tab.fields, 'name' in tab && tab.name && !allowed.has(tab.name) ? new Set() : allowed),
        })),
      }
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: limitTeamRead(field.fields, allowed) } as Field
    }
    return field
  })
}

/**
 * Credit a client to whoever worked its lead, when nobody has said otherwise.
 *
 * A proposal carries its credit onto the client it provisions, but a client
 * created any other way had none: neither one typed in with a lead picked, nor
 * the one a lead marked Won creates for itself (hooks/convertWonLeadToClient).
 * Neither then reached the team member's My clients.
 *
 * Same rule as a deal (lib/deals.ts): the lead's team assignee gets the credit,
 * Sourced if they also own the lead and Handed over if not. Ernest's own and
 * inbound leads credit nobody. A credit someone has chosen is never replaced,
 * and one deliberately cleared stays cleared unless the lead itself changes.
 */
export const creditClientFromLead: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const merged: Record<string, unknown> = { ...(originalDoc ?? {}), ...data }
  const leadId = refId(merged.sourceLead)
  if (!leadId || refId(merged.creditTo)) return data

  const leadChanged = leadId !== refId(originalDoc?.sourceLead)
  const wasCredited = refId(originalDoc?.creditTo) !== null
  if (operation === 'update' && wasCredited && !leadChanged) return data

  const lead = await req.payload
    .findByID({ collection: 'leads', id: leadId, depth: 1, overrideAccess: true, req })
    .catch(() => null)
  const assignee = lead?.assignedTo
  if (!assignee || typeof assignee !== 'object' || (assignee as { role?: string }).role !== 'team') return data

  data.creditTo = assignee.id
  data.creditType = refId(lead.owner) === Number(assignee.id) ? 'sourced' : 'handed'
  return data
}
