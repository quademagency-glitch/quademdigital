import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { audit } from '../lib/audit'
import { APPLICANT_STAGES, HEARD_FROM, STAGE_TEXT, accraTime, checkApplication, googleCalendarLink, icsInvite } from '../lib/hiring'
import { adminIds, notify } from '../lib/notify'
import { button, escape, firstName, layout } from '../lib/teamEmails'
import { reportProblem } from '../lib/problems'

/**
 * Someone who applied for an opening (spec 14.4), and where they are:
 * Applied, Screened, Interview, Trial task, Offer, Hired or Not hired. Each
 * stage can carry notes and a score from 1 to 5.
 *
 * Ernest only. Applicants never sign in: they apply on the team portal's
 * public jobs page, which posts to /api/applicants/apply without a key. Their
 * CV is a private document (kind applicant) only Ernest can open.
 */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
const day = 86_400_000

/* At most this many applications to one job in a day. The form is public; this bounds what a flood could do. */
const DAILY_CAP = 200
const recent = new Map<string, number[]>()
const underCap = (openingId: string) => {
  const now = Date.now()
  const list = (recent.get(openingId) ?? []).filter((t) => now - t < day)
  if (list.length >= DAILY_CAP) return false
  list.push(now)
  recent.set(openingId, list)
  return true
}

/** A CV: PDF or Word, up to 5 MB, and the bytes must say so too. */
const CV_TYPES: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', magic: [0x50, 0x4b, 0x03, 0x04] },
}
const MAX_CV = 5 * 1024 * 1024

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

async function openingOf(req: PayloadRequest, id: unknown) {
  return req.payload.findByID({ collection: 'openings', id: Number(idOf(id)), depth: 0, overrideAccess: true, req }).catch(() => null)
}

export const Applicants: CollectionConfig = {
  slug: 'applicants',
  labels: { singular: 'Applicant', plural: 'Applicants' },
  admin: { group: 'Team', useAsTitle: 'name', defaultColumns: ['name', 'opening', 'stage', 'createdAt'] },
  defaultSort: '-createdAt',
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const now = new Date().toISOString()
        if (operation === 'create') {
          data.stage = data.stage || 'applied'
          data.stageSince = now
        }
        // A stage change is dated, and written into the notes so the history reads in order.
        if (operation === 'update' && data.stage && data.stage !== originalDoc?.stage) {
          data.stageSince = now
          const notes = Array.isArray(data.notes) ? data.notes : Array.isArray(originalDoc?.notes) ? originalDoc.notes : []
          data.notes = [...notes, { stage: data.stage, text: `Moved to ${STAGE_TEXT[data.stage] ?? data.stage}`, by: req.user?.id ?? null, at: now }]
        }
        // New notes are stamped with who wrote them and when.
        if (Array.isArray(data.notes)) {
          data.notes = data.notes.map((n: Record<string, unknown>) => ({ ...n, by: idOf(n.by) ?? req.user?.id ?? null, at: n.at || now }))
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'update' && doc.stage !== previousDoc?.stage && ['hired', 'not-hired', 'offer'].includes(doc.stage)) {
          const opening = await openingOf(req, doc.opening)
          await audit(req, {
            action: `applicant.${doc.stage}`,
            summary: `${doc.name}, ${opening?.title ?? 'an opening'}: ${STAGE_TEXT[doc.stage]}`,
            person: idOf(doc.hiredAs) as number | null,
            subjectType: 'applicants',
            subjectId: doc.id,
          })
        }
        return doc
      },
    ],
    // Their CV goes with them: it is personal data, and nobody else's record points at it.
    beforeDelete: [
      async ({ id, req }) => {
        const files = await req.payload.find({ collection: 'documents', where: { applicant: { equals: id } }, limit: 50, depth: 0, overrideAccess: true, req })
        for (const f of files.docs) await req.payload.delete({ collection: 'documents', id: f.id, overrideAccess: true, req })
      },
    ],
  },
  endpoints: [
    {
      /*
        The public application form (spec 14.4). No sign-in and no key: the
        team portal's /jobs page posts here. A bot gets the same "thank you"
        as a person and nothing is saved. One application per email per job.
      */
      path: '/apply',
      method: 'post',
      handler: async (req) => {
        const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
        const opening = await openingOf(req, body.opening)
        const cv = body.cv && typeof body.cv === 'object' ? (body.cv as { name?: string; type?: string; data?: string }) : null
        const check = checkApplication({ ...body, hasCv: Boolean(cv?.data) }, opening as never)
        if (check.bot) return Response.json({ ok: true })
        if (check.errors.length || !check.clean || !opening) return Response.json({ errors: check.errors }, { status: 400 })

        let file: { data: Buffer; mimetype: string; name: string; size: number } | null = null
        if (cv?.data) {
          const type = CV_TYPES[String(cv.type)]
          const data = Buffer.from(String(cv.data), 'base64')
          if (!type || !type.magic.every((b, i) => data[i] === b)) return Response.json({ errors: ['Your CV needs to be a PDF or a Word (.docx) file.'] }, { status: 400 })
          if (data.length > MAX_CV) return Response.json({ errors: ['Your CV can be up to 5 MB.'] }, { status: 400 })
          file = { data, mimetype: String(cv.type), name: `cv-${check.clean.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${type.ext}`, size: data.length }
        }

        const dup = await req.payload.find({
          collection: 'applicants',
          where: { and: [{ opening: { equals: opening.id } }, { email: { equals: check.clean.email } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
        if (dup.docs.length) return Response.json({ errors: ['You have already applied for this job. We will be in touch.'] }, { status: 409 })
        if (!underCap(String(opening.id))) return Response.json({ errors: ['We cannot take more applications today. Please try again tomorrow.'] }, { status: 429 })

        const applicant = await req.payload.create({ collection: 'applicants', data: { ...check.clean, opening: opening.id } as never, overrideAccess: true, req })
        if (file) {
          await req.payload
            .create({
              collection: 'documents',
              data: { title: `CV: ${check.clean.name}`, kind: 'applicant', category: 'cv', applicant: applicant.id } as never,
              file,
              overrideAccess: true,
              req,
            })
            .catch((err) => reportProblem(req, `cv:${applicant.id}`, `${check.clean?.name || 'An applicant'}'s application came in, but the CV was not saved`, err))
        }
        await notify(req, {
          to: await adminIds(req),
          kind: 'applicant',
          title: `New applicant: ${check.clean.name}`,
          body: `For ${opening.title}${check.clean.city ? `, from ${check.clean.city}` : ''}.`,
          link: `/hiring/applicants/${applicant.id}`,
          action: 'Open their application',
        })
        return Response.json({ ok: true })
      },
    },
    {
      /*
        Book an interview (spec 14.4): a time, a Google Meet link and an
        invitation. The applicant gets an email with a calendar invitation
        Gmail shows with Yes and No; Ernest gets the same, plus a link that
        puts it in his Google Calendar in one tap.
      */
      path: '/:id/interview',
      method: 'post',
      handler: async (req) => {
        if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest books interviews.' }, { status: req.user ? 403 : 401 })
        const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
        const a = await req.payload.findByID({ collection: 'applicants', id: Number(req.routeParams?.id), depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!a) return Response.json({ error: 'That applicant is not there.' }, { status: 404 })
        const start = new Date(String(body.at ?? ''))
        const minutes = Math.round(Number(body.minutes) || 30)
        const meetLink = String(body.meetLink ?? '').trim()
        if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000) return Response.json({ error: 'Choose a time still to come.' }, { status: 400 })
        if (minutes < 10 || minutes > 240) return Response.json({ error: 'An interview runs between 10 minutes and 4 hours.' }, { status: 400 })
        if (meetLink && !/^https:\/\/\S+$/.test(meetLink)) return Response.json({ error: 'The Meet link starts with https://' }, { status: 400 })

        const opening = await openingOf(req, a.opening)
        const admin = req.user as { id: number; name?: string | null; email: string }
        const title = `Interview: ${opening?.title ?? 'Quadem'}, ${a.name}`
        const when = accraTime(start)
        const note = String(body.note ?? '').trim()
        const description = [`Interview with Quadem Digital for ${opening?.title ?? 'a role'}.`, meetLink ? `Join on Google Meet: ${meetLink}` : null, note || null].filter(Boolean).join('\n\n')
        const ics = icsInvite({
          uid: `interview-${a.id}-${start.getTime()}@quademdigital.com`,
          start,
          minutes,
          title,
          description,
          meetLink,
          organizer: { name: admin.name || 'Quadem Digital', email: process.env.CMS_FROM_ADDRESS || 'ernest@quademdigital.com' },
          attendees: [
            { name: a.name, email: a.email },
            { name: admin.name || 'Ernest', email: admin.email },
          ],
        })
        const attachments = [{ filename: 'interview.ics', content: ics, contentType: 'text/calendar; method=REQUEST' }]

        const toApplicant = layout(
          `<p style="margin:0 0 14px">Dear ${escape(firstName(a.name) || a.name)},</p>` +
            `<p style="margin:0 0 14px">Thank you for applying to be our ${escape(opening?.title ?? 'new team member')}. We would like to talk with you.</p>` +
            `<p style="margin:0 0 14px"><b>${escape(when)}</b>, for about ${minutes} minutes, on Google Meet.</p>` +
            (note ? paragraphs(note) : '') +
            (meetLink ? button(meetLink, 'Join on Google Meet') : '') +
            `<p style="margin:18px 0 0;color:#5b6474;font-size:14px">The invitation is attached: open it to add it to your calendar. If the time does not work, reply to this email.</p>`,
        )
        await req.payload.sendEmail({ to: a.email, replyTo: admin.email, subject: `Interview with Quadem Digital: ${when}`, html: toApplicant, attachments })
        await req.payload.sendEmail({
          to: admin.email,
          subject: `Interview booked: ${a.name}, ${when}`,
          html: layout(
            `<p style="margin:0 0 14px">${escape(a.name)}, for ${escape(opening?.title ?? 'an opening')}.</p><p style="margin:0 0 14px"><b>${escape(when)}</b>, ${minutes} minutes.</p>` +
              button(googleCalendarLink({ start, minutes, title, description, meetLink }), 'Add to Google Calendar'),
          ),
          attachments,
        })

        const rows = Array.isArray(a.interviews) ? a.interviews.map((r: Record<string, unknown>) => ({ ...r, by: idOf(r.by) })) : []
        await req.payload.update({
          collection: 'applicants',
          id: a.id,
          data: {
            interviews: [...rows, { at: start.toISOString(), minutes, meetLink: meetLink || null, invitedAt: new Date().toISOString(), by: admin.id }],
            ...(['applied', 'screened'].includes(String(a.stage)) ? { stage: 'interview' } : {}),
          } as never,
          overrideAccess: true,
          req,
        })
        return Response.json({ ok: true, when })
      },
    },
    {
      /*
        Not hired (spec 14.4). The email is Ernest's words, from the template
        in Settings, and goes only when he presses Send. Marking someone not
        hired without the email is allowed too.
      */
      path: '/:id/not-hired',
      method: 'post',
      handler: async (req) => {
        if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest decides this.' }, { status: req.user ? 403 : 401 })
        const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, any>
        const a = await req.payload.findByID({ collection: 'applicants', id: Number(req.routeParams?.id), depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!a) return Response.json({ error: 'That applicant is not there.' }, { status: 404 })
        if (a.stage === 'hired') return Response.json({ error: 'They were hired. End their agreement from their page instead.' }, { status: 400 })
        const send = body.send === true
        const subject = String(body.subject ?? '').trim()
        const text = String(body.body ?? '').trim()
        if (send && (!subject || !text)) return Response.json({ error: 'Write the subject and the message.' }, { status: 400 })
        if (send && a.notHiredSentAt) return Response.json({ error: `The email already went on ${new Date(a.notHiredSentAt).toDateString()}.` }, { status: 409 })
        if (send) {
          const admin = req.user as { email: string }
          await req.payload.sendEmail({ to: a.email, replyTo: admin.email, subject, html: layout(paragraphs(text)), text })
        }
        await req.payload.update({
          collection: 'applicants',
          id: a.id,
          data: { stage: 'not-hired', ...(send ? { notHiredSentAt: new Date().toISOString() } : {}) } as never,
          overrideAccess: true,
          req,
        })
        return Response.json({ ok: true, sent: send })
      },
    },
  ],
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '34%' } },
        { name: 'email', type: 'email', required: true, index: true, admin: { width: '33%' } },
        { name: 'phone', type: 'text', admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'opening', type: 'relationship', relationTo: 'openings', required: true, index: true, admin: { width: '34%' } },
        { name: 'country', type: 'text', admin: { width: '33%' } },
        { name: 'city', type: 'text', admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'stage', type: 'select', required: true, defaultValue: 'applied', index: true, options: [...APPLICANT_STAGES], admin: { width: '34%' } },
        { name: 'stageSince', label: 'Since', type: 'date', admin: { width: '33%', readOnly: true } },
        { name: 'hiredAs', label: 'Hired as', type: 'relationship', relationTo: 'users', admin: { width: '33%', description: 'Their team account, once hired.' } },
      ],
    },
    {
      name: 'answers',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'question', type: 'text' },
        { name: 'answer', type: 'textarea' },
      ],
    },
    { name: 'portfolio', type: 'array', admin: { readOnly: true }, fields: [{ name: 'url', type: 'text' }] },
    {
      type: 'row',
      fields: [
        { name: 'heardFrom', label: 'Heard about it from', type: 'select', options: [...HEARD_FROM], admin: { width: '50%' } },
        { name: 'heardFromNote', label: 'Where exactly', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      name: 'notes',
      label: 'Notes and scores',
      type: 'array',
      admin: { description: 'One per conversation or step: what you saw, and a score from 1 to 5.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'stage', type: 'select', options: [...APPLICANT_STAGES], admin: { width: '25%' } },
            { name: 'score', type: 'number', min: 1, max: 5, admin: { width: '15%' } },
            { name: 'text', type: 'textarea', admin: { width: '60%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'by', type: 'relationship', relationTo: 'users', admin: { width: '50%', readOnly: true } },
            { name: 'at', type: 'date', admin: { width: '50%', readOnly: true } },
          ],
        },
      ],
    },
    {
      name: 'interviews',
      type: 'array',
      admin: { description: 'Booked from the portal, which sends the invitations.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'at', type: 'date', admin: { width: '30%', date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'minutes', type: 'number', admin: { width: '15%' } },
            { name: 'meetLink', label: 'Meet link', type: 'text', admin: { width: '35%' } },
            { name: 'invitedAt', label: 'Invited', type: 'date', admin: { width: '20%', readOnly: true } },
          ],
        },
        { name: 'by', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
      ],
    },
    {
      name: 'offer',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'termsTemplate', label: 'Terms', type: 'relationship', relationTo: 'terms-templates', admin: { width: '34%' } },
            { name: 'startDate', label: 'Start date', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
            { name: 'sentAt', label: 'Offer sent', type: 'date', admin: { width: '33%' } },
          ],
        },
      ],
    },
    { name: 'notHiredSentAt', label: 'Not-hired email sent', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
