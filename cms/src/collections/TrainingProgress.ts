import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { adminMineOrManaged, manages, reviewersOf } from '../access/managers'
import { audit } from '../lib/audit'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'
import { gradeQuiz } from '../lib/training'

/**
 * One person's progress in one training module (spec 5.12): the items they
 * have ticked, their quiz result, and Ernest's sign-off. They tick; the CMS
 * marks the quiz; only Ernest signs off.
 */

type Module = { id: number; title?: string; items?: { id?: string; text?: string }[]; quiz?: { answer?: number | null }[]; passMark?: number | null }
const moduleById = async (req: PayloadRequest, id: unknown) =>
  (await req.payload.findByID({ collection: 'training-modules', id: Number(refId(id)), depth: 0, overrideAccess: true, req }).catch(() => null)) as Module | null

export const TrainingProgress: CollectionConfig = {
  slug: 'training-progress',
  labels: { singular: 'Training progress', plural: 'Training progress' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'member', 'completedAt', 'signedOffAt'] },
  access: {
    read: adminMineOrManaged('member'),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    // Their own ticks; a manager signs off their people's modules.
    update: adminMineOrManaged('member'),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req, context }) => {
        const user = req.user as { id: number } | null
        const team = hasRole(req.user, 'team')
        const self = operation === 'create' || String(refId(originalDoc?.member)) === String(user?.id)
        // Ernest signs off, and so does the person's manager; nobody signs off their own.
        let signer = !team
        if (team && self) {
          if (operation === 'create') data.member = user!.id
          // Theirs: the ticks. The quiz score comes from the CMS, the sign-off from Ernest or their manager.
          if (!context?.quiz) for (const k of ['quizScore', 'quizPassedAt', 'signedOffAt', 'signedOffBy']) data[k] = originalDoc?.[k] ?? null
          if (originalDoc?.signedOffAt) throw new APIError('This module is signed off.', 403)
        } else if (team) {
          if (!(await manages(req, originalDoc?.member))) throw new APIError('Only Ernest or their manager can sign this off.', 403)
          if (originalDoc?.signedOffAt) throw new APIError('This module is signed off.', 403)
          const signOff = Boolean(data.signedOffAt)
          for (const k of Object.keys(data)) data[k] = originalDoc?.[k] ?? null
          data.signedOffAt = signOff ? true : null
          signer = true
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const mod = await moduleById(req, merged.module)
        if (!mod) throw new APIError('That module is not there.', 400)
        if (operation === 'create') {
          const existing = await req.payload.find({ collection: 'training-progress', where: { and: [{ member: { equals: refId(merged.member) } }, { module: { equals: mod.id } }] }, limit: 1, depth: 0, overrideAccess: true, req })
          if (existing.docs.length) throw new APIError('There is already progress for this module.', 409)
        }
        // Only real items can be ticked, each once, with the time it was ticked.
        const ids = new Set((mod.items ?? []).map((i) => i.id))
        const before = new Map(((originalDoc?.ticked ?? []) as { item: string; at: string }[]).map((t) => [t.item, t.at]))
        const ticked = ((merged.ticked ?? []) as { item: string }[]).filter((t) => ids.has(t.item))
        data.ticked = [...new Map(ticked.map((t) => [t.item, { item: t.item, at: before.get(t.item) ?? new Date().toISOString() }])).values()]
        const quizDone = !(mod.quiz ?? []).length || Boolean(merged.quizPassedAt)
        const allTicked = (mod.items ?? []).every((i) => data.ticked.some((t: { item: string }) => t.item === i.id))
        data.completedAt = allTicked && quizDone ? (originalDoc?.completedAt ?? new Date().toISOString()) : null
        if (signer && data.signedOffAt && !originalDoc?.signedOffAt) {
          data.signedOffAt = new Date().toISOString()
          data.signedOffBy = user?.id ?? null
        }
        const person = await userById(req, refId(merged.member))
        data.title = `${person?.name || person?.email || 'Someone'} · ${mod.title ?? 'Module'}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const memberId = refId(doc.member)
        const person = await userById(req, memberId)
        const mod = await moduleById(req, doc.module)
        if (doc.completedAt && !previousDoc?.completedAt && !doc.signedOffAt) {
          await notify(req, { to: await reviewersOf(req, memberId, await adminIds(req)), kind: 'training', title: `${person?.name || 'A team member'} finished ${mod?.title ?? 'a module'}`, body: 'Ready for you to sign off.', link: '/training', action: 'Sign it off', key: `training-done:${doc.id}` })
        }
        if (doc.signedOffAt && !previousDoc?.signedOffAt) {
          await audit(req, { action: 'training.signed-off', summary: `${mod?.title ?? 'A module'} signed off for ${person?.name || person?.email}`, person: memberId, subjectType: 'training-progress', subjectId: doc.id })
          await notify(req, { to: [memberId], kind: 'training', title: `Signed off: ${mod?.title ?? 'a training module'}`, link: '/training', key: `training-signed:${doc.id}` })
        }
        return doc
      },
    ],
  },
  endpoints: [
    {
      // The quiz is marked here, against answers the browser never sees.
      path: '/quiz',
      method: 'post',
      handler: async (req) => {
        if (!hasRole(req.user, 'team')) return Response.json({ error: 'Only a team member takes the quiz.' }, { status: 403 })
        const body = (await req.json?.().catch(() => null)) as { module?: number; answers?: number[] } | null
        const mod = body?.module ? await moduleById(req, body.module) : null
        if (!mod || !(mod.quiz ?? []).length) return Response.json({ error: 'That module has no quiz.' }, { status: 400 })
        const { score, right, total } = gradeQuiz(mod.quiz ?? [], body?.answers ?? [])
        const passed = score >= Number(mod.passMark ?? 80)
        const me = req.user!.id
        const existing = await req.payload.find({ collection: 'training-progress', where: { and: [{ member: { equals: me } }, { module: { equals: mod.id } }] }, limit: 1, depth: 0, overrideAccess: true, req })
        const prior = existing.docs[0] as { id: number; quizPassedAt?: string; signedOffAt?: string } | undefined
        if (prior?.signedOffAt) return Response.json({ error: 'This module is signed off.' }, { status: 403 })
        const data = { quizScore: score, quizPassedAt: passed ? (prior?.quizPassedAt ?? new Date().toISOString()) : (prior?.quizPassedAt ?? null) }
        if (prior) await req.payload.update({ collection: 'training-progress', id: prior.id, data, overrideAccess: false, user: req.user, req, context: { quiz: true } })
        else await req.payload.create({ collection: 'training-progress', data: { member: me, module: mod.id, ticked: [], ...data } as never, overrideAccess: false, user: req.user, req, context: { quiz: true } })
        return Response.json({ score, right, total, passed, passMark: Number(mod.passMark ?? 80) })
      },
    },
  ],
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'member', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { width: '50%' } },
        { name: 'module', type: 'relationship', relationTo: 'training-modules', required: true, index: true, admin: { width: '50%' } },
      ],
    },
    {
      name: 'ticked',
      type: 'array',
      admin: { description: 'Checklist items ticked, with when.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'item', type: 'text', required: true, admin: { width: '60%' } },
            { name: 'at', type: 'date', admin: { width: '40%', date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'quizScore', label: 'Quiz, %', type: 'number', admin: { width: '25%', readOnly: true } },
        { name: 'quizPassedAt', label: 'Quiz passed', type: 'date', admin: { width: '25%', readOnly: true } },
        { name: 'completedAt', label: 'Finished', type: 'date', admin: { width: '25%', readOnly: true } },
        { name: 'signedOffAt', label: 'Signed off', type: 'date', admin: { width: '25%' } },
      ],
    },
    { name: 'signedOffBy', label: 'Signed off by', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
