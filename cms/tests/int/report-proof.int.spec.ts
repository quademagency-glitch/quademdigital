import { describe, expect, it } from 'vitest'
import { byItems, hasWords, itemProblem, logProblem, ruleForType } from '../../src/lib/reportProof'

const bd = [
  { label: 'Researched', source: 'researched', proof: 'none' as const },
  { label: 'First messages', source: 'firstMessages', proof: 'words' as const, proofRequired: true, screenshot: 'optional' as const },
  { label: 'Follow-ups', source: 'followUps', proof: 'words' as const, proofRequired: true, screenshot: 'required' as const },
]

describe('proof of a contact recorded on a lead', () => {
  it('finds the rule for the kind of contact', () => {
    expect(ruleForType(bd, 'first-message')?.label).toBe('First messages')
    expect(ruleForType(bd, 'reply')).toBeNull()
    expect(ruleForType(bd, 'call')).toBeNull()
  })
  it('the filled-in note is not words', () => {
    expect(hasWords('First message sent')).toBe(false)
    expect(hasWords('  ')).toBe(false)
    expect(hasWords('Hello, I am Ada from Quadem Digital')).toBe(true)
  })
  it('asks for the words, then a screenshot where required', () => {
    expect(logProblem(ruleForType(bd, 'first-message'), 'first-message', 'First message sent', null)).toMatch(/Paste the message you sent/)
    expect(logProblem(ruleForType(bd, 'first-message'), 'first-message', 'Hello there', null)).toBeNull()
    expect(logProblem(ruleForType(bd, 'follow-up'), 'follow-up', 'Checking in again', null)).toMatch(/screenshot/)
    expect(logProblem(ruleForType(bd, 'follow-up'), 'follow-up', 'Checking in again', 42)).toBeNull()
    expect(logProblem({ label: 'Replies', source: 'replies', proof: 'words', proofRequired: true }, 'reply', '', null)).toMatch(/what they said/)
    // A role that does not ask, or asks without requiring: nothing is refused.
    expect(logProblem(null, 'first-message', '', null)).toBeNull()
    expect(logProblem({ label: 'F', source: 'firstMessages', proof: 'words', proofRequired: false }, 'first-message', '', null)).toBeNull()
  })
})

describe('proof of typed work, one item at a time', () => {
  const posts = { label: 'Posts published', source: 'typed', proof: 'link' as const, proofRequired: true }
  it('needs what the role asks for', () => {
    expect(itemProblem(posts, { text: 'Festive menu' })).toMatch(/link/)
    expect(itemProblem(posts, { link: 'instagram.com/p/1' })).toMatch(/does not look right/)
    expect(itemProblem(posts, { link: 'https://instagram.com/p/C9x' })).toBeNull()
    expect(itemProblem({ ...posts, proof: 'file' }, { link: 'https://x.test/a' })).toMatch(/screenshot or file/)
    expect(itemProblem({ ...posts, proof: 'file' }, { file: 7 })).toBeNull()
    expect(itemProblem({ ...posts, proofRequired: false }, {})).toMatch(/Say what it was/)
    expect(itemProblem(null, { link: 'https://x.test' })).toMatch(/does not count that/)
  })
  it('only typed counts with proof are added by item', () => {
    expect(byItems(posts)).toBe(true)
    expect(byItems({ source: 'typed', proof: 'none' })).toBe(false)
    expect(byItems({ source: 'firstMessages', proof: 'words' })).toBe(false)
  })
})
