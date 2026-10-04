import { describe, expect, it } from 'vitest'
import { accraTime, checkApplication, fillTemplate, googleCalendarLink, icsInvite, slugify, DEFAULT_NOT_HIRED_BODY } from '../../src/lib/hiring'

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0)
const opening = {
  status: 'open',
  cvRequired: true,
  questions: [
    { question: 'Why sales?', required: true },
    { question: 'Anything else?', required: false },
  ],
}
const good = {
  name: '  Amaka Obi ',
  email: 'Amaka@Example.com',
  phone: '+234 803 000 0000',
  country: 'ng',
  city: 'Abuja',
  answers: [{ question: 'Why sales?', answer: 'I like people.' }],
  portfolio: ['https://example.com/me', ''],
  heardFrom: 'linkedin',
  hasCv: true,
  website: '',
  startedAt: NOW - 60_000,
}

describe('applying for a job (spec 14.4)', () => {
  it('a complete application is cleaned: trimmed, email in lower case, country in capitals, every question kept', () => {
    const r = checkApplication(good, opening, NOW)
    expect(r.errors).toEqual([])
    expect(r.bot).toBe(false)
    expect(r.clean).toEqual({
      name: 'Amaka Obi',
      email: 'amaka@example.com',
      phone: '+234 803 000 0000',
      country: 'NG',
      city: 'Abuja',
      answers: [
        { question: 'Why sales?', answer: 'I like people.' },
        { question: 'Anything else?', answer: '' },
      ],
      portfolio: [{ url: 'https://example.com/me' }],
      heardFrom: 'linkedin',
      heardFromNote: null,
    })
  })

  it('says what is missing, in plain words', () => {
    const r = checkApplication({ ...good, name: 'A', email: 'nope', answers: [], hasCv: false, portfolio: ['example.com'] }, opening, NOW)
    expect(r.errors).toEqual([
      'Add your full name.',
      'Add an email address we can reach you on.',
      'Answer: Why sales?',
      'This link does not look right: example.com. Start it with https://',
      'Add your CV, as a PDF or Word file.',
    ])
  })

  it('a bot is dropped quietly: the hidden field filled in, or the form sent in under 3 seconds', () => {
    expect(checkApplication({ ...good, website: 'http://spam' }, opening, NOW)).toEqual({ errors: [], bot: true })
    expect(checkApplication({ ...good, startedAt: NOW - 1000 }, opening, NOW).bot).toBe(true)
    expect(checkApplication({ ...good, startedAt: 'yesterday' }, opening, NOW).bot).toBe(true)
  })

  it('a draft or closed job takes no applications, and nor does one past its closing day', () => {
    expect(checkApplication(good, { ...opening, status: 'closed' }, NOW).errors).toEqual(['This job is no longer taking applications.'])
    expect(checkApplication(good, { ...opening, closesAt: '2026-10-13T00:00:00.000Z' }, NOW).errors).toEqual(['This job closed to applications.'])
    // The closing day itself still counts.
    expect(checkApplication(good, { ...opening, closesAt: '2026-10-14T00:00:00.000Z' }, NOW).errors).toEqual([])
  })

  it('an unknown source is dropped, not stored', () => {
    expect(checkApplication({ ...good, heardFrom: 'tiktok' }, opening, NOW).clean?.heardFrom).toBeNull()
  })
})

describe('the words around hiring', () => {
  it('a job title becomes a readable address', () => {
    expect(slugify('Business Development Trainee, Lagos')).toBe('business-development-trainee-lagos')
    expect(slugify('Vidéo éditor!')).toBe('video-editor')
    expect(slugify('***')).toBe('opening')
  })

  it('the not-hired email fills in the name and the job, and leaves unknown names alone', () => {
    const text = fillTemplate(DEFAULT_NOT_HIRED_BODY, { firstName: 'Amaka', title: 'Business development trainee' })
    expect(text).toContain('Dear Amaka,')
    expect(text).toContain('our Business development trainee,')
    expect(fillTemplate('{a} and {b}', { a: 'one' })).toBe('one and {b}')
  })
})

describe('interview invitations', () => {
  const start = new Date(Date.UTC(2026, 9, 14, 10, 0))
  const invite = {
    uid: 'interview-7-1@quademdigital.com',
    start,
    minutes: 30,
    title: 'Interview: Business development trainee, with Quadem',
    description: 'Join on Google Meet: https://meet.google.com/abc-defg-hij',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    organizer: { name: 'Quadem Digital', email: 'ernest@quademdigital.com' },
    attendees: [{ name: 'Amaka Obi', email: 'amaka@example.com' }],
    now: new Date(Date.UTC(2026, 9, 10, 8, 0)),
  }

  it('is a calendar request with the time in UTC, the Meet link and the person invited', () => {
    const ics = icsInvite(invite)
    expect(ics).toContain('METHOD:REQUEST')
    expect(ics).toContain('DTSTART:20261014T100000Z')
    expect(ics).toContain('DTEND:20261014T103000Z')
    expect(ics).toContain('LOCATION:https://meet.google.com/abc-defg-hij')
    expect(ics).toContain('mailto:amaka@example.com')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('escapes commas and keeps every line within 75 bytes', () => {
    const ics = icsInvite(invite)
    expect(ics).toContain('SUMMARY:Interview: Business development trainee\\, with Quadem')
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
  })

  it('a Google Calendar link opens the same event, ready to save', () => {
    const url = new URL(googleCalendarLink(invite))
    expect(url.hostname).toBe('calendar.google.com')
    expect(url.searchParams.get('dates')).toBe('20261014T100000Z/20261014T103000Z')
    expect(url.searchParams.get('location')).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('times are written for Accra and Lagos', () => {
    expect(accraTime(start)).toBe('Wed 14 Oct, 10:00 Accra (11:00 Lagos)')
  })
})
