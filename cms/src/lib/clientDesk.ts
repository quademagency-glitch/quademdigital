import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { generateAccessCode } from './accessCode'
import { audit } from './audit'
import { pickTemplate } from './onboardingKit'
import { LABELS, ONBOARDING_STEPS } from './onboarding'
import { button, escape, firstName, layout } from './teamEmails'

/**
 * What the founder portal does to a client that a plain REST save cannot:
 * email the client their portal code, issue a new code, and give a client
 * added by hand the usual journey steps from a template. Founder only.
 *
 * Everything else on the client page (details, stage, timeline, deliverables,
 * journey steps) is an ordinary save through the REST API with the founder's
 * own sign-in, so the collection's hooks and history apply as in the CMS.
 */

export const CLIENT_PORTAL_URL = 'https://quademdigital.com/portal/'

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The client's code, with the link to their portal. */
export const clientCodeEmail = ({ name, business, code }: { name?: string | null; business?: string | null; code: string }) => {
  const first = firstName(name)
  const hello = first ? `Hello ${escape(first)},` : 'Hello,'
  return {
    subject: 'Your Quadem client portal code',
    html: layout(`<p style="margin:0 0 12px">${hello}</p>
<p style="margin:0 0 12px">Here is the code for ${business ? `the ${escape(business)} client portal` : 'your client portal'}, where you can follow your project, see the files we share and your invoices.</p>
<p style="margin:16px 0 4px;color:#5b6474;font-size:14px">Your code</p>
<p style="margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:2px">${escape(code)}</p>
${button(CLIENT_PORTAL_URL, 'Open your portal')}
<p style="margin:24px 0 0;color:#5b6474;font-size:14px">Keep this code private: anyone with it can open your portal. Reply to this email if you did not expect it.</p>`),
    text: `${first ? `Hello ${first},` : 'Hello,'}

Here is the code for ${business ? `the ${business} client portal` : 'your client portal'}, where you can follow your project, see the files we share and your invoices.

Your code: ${code}

Open your portal: ${CLIENT_PORTAL_URL}

Keep this code private: anyone with it can open your portal. Reply to this email if you did not expect it.

Quadem Digital`,
  }
}

type Client = { id: number | string; clientName?: string | null; contactName?: string | null; clientEmail?: string | null; accessCode?: string | null; service?: string | null; startDate?: string | null }

const denied = (req: PayloadRequest) => (hasRole(req.user, 'admin') ? null : Response.json({ error: 'Only the founder can do this.' }, { status: req.user ? 403 : 401 }))

async function loadClient(req: PayloadRequest): Promise<Client | Response> {
  const id = (req.routeParams as { id?: string } | undefined)?.id
  if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'That client is not there.' }, { status: 404 })
  const client = await req.payload.findByID({ collection: 'clients', id: Number(id), depth: 0, overrideAccess: true, req, disableErrors: true })
  return client ? (client as unknown as Client) : Response.json({ error: 'That client is not there.' }, { status: 404 })
}

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function sendCode(req: PayloadRequest, client: Client, code: string) {
  const mail = clientCodeEmail({ name: client.contactName || client.clientName, business: client.clientName, code })
  await req.payload.sendEmail({ to: client.clientEmail, subject: mail.subject, html: mail.html, text: mail.text })
}

const DAY = 86_400_000

export const clientDeskEndpoints: Endpoint[] = [
  {
    /*
      An onboarding email that may or may not have gone out (its provider key
      expired before the answer came back): Ernest checks Resend and says which
      (CMS review, 8 October 2026). Sent marks it done; not sent clears it so it
      goes with a new key. Either way onboarding carries on from there.
    */
    path: '/:id/onboarding-reconcile',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const client = await loadClient(req)
      if (client instanceof Response) return client
      const body = ((await req.json?.().catch(() => null)) ?? {}) as { sent?: unknown }
      if (typeof body.sent !== 'boolean') return Response.json({ error: 'Say whether the email went out.' }, { status: 400 })
      const state = ((client as { onboardingState?: unknown }).onboardingState ?? {}) as { status?: string; steps?: Record<string, Record<string, unknown>> }
      if (state.status !== 'reconcile') return Response.json({ error: 'No email is waiting to be checked.' }, { status: 409 })
      const step = ONBOARDING_STEPS.find((s) => !s.startsWith('file') && state.steps?.[s] && state.steps[s].status !== 'complete')
      if (!step) return Response.json({ error: 'No email is waiting to be checked.' }, { status: 409 })
      const steps = { ...(state.steps ?? {}) }
      if (body.sent) steps[step] = { ...steps[step], status: 'complete', result: { reconciled: 'sent', by: req.user?.id ?? null, at: new Date().toISOString() } }
      else delete steps[step]
      const said = `${LABELS[step]}: ${body.sent ? 'marked as sent' : 'to be sent again'} by Ernest.`
      await req.payload.db.updateOne({ collection: 'clients', id: client.id, data: { onboardingState: { ...state, steps, status: 'failed', updatedAt: new Date().toISOString() }, onboardingStatus: said }, returning: false, req })
      await req.payload.update({ collection: 'clients', id: client.id, data: { retryOnboarding: true } as never, overrideAccess: true, req })
      await audit(req, { action: 'client.onboarding-reconciled', summary: `${client.clientName ?? `Client ${client.id}`}: ${said}`, subjectType: 'clients', subjectId: client.id })
      return Response.json({ ok: true, step: LABELS[step], sent: body.sent })
    },
  },
  {
    // Email the client their current code and the portal link.
    path: '/:id/send-code',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const client = await loadClient(req)
      if (client instanceof Response) return client
      if (!EMAIL_OK.test(client.clientEmail ?? '')) return Response.json({ error: 'Add the client’s email address first.' }, { status: 400 })
      if (!client.accessCode) return Response.json({ error: 'This client has no code yet. Issue one first.' }, { status: 400 })
      try {
        await sendCode(req, client, client.accessCode)
      } catch (err) {
        req.payload.logger.error({ err, client: client.id }, 'The client portal code email failed')
        return Response.json({ error: 'The email could not be sent just now. Try again in a minute.' }, { status: 502 })
      }
      await audit(req, { action: 'client.code-sent', summary: `Client portal code emailed to ${client.clientName ?? `client ${client.id}`}`, subjectType: 'clients', subjectId: client.id })
      return Response.json({ ok: true, to: client.clientEmail })
    },
  },
  {
    // A new code; the old one stops working at once. Optionally emails it.
    path: '/:id/new-code',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const client = await loadClient(req)
      if (client instanceof Response) return client
      const { send } = await body(req)
      if (send && !EMAIL_OK.test(client.clientEmail ?? '')) return Response.json({ error: 'Add the client’s email address first, or issue the code without emailing it.' }, { status: 400 })
      const code = generateAccessCode()
      await req.payload.update({ collection: 'clients', id: client.id, data: { accessCode: code } as never, overrideAccess: true, req })
      let emailed = false
      if (send) {
        try {
          await sendCode(req, client, code)
          emailed = true
        } catch (err) {
          req.payload.logger.error({ err, client: client.id }, 'The new client portal code email failed')
        }
      }
      await audit(req, {
        action: 'client.code-changed',
        summary: `New client portal code for ${client.clientName ?? `client ${client.id}`}${emailed ? ', emailed to them' : ''}`,
        subjectType: 'clients',
        subjectId: client.id,
      })
      return Response.json({ ok: true, emailed, to: emailed ? client.clientEmail : null })
    },
  },
  {
    // The usual steps for the client's service, dated from their start date,
    // for a client added by hand (provisioning a deal does this itself).
    path: '/:id/journey-from-template',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const client = await loadClient(req)
      if (client instanceof Response) return client
      const { template: chosen, append } = await body(req)
      if (chosen != null && chosen !== '' && !/^\d+$/.test(String(chosen))) return Response.json({ error: 'That template is not there.' }, { status: 404 })
      const find = (where: Record<string, unknown>) =>
        req.payload.find({ collection: 'journey-templates', where: where as never, limit: 1, depth: 0, overrideAccess: true, req }).then((r) => r.docs[0] ?? null)
      // One chosen by hand is used as it is; otherwise the ready one for their service.
      const template = chosen ? await find({ id: { equals: Number(chosen) } }) : await pickTemplate(req.payload, client.service, req)
      if (!template) return Response.json({ error: chosen ? 'That template is not there.' : 'No ready template matches this service. Choose one, or add the steps one by one.' }, { status: 404 })

      const existing = await req.payload.find({ collection: 'client-journey-steps', where: { client: { equals: client.id } }, sort: '-order', limit: 1, depth: 0, overrideAccess: true, req })
      if (existing.totalDocs && !append) {
        return Response.json({ error: `This client already has ${existing.totalDocs} step${existing.totalDocs === 1 ? '' : 's'}. Add the template's steps after them, or add steps one by one.`, existing: existing.totalDocs }, { status: 409 })
      }
      const base = client.startDate && Number.isFinite(Date.parse(client.startDate)) ? Date.parse(client.startDate) : Date.now()
      let order = existing.docs[0] ? Number((existing.docs[0] as { order?: number }).order ?? 0) + 1 : 0
      let created = 0
      for (const step of (template as { steps?: Record<string, unknown>[] }).steps ?? []) {
        const title = String(step?.title ?? '').trim()
        if (!title) continue
        await req.payload.create({
          collection: 'client-journey-steps',
          data: {
            client: client.id,
            title,
            detail: (step.detail as string) || undefined,
            owner: (step.owner as string) || 'quadem',
            stage: (step.stage as string) || 'onboarding',
            status: 'todo',
            dueDate: new Date(base + (Number(step.dueOffsetDays) || 0) * DAY).toISOString(),
            clientVisible: step.clientVisible !== false,
            order: order++,
            sourceTemplate: template.id,
          } as never,
          overrideAccess: true,
          req,
        })
        created += 1
      }
      const name = (template as { name?: string }).name ?? 'a template'
      await audit(req, { action: 'client.journey-added', summary: `${created} journey step${created === 1 ? '' : 's'} from "${name}" added to ${client.clientName ?? `client ${client.id}`}`, subjectType: 'clients', subjectId: client.id })
      return Response.json({ ok: true, created, template: name })
    },
  },
]
