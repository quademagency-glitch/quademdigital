import { describe, expect, it } from 'vitest'
import { gradeQuiz } from '../../src/lib/training'

describe('quiz marking', () => {
  const quiz = [{ answer: 2 }, { answer: 1 }, { answer: 3 }, { answer: 1 }, { answer: 2 }]
  it('scores the share of right answers', () => {
    expect(gradeQuiz(quiz, [2, 1, 3, 1, 2])).toEqual({ score: 100, right: 5, total: 5 })
    expect(gradeQuiz(quiz, [2, 1, 3, 4, 1])).toEqual({ score: 60, right: 3, total: 5 })
  })
  it('counts an unanswered question as wrong', () => {
    expect(gradeQuiz(quiz, [2, 1, 3, 1]).score).toBe(80)
  })
  it('a module with no quiz passes', () => {
    expect(gradeQuiz([], []).score).toBe(100)
  })
})
