import type { Payload, PayloadRequest } from 'payload'

/*
  Turn a reviewed proposal into a client, an invoice and a journey.

  This is the half that writes. It runs once, when Ernest presses the button on
  the proposal, and never on upload: a model reading a PDF must not be able to
  email a stranger or raise an invoice on its own.

  WHAT IT DELIBERATELY DOES NOT DO ITSELF

  It does not send a single email. Creating the client with pipelineStatus 'won'
  is what fires the existing automation (Clients.ts afterChange -> the site's
  /api/client-won), which writes the contract, the welcome pack and the setup
  instructions, schedules the four emails and files all three documents against
  the client. Reimplementing any of that here would have produced a second
  onboarding that drifts from the first one.

  The invoice is created and left alone. It is not emailed, and nothing marks it
  sent: send-invoice-email.ts on the site is a separate deliberate act.

  ORDER MATTERS

  Client first, because the invoice and the steps both point at it, and because
  the currency on an invoice is read from the client's country. If the invoice
  or the steps fail afterwards, the client still exists and the failure is
  written into the log on the proposal rather than being swallowed: a half
  finished provision that says so can be finished by hand in a minute, and one
  that rolls the client back has already sent them a welcome email.
*/

type Result = {
  ok: boolean
  log: string[]
  clientId?: number | string
  invoiceId?: number | string
  invoiceNumber?: string
  error?: string
}

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

const addDays = (from: Date, days: number) => {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}

export async function provisionFromProposal(
  proposalId: string | number,
  payload: Payload,
  req?: PayloadRequest,
): Promise<Result> {
  const log: string[] = []

  const proposal: any = await payload.findByID({ collection: 'proposals', id: proposalId, depth: 0, req })
  if (!proposal) return { ok: false, log, error: 'That proposal does not exist.' }
  if (proposal.status === 'provisioned' && proposal.client) {
    return {
      ok: false,
      log,
      error: 'This proposal has already been used to create a client. Open the client instead.',
    }
  }

  /* The two things nothing can be built without. Everything else is optional
     and can be filled in on the client afterwards, but a client with no name
     cannot be told apart in a list, and one with no email cannot be sent the
     welcome email, the contract or the portal code, which is the whole point of
     setting them up. */
  const clientName = String(proposal.clientName || '').trim()
  const clientEmail = String(proposal.clientEmail || '').trim()
  if (!clientName) return { ok: false, log, error: 'Fill in the client name first. Nothing can be created without it.' }
  if (!clientEmail) {
    return {
      ok: false,
      log,
      error:
        'Fill in the email address first. The welcome email, the contract and the portal code all go to it, so creating the client without one sets up an onboarding that never reaches anybody.',
    }
  }

  const deliverables: string[] = Array.isArray(proposal.deliverables)
    ? proposal.deliverables.map((d: any) => String(d?.item || '').trim()).filter(Boolean)
    : []

  const lineItems: { description: string; quantity: number; rate: number }[] = Array.isArray(proposal.lineItems)
    ? proposal.lineItems
        .map((i: any) => ({
          description: String(i?.description || '').trim(),
          quantity: Number(i?.quantity) || 1,
          rate: Number(i?.rate) || 0,
        }))
        .filter((i: { description: string; rate: number }) => i.description && i.rate > 0)
    : []

  const start = proposal.startDate ? new Date(proposal.startDate) : new Date()
  const base = Number.isNaN(start.getTime()) ? new Date() : start

  // ── 1. The client ────────────────────────────────────────────────────────
  let client: any
  try {
    /* `as any` on the data because `accessCode` is a required field filled in
       by the collection's own beforeValidate hook, so the generated type asks
       for something no caller is meant to supply. */
    client = await payload.create({
      collection: 'clients',
      data: {
        clientName,
        contactName: proposal.contactName || undefined,
        clientEmail,
        phone: proposal.phone || undefined,
        country: proposal.country || undefined,
        service: proposal.service || undefined,
        package: proposal.packageName || undefined,
        price: typeof proposal.total === 'number' ? proposal.total : undefined,
        startDate: proposal.startDate || undefined,
        /* Won is not a label here, it is the trigger: the afterChange hook on
           clients posts to the site, which writes the three documents and
           schedules the four emails. */
        pipelineStatus: 'won',
        projectStatus: 'onboarding',
        source: 'other',
        slug: `${slugify(clientName) || 'client'}-${proposalId}`,
        notes: proposal.summary || undefined,
        proposalUrl: proposal.url || undefined,
        customizations: {
          duration: typeof proposal.durationMonths === 'number' ? proposal.durationMonths : undefined,
          depositPercent: typeof proposal.depositPercent === 'number' ? proposal.depositPercent : undefined,
          paymentTerms: proposal.paymentTerms || undefined,
          specialTerms: proposal.specialTerms || undefined,
          extraDeliverables: deliverables.length ? deliverables.join('\n') : undefined,
        },
      } as any,
      req,
    })
    log.push(`Client created: ${clientName}. The welcome email, contract and setup instructions are on their way.`)
  } catch (err: any) {
    return { ok: false, log, error: `The client could not be created: ${err?.message || String(err)}` }
  }

  // ── 2. The invoice, unsent ───────────────────────────────────────────────
  let invoice: any
  try {
    const items = lineItems.length
      ? lineItems
      : [
          {
            description: proposal.packageName || proposal.summary || 'Agreed scope of work',
            quantity: 1,
            rate: Number(proposal.total) || 0,
          },
        ]

    invoice = await payload.create({
      collection: 'invoices',
      data: {
        client: client.id,
        /* Left to the hook on the collection, which numbers it. A currency is
           passed only when the proposal actually named one, so otherwise the
           invoice takes it from the client's country, which is the rule the
           whole site prices by. */
        ...(proposal.currency ? { currency: proposal.currency } : {}),
        dateIssued: new Date().toISOString(),
        dueDate: addDays(base, 14).toISOString(),
        status: 'pending',
        depositPercent:
          typeof proposal.depositPercent === 'number' && proposal.depositPercent > 0
            ? proposal.depositPercent
            : 0,
        items,
        /* Same reason as the client above: `invoiceId` is required and is
           numbered by the hook on the collection. */
      } as any,
      req,
    })
    const total = items.reduce((sum, i) => sum + i.rate * i.quantity, 0)
    log.push(
      `Invoice ${invoice.invoiceId} drafted for ${invoice.currency} ${total.toLocaleString('en-US')}${
        invoice.depositPercent ? `, ${invoice.depositPercent}% deposit` : ''
      }. Nothing has been sent.`,
    )
  } catch (err: any) {
    log.push(`The invoice could not be created: ${err?.message || String(err)}. The client exists, so raise it by hand.`)
  }

  // ── 3. The journey ───────────────────────────────────────────────────────
  let steps = 0
  try {
    let template: any = null

    if (proposal.journeyTemplate) {
      template = await payload.findByID({
        collection: 'journey-templates',
        id: typeof proposal.journeyTemplate === 'object' ? proposal.journeyTemplate.id : proposal.journeyTemplate,
        depth: 0,
        req,
      })
    }

    if (!template && proposal.service) {
      const byService = await payload.find({
        collection: 'journey-templates',
        where: { service: { equals: proposal.service } },
        sort: '-isDefault',
        limit: 1,
        depth: 0,
        req,
      })
      template = byService.docs[0] || null
    }

    if (!template) {
      const fallback = await payload.find({
        collection: 'journey-templates',
        where: { isDefault: { equals: true } },
        limit: 1,
        depth: 0,
        req,
      })
      template = fallback.docs[0] || null
    }

    if (!template) {
      log.push('No journey template matched, so no steps were created. Build one under Journey Templates and they will be created next time.')
    } else {
      const templateSteps: any[] = Array.isArray(template.steps) ? template.steps : []
      for (const [index, step] of templateSteps.entries()) {
        await payload.create({
          collection: 'client-journey-steps',
          data: {
            client: client.id,
            title: step.title,
            detail: step.detail || undefined,
            owner: step.owner || 'quadem',
            stage: step.stage || 'onboarding',
            status: 'todo',
            dueDate: addDays(base, Number(step.dueOffsetDays) || 0).toISOString(),
            clientVisible: step.clientVisible !== false,
            order: index,
            sourceTemplate: template.id,
          },
          req,
        })
        steps += 1
      }
      log.push(`${steps} journey step${steps === 1 ? '' : 's'} created from "${template.name}".`)
    }
  } catch (err: any) {
    log.push(`The journey steps failed part way: ${err?.message || String(err)}. ${steps} were created.`)
  }

  // ── 4. Close the proposal ────────────────────────────────────────────────
  await payload.update({
    collection: 'proposals',
    id: proposalId,
    data: {
      status: 'provisioned',
      client: client.id,
      invoice: invoice?.id || undefined,
      provisionedAt: new Date().toISOString(),
      provisionLog: log.join('\n'),
    },
    context: { fromProvisioning: true },
    req,
  })

  return {
    ok: true,
    log,
    clientId: client.id,
    invoiceId: invoice?.id,
    invoiceNumber: invoice?.invoiceId,
  }
}
