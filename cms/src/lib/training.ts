import type { PayloadRequest } from 'payload'
import { refId, userById } from './moneyContext'

/**
 * Training (spec 5.12 and 14.10). A job role lists its training areas; Ernest
 * writes modules for each area, with checklist items, materials and an
 * optional short quiz. Progress is one record per person and module. A module
 * is complete when every item is ticked and any quiz passed; Ernest signs it
 * off. An area is signed off when all its modules are.
 */

export type AreaState = 'not-started' | 'in-progress' | 'done'

/** Each training area of the person's job role, and where they are in it. */
export async function areaProgress(req: PayloadRequest, memberId: number): Promise<{ area: string; progress: AreaState }[]> {
  const person = await userById(req, memberId)
  const roleId = refId(person?.jobRole)
  if (!roleId) return []
  const role = (await req.payload.findByID({ collection: 'job-roles', id: roleId, depth: 0, overrideAccess: true, req }).catch(() => null)) as { trainingAreas?: { name?: string }[] } | null
  const areas = (role?.trainingAreas ?? []).map((a) => String(a.name ?? '')).filter(Boolean)
  if (!areas.length) return []
  const [modules, progress] = await Promise.all([
    req.payload.find({ collection: 'training-modules', where: { and: [{ jobRole: { equals: roleId } }, { active: { not_equals: false } }] }, limit: 500, depth: 0, overrideAccess: true, req, pagination: false }),
    req.payload.find({ collection: 'training-progress', where: { member: { equals: memberId } }, limit: 500, depth: 0, overrideAccess: true, req, pagination: false }),
  ])
  return areas.map((area) => {
    const mods = modules.docs.filter((m) => (m as { area?: string }).area === area)
    const mine = progress.docs.filter((p) => mods.some((m) => String(m.id) === String(refId((p as { module?: unknown }).module))))
    const done = mods.length > 0 && mods.every((m) => mine.some((p) => String(refId((p as { module?: unknown }).module)) === String(m.id) && (p as { signedOffAt?: string }).signedOffAt))
    const started = mine.some((p) => ((p as { ticked?: unknown[] }).ticked ?? []).length > 0 || (p as { quizScore?: number }).quizScore != null)
    return { area, progress: done ? 'done' : started ? 'in-progress' : 'not-started' }
  })
}

/** Grade quiz answers: `answers[i]` is the 1-based choice for question i. */
export function gradeQuiz(quiz: { answer?: number | null }[], answers: (number | null | undefined)[]) {
  if (!quiz.length) return { score: 100, right: 0, total: 0 }
  const right = quiz.filter((q, i) => Number(q.answer) > 0 && Number(answers[i]) === Number(q.answer)).length
  return { score: Math.round((right / quiz.length) * 100), right, total: quiz.length }
}
