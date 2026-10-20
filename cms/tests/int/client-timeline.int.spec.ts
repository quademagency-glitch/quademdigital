import { describe, expect, it } from 'vitest'
import { boughtText, changesSince, combineJourneys, dayText, hasNews, servicesOf, snapshotOf, sortSteps, summaryOf, timelineEmail, type StepDoc } from '../../src/lib/clientTimeline'

/* A client's timeline, made and emailed by itself (lib/clientTimeline.ts): the steps put together, what changed, and the emails. On a real CMS it is in api.int.spec.ts. */

const website = {
  id: 2,
  name: 'Website build',
  steps: [
    { title: 'Kick-off call', owner: 'quadem', stage: 'onboarding', dueOffsetDays: 0, detail: 'We talk through your business.' },
    { title: 'Send your logo, photos and page wording', owner: 'client', stage: 'onboarding', dueOffsetDays: 3 },
    { title: 'Homepage design for your review', owner: 'quadem', stage: 'design', dueOffsetDays: 8 },
    { title: 'Your feedback', owner: 'client', stage: 'review', dueOffsetDays: 10 },
    { title: 'Handover', owner: 'quadem', stage: 'completed', dueOffsetDays: 28 },
  ],
}
const seo = {
  id: 6,
  name: 'SEO and paid ads',
  steps: [
    { title: 'Kick-off call', owner: 'quadem', stage: 'onboarding', dueOffsetDays: 0, detail: 'Your most important products.' },
    { title: 'Access to Search Console', owner: 'client', stage: 'onboarding', dueOffsetDays: 3 },
    { title: 'Site and keyword audit', owner: 'quadem', stage: 'design', dueOffsetDays: 10 },
    { title: 'Your feedback', owner: 'client', stage: 'review', dueOffsetDays: 12 },
    { title: 'Monthly report', owner: 'quadem', stage: 'retainer', dueOffsetDays: 30 },
  ],
}

describe('a timeline from the journeys of what they bought', () => {
  it('reads each service once, and which are paid once', () => {
    expect(servicesOf({ service: 'multiple', customizations: { services: [{ service: 'web-design', billing: 'one-off' }, { service: 'seo-paid-ads', billing: 'monthly' }, { service: 'web-design' }, { service: 'nonsense' }] } })).toEqual([
      { service: 'web-design', oneOff: true },
      { service: 'seo-paid-ads', oneOff: false },
    ])
    expect(servicesOf({ service: 'branding', customizations: { duration: 0 } })).toEqual([{ service: 'branding', oneOff: true }])
    expect(servicesOf({ service: 'social-media', customizations: { duration: 3 } })).toEqual([{ service: 'social-media', oneOff: false }])
    expect(servicesOf({ service: 'multiple' })).toEqual([])
  })

  it('puts two journeys together in date order, with one kick-off call', () => {
    const steps = combineJourneys([
      { service: 'web-design', oneOff: true, template: website },
      { service: 'seo-paid-ads', oneOff: false, template: seo },
    ])
    expect(steps.map((s) => [s.dueOffsetDays, s.title, s.sourceTemplate])).toEqual([
      [0, 'Kick-off call', 2],
      [3, 'Send your logo, photos and page wording', 2],
      [3, 'Access to Search Console', 6],
      [8, 'Homepage design for your review', 2],
      [10, 'Your feedback', 2],
      [10, 'Site and keyword audit', 6],
      // The same name later on is different work: it says which.
      [12, 'SEO: Your feedback', 6],
      [28, 'Handover', 2],
      [30, 'Monthly report', 6],
    ])
    expect(steps[0].detail).toBe('We talk through your business.')
  })

  it('drops the monthly steps of a service paid once', () => {
    const steps = combineJourneys([{ service: 'seo-paid-ads', oneOff: true, template: seo }])
    expect(steps.map((s) => s.title)).not.toContain('Monthly report')
    expect(steps).toHaveLength(4)
  })

  it('names what they bought in words', () => {
    expect(boughtText({ customizations: { services: [{ service: 'web-design' }, { service: 'seo-paid-ads' }, { service: 'branding' }] } })).toBe('your website, your SEO and your brand identity')
    expect(boughtText({ service: 'social-media' })).toBe('your social media')
    expect(boughtText({ service: 'multiple' })).toBe('your project')
  })
})

const step = (id: number, title: string, data: Partial<StepDoc> = {}): StepDoc => ({ id, title, owner: 'quadem', status: 'todo', dueDate: '2026-10-20T00:00:00.000Z', order: id, ...data })

describe('what the client has not been told', () => {
  const steps = [step(1, 'Kick-off call'), step(2, 'Send your logo', { owner: 'client', dueDate: '2026-10-22T00:00:00.000Z' }), step(3, 'Homepage design', { dueDate: '2026-10-27T00:00:00.000Z' })]
  const told = snapshotOf(steps, [{ id: 'u1', title: 'Welcome' }])

  it('nothing, when nothing they can see changed', () => {
    expect(hasNews(changesSince(told, steps, [{ id: 'u1', title: 'Welcome' }]))).toBe(false)
    // Started is not news; done is.
    expect(hasNews(changesSince(told, [{ ...steps[0], status: 'in-progress' }, ...steps.slice(1)], []))).toBe(false)
  })

  it('a step done, a date moved, a step added, an update posted', () => {
    const now = [
      { ...steps[0], status: 'done', completedAt: '2026-10-20T11:00:00.000Z' },
      steps[1],
      { ...steps[2], dueDate: '2026-10-29T00:00:00.000Z' },
      step(4, 'Photoshoot', { dueDate: '2026-10-24T00:00:00.000Z' }),
    ]
    const c = changesSince(told, now, [{ id: 'u2', title: 'Domain bought' }, { id: 'u1', title: 'Welcome' }])
    expect(c.done.map((s) => s.title)).toEqual(['Kick-off call'])
    expect(c.moved).toEqual([{ step: now[2], was: '2026-10-27' }])
    expect(c.added.map((s) => s.title)).toEqual(['Photoshoot'])
    expect(c.posted.map((u) => u.title)).toEqual(['Domain bought'])
    expect(summaryOf('update', now, c)).toBe('1 step done, 1 update, 1 new date, 1 new step')
    // A step done and then its date moved is told once, as done.
    expect(changesSince(snapshotOf(now, []), now, []).done).toEqual([])
  })

  it('sorts a timeline by date, then as ordered', () => {
    const late = step(9, 'Added last but early', { dueDate: '2026-10-21T00:00:00.000Z', order: 9 })
    const undated = step(0, 'No date', { dueDate: null, order: 0 })
    expect(sortSteps([undated, ...steps, late]).map((s) => s.id)).toEqual([1, 9, 2, 3, 0])
  })
})

describe('the emails', () => {
  const now = new Date('2026-10-19T09:00:00.000Z')
  const steps = [
    step(1, 'Kick-off call', { detail: 'We talk it through <together>.' }),
    step(2, 'Send your logo', { owner: 'client', dueDate: '2026-10-22T00:00:00.000Z' }),
    step(3, 'Homepage design', { dueDate: '2026-10-27T00:00:00.000Z' }),
  ]

  it('dates read as days, with the year only when it is another one', () => {
    expect(dayText('2026-10-22T00:00:00.000Z', now)).toBe('Thu 22 Oct')
    expect(dayText('2027-01-05T00:00:00.000Z', now)).toBe('Tue 5 Jan 2027')
    expect(dayText(null, now)).toBe('')
  })

  it('the plan: every step, who does it, and the first thing needed from them', () => {
    const m = timelineEmail({ kind: 'plan', business: 'Kofi & <Sons>', first: 'Kofi', bought: 'your website', steps, updates: [], changes: null, followUps: true, now })
    expect(m.subject).toBe('Your project timeline: Kofi & <Sons>')
    expect(m.html).toContain('We talk it through &lt;together&gt;.')
    expect(m.text).toContain('Hi Kofi,')
    expect(m.text).toContain('First from you: Send your logo, by Thu 22 Oct.')
    expect(m.text).toContain('Tue 20 Oct  Kick-off call (Quadem Digital)')
    expect(m.text).toContain('Thu 22 Oct  Send your logo (You)')
    expect(m.text).toContain('When something on it changes, I will email you.')
    expect(m.html + m.text).not.toContain('—')
    // Sent by hand to a client with the emails switched off: no promise of more.
    const once = timelineEmail({ kind: 'plan', business: 'Kofi', first: '', bought: 'your website', steps, updates: [], changes: null, followUps: false, now })
    expect(once.text).not.toContain('I will email you')
    expect(once.text).toContain('Hello,')
  })

  it('an update: only what moved, then what is waiting on them and what comes next', () => {
    const done = { ...steps[0], status: 'done', completedAt: '2026-10-20T11:00:00.000Z' }
    const moved = { ...steps[2], dueDate: '2026-10-29T00:00:00.000Z' }
    const now2 = [done, steps[1], moved]
    const m = timelineEmail({
      kind: 'update',
      business: 'Kofi',
      first: 'Kofi',
      bought: 'your website',
      steps: now2,
      updates: [],
      changes: { done: [done], added: [], moved: [{ step: moved, was: '2026-10-27' }], posted: [{ id: 'u2', title: 'Domain bought', description: 'kofi.com.gh is yours.' }] },
      followUps: true,
      now,
    })
    expect(m.subject).toBe('Project update: Kofi')
    expect(m.text).toContain('Done\n- Kick-off call (Tue 20 Oct)')
    expect(m.text).toContain('Updates\n- Domain bought. kofi.com.gh is yours.')
    expect(m.text).toContain('New dates\n- Homepage design: now Thu 29 Oct, was Tue 27 Oct')
    expect(m.text).toContain('Waiting on you\n- Send your logo, due Thu 22 Oct')
    expect(m.text).toContain('Coming up\n- Homepage design, Thu 29 Oct')
    expect(m.text).not.toContain('New on your timeline')
    expect(m.html + m.text).not.toContain('—')
  })

  it('says so when every step is done', () => {
    const all = steps.map((s) => ({ ...s, status: 'done' }))
    const m = timelineEmail({ kind: 'update', business: 'Kofi', first: 'Kofi', bought: 'your website', steps: all, updates: [], changes: { done: all, added: [], moved: [], posted: [] }, followUps: true, now })
    expect(m.text).toContain('Every step on your timeline is now done.')
    expect(m.text).not.toContain('Waiting on you')
  })
})
