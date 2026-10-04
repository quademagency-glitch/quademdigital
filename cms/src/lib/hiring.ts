/**
 * Hiring (spec 14.4): the rules that need no database, so they can be tested.
 * The collections are openings and applicants; the public application form is
 * on the team portal at /jobs.
 */

export const APPLICANT_STAGES = [
  { label: 'Applied', value: 'applied' },
  { label: 'Screened', value: 'screened' },
  { label: 'Interview', value: 'interview' },
  { label: 'Trial task', value: 'trial' },
  { label: 'Offer', value: 'offer' },
  { label: 'Hired', value: 'hired' },
  { label: 'Not hired', value: 'not-hired' },
] as const
export type Stage = (typeof APPLICANT_STAGES)[number]['value']
export const STAGE_TEXT: Record<string, string> = Object.fromEntries(APPLICANT_STAGES.map((s) => [s.value, s.label]))

export const HEARD_FROM = [
  { label: 'The Quadem website', value: 'website' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'X', value: 'x' },
  { label: 'A friend or someone at Quadem', value: 'referral' },
  { label: 'A job board', value: 'job-board' },
  { label: 'Somewhere else', value: 'other' },
] as const

/** A readable address for an opening: "business-development-trainee-lagos". */
export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'opening'

export type OpeningForCheck = { status?: string | null; closesAt?: string | null; cvRequired?: boolean | null; questions?: { id?: string | null; question: string; required?: boolean | null }[] | null }

export type Application = {
  name?: unknown
  email?: unknown
  phone?: unknown
  country?: unknown
  city?: unknown
  answers?: unknown
  portfolio?: unknown
  heardFrom?: unknown
  heardFromNote?: unknown
  hasCv?: boolean
  /** Honeypot: a field people never see. Anything in it is a bot. */
  website?: unknown
  /** When the form was opened, in ms. A form sent in under 3 seconds is a bot. */
  startedAt?: unknown
}

export type CleanApplication = {
  name: string
  email: string
  phone: string | null
  country: string | null
  city: string | null
  answers: { question: string; answer: string }[]
  portfolio: { url: string }[]
  heardFrom: string | null
  heardFromNote: string | null
}

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/**
 * Checks an application before anything is saved. `bot` means drop it quietly:
 * the form says thank you either way, so a bot learns nothing.
 */
export function checkApplication(input: Application, opening: OpeningForCheck | null, now = Date.now()): { errors: string[]; bot: boolean; clean?: CleanApplication } {
  if (text(input.website, 200)) return { errors: [], bot: true }
  const started = Number(input.startedAt)
  if (!Number.isFinite(started) || now - started < 3000 || now - started > 7 * 86_400_000) return { errors: [], bot: true }

  const errors: string[] = []
  if (!opening || opening.status !== 'open') return { errors: ['This job is no longer taking applications.'], bot: false }
  if (opening.closesAt && new Date(opening.closesAt).getTime() + 86_400_000 <= now) return { errors: ['This job closed to applications.'], bot: false }

  const name = text(input.name, 120)
  const email = text(input.email, 200).toLowerCase()
  if (name.length < 2) errors.push('Add your full name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Add an email address we can reach you on.')
  const phone = text(input.phone, 40) || null
  if (phone && !/^[+\d][\d\s().-]{6,}$/.test(phone)) errors.push('The phone number does not look right. Include the country code, such as +234.')

  const given = Array.isArray(input.answers) ? (input.answers as { question?: unknown; answer?: unknown }[]) : []
  const answers = (opening.questions ?? []).map((q) => {
    const a = given.find((g) => text(g.question, 500) === q.question.trim())
    return { question: q.question.trim(), answer: text(a?.answer, 3000), required: Boolean(q.required) }
  })
  for (const a of answers) if (a.required && !a.answer) errors.push(`Answer: ${a.question}`)

  const urls = (Array.isArray(input.portfolio) ? input.portfolio : [])
    .map((u) => text(u, 500))
    .filter(Boolean)
    .slice(0, 5)
  for (const u of urls) if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(u)) errors.push(`This link does not look right: ${u}. Start it with https://`)
  if (opening.cvRequired && !input.hasCv) errors.push('Add your CV, as a PDF or Word file.')

  const heard = text(input.heardFrom, 40)
  const heardFrom = HEARD_FROM.some((h) => h.value === heard) ? heard : null
  const country = text(input.country, 2).toUpperCase()

  if (errors.length) return { errors, bot: false }
  return {
    errors,
    bot: false,
    clean: {
      name,
      email,
      phone,
      country: /^[A-Z]{2}$/.test(country) ? country : null,
      city: text(input.city, 80) || null,
      answers: answers.map(({ question, answer }) => ({ question, answer })),
      portfolio: urls.map((url) => ({ url })),
      heardFrom,
      heardFromNote: text(input.heardFromNote, 200) || null,
    },
  }
}

/** Fills {name}, {firstName}, {title}… in a template; unknown names stay as written. */
export const fillTemplate = (template: string, values: Record<string, string | null | undefined>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (values[key] !== undefined && values[key] !== null ? String(values[key]) : whole))

export const DEFAULT_NOT_HIRED_SUBJECT = 'Your application to Quadem: {title}'
export const DEFAULT_NOT_HIRED_BODY = `Dear {firstName},

Thank you for applying to be our {title}, and for the time you gave it.

We have decided not to go ahead with your application this time. It was not an easy choice, and it is no reflection on you as a person.

We will keep your details, and if a role opens that suits you better we may get in touch. We wish you every success.

Kind regards,
Ernest
Quadem Digital`

/* Calendar invitations ---------------------------------------------------- */

const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
/** Lines longer than 75 octets continue on the next line after a space (RFC 5545). */
const fold = (line: string) => {
  const out: string[] = []
  let rest = line
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--
    out.push(rest.slice(0, cut))
    rest = ` ${rest.slice(cut)}`
  }
  out.push(rest)
  return out.join('\r\n')
}

export type Invitation = {
  uid: string
  start: Date
  minutes: number
  title: string
  description: string
  meetLink?: string | null
  organizer: { name: string; email: string }
  attendees: { name: string; email: string }[]
  now?: Date
}

/** An .ics invitation. Gmail and Google Calendar show it with Yes / No buttons and add it to the calendar. */
export function icsInvite(i: Invitation) {
  const end = new Date(i.start.getTime() + i.minutes * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Quadem Digital//Team portal//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${i.uid}`,
    `DTSTAMP:${icsTime(i.now ?? new Date())}`,
    `DTSTART:${icsTime(i.start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(i.title)}`,
    `DESCRIPTION:${icsText(i.description)}`,
    ...(i.meetLink ? [`LOCATION:${icsText(i.meetLink)}`, `URL:${i.meetLink}`] : []),
    `ORGANIZER;CN=${icsText(i.organizer.name)}:mailto:${i.organizer.email}`,
    ...i.attendees.map((a) => `ATTENDEE;CN=${icsText(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** A link that opens Google Calendar with the event filled in, one tap to save. */
export const googleCalendarLink = (i: Pick<Invitation, 'start' | 'minutes' | 'title' | 'description' | 'meetLink'>) => {
  const end = new Date(i.start.getTime() + i.minutes * 60_000)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: i.title,
    dates: `${icsTime(i.start)}/${icsTime(end)}`,
    details: i.description,
    ...(i.meetLink ? { location: i.meetLink } : {}),
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** "Tue 14 Oct, 10:00 Accra (11:00 Lagos)": the team works across both. */
export const accraTime = (d: Date) => {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Accra' }).format(d)
  const accra = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra' }).format(d)
  const lagos = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' }).format(d)
  return `${day}, ${accra} Accra (${lagos} Lagos)`
}
