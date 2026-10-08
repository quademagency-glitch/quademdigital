import { describe, expect, it } from 'vitest'
import { noticePush, portalPath } from '../../src/lib/push'

describe('what a phone notification says', () => {
  it('a direct message shows who sent it and its first line, and opens the conversation', () => {
    expect(noticePush({ id: 9, kind: 'message', title: 'Ama sent you a message', body: 'Can we move the call?', link: '/messages/14' })).toEqual({
      title: 'Ama sent you a message',
      body: 'Can we move the call?',
      path: '/messages/14',
      tag: 'notice-9',
    })
  })

  it('a first sign-in shows its title and opens the bell', () => {
    const push = noticePush({ id: 3, kind: 'first-sign-in', title: 'Kofi signed in for the first time', body: 'Their account is now Active.', link: '/people/12' })
    expect(push.title).toBe('Kofi signed in for the first time')
    expect(push.path).toBe('/notifications')
  })

  it('other notices show their title, never their details', () => {
    const push = noticePush({ id: 4, kind: 'task-done', title: 'A task was finished', body: 'Private detail', link: '/tasks/1' })
    expect(push.title).toBe('A task was finished')
    expect(push.body).not.toContain('Private detail')
  })

  it('pay, warnings, reviews and account security stay generic on a locked screen', () => {
    for (const kind of ['warning', 'payout', 'commission-earned', 'review', 'appraisal', 'agreement-ended', 'security', 'password', 'expense']) {
      const push = noticePush({ id: 1, kind, title: 'Your payout of GHS 4,000 was paid', body: 'secret', link: '/money' })
      expect(push.title).toBe('Quadem Team')
      expect(push.body).toBe('You have a new update. Open Quadem to read it.')
      expect(push.path).toBe('/notifications')
    }
  })

  it('an id on its own is the generic notice, as before', () => {
    expect(noticePush({ id: 5 })).toEqual({ title: 'Quadem Team', body: 'You have a new update. Open Quadem to read it.', path: '/notifications', tag: 'notice-5' })
  })
})

describe('where a tap may go', () => {
  it('a page inside the portal', () => {
    expect(portalPath('/messages/14')).toBe('/messages/14')
    expect(portalPath('/people/3?tab=terms')).toBe('/people/3?tab=terms')
  })

  it('a single message inside a conversation', () => {
    expect(portalPath('/messages/14#m-90')).toBe('/messages/14#m-90')
    expect(noticePush({ id: 2, kind: 'message', title: 'Kofi replied to you', body: 'Yes, 6pm.', link: '/messages/14#m-90' }).path).toBe('/messages/14#m-90')
  })

  it('never another site', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'messages/1', '', null, 42, `/${'a'.repeat(400)}`]) {
      expect(portalPath(bad)).toBe('/notifications')
    }
  })
})
