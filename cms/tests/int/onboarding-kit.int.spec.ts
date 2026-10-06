// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { SERVICE_OPTIONS } from '../../src/collections/JourneyTemplates'
import { attachGuideOnWin, pickTemplate } from '../../src/lib/onboardingKit'
import { STARTER_GUIDES, STARTER_TEMPLATES, writingToRichText } from '../../src/lib/onboardingStarters'

const services = SERVICE_OPTIONS.map((o) => o.value)

describe('the starter journeys and guides', () => {
  it('one journey and one guide for every service, and one fallback of each', () => {
    expect(STARTER_TEMPLATES.map((t) => t.service).sort()).toEqual([...services].sort())
    expect(STARTER_GUIDES.map((g) => g.service).sort()).toEqual([...services].sort())
    expect(STARTER_TEMPLATES.filter((t) => t.isDefault)).toHaveLength(1)
    expect(STARTER_GUIDES.filter((g) => g.isDefault)).toHaveLength(1)
    expect(new Set(STARTER_TEMPLATES.map((t) => t.name)).size).toBe(STARTER_TEMPLATES.length)
    expect(new Set(STARTER_GUIDES.map((g) => g.title)).size).toBe(STARTER_GUIDES.length)
  })

  it('steps run in date order, start with the kick-off and end with something for the client', () => {
    for (const t of STARTER_TEMPLATES) {
      const days = t.steps.map((s) => s.dueOffsetDays)
      expect(days, t.name).toEqual([...days].sort((a, b) => a - b))
      expect(t.steps[0].title, t.name).toBe('Kick-off call')
      expect(t.steps.some((s) => s.owner === 'client'), t.name).toBe(true)
      for (const s of t.steps) expect(s.title.length, `${t.name}: ${s.title}`).toBeLessThanOrEqual(60)
    }
  })

  it('plain words: no em dashes, no account manager, no passwords asked for', () => {
    const all = JSON.stringify([STARTER_TEMPLATES, STARTER_GUIDES])
    expect(all).not.toContain('—')
    expect(all.toLowerCase()).not.toContain('account manager')
    for (const g of STARTER_GUIDES) expect(g.writing, g.title).toContain('never send a password')
  })

  it('a guide becomes rich text the website can show', () => {
    const rich = writingToRichText('## What I need\n- Your logo.\n- Photos.\n\n1. First\n2. Second\n\nA line\nthat continues.')
    const kids = rich.root.children as any[]
    expect(kids.map((k) => k.type)).toEqual(['heading', 'list', 'list', 'paragraph'])
    expect(kids[0]).toMatchObject({ tag: 'h2', children: [{ text: 'What I need' }] })
    expect(kids[1]).toMatchObject({ listType: 'bullet', tag: 'ul' })
    expect(kids[1].children.map((li: any) => li.children[0].text)).toEqual(['Your logo.', 'Photos.'])
    expect(kids[2]).toMatchObject({ listType: 'number', tag: 'ol' })
    expect(kids[3].children[0].text).toBe('A line that continues.')
  })
})

describe('picking and attaching', () => {
  const fakeReq = (docs: Record<string, unknown>[]) => {
    const find = vi.fn(async ({ where }: { where: any }) => {
      const cond = where.and[1]
      const hit = docs.filter((d) => d.ready === true && (cond.service ? d.service === cond.service.equals : d.isDefault === true))
      return { docs: hit, totalDocs: hit.length }
    })
    return { payload: { find, logger: { error: vi.fn() } } } as any
  }

  it('only a ready one is picked, the service first, then the fallback', async () => {
    const req = fakeReq([
      { id: 1, service: 'web-design', ready: false },
      { id: 2, service: 'multiple', isDefault: true, ready: true },
    ])
    expect((await pickTemplate(req.payload, 'web-design'))?.id).toBe(2)
    expect(req.payload.find.mock.calls[0][0].where.and[0]).toEqual({ ready: { equals: true } })
  })

  it('attaches the guide only at the moment a client is Won, and never over one already there', async () => {
    const req = fakeReq([{ id: 7, service: 'branding', ready: true }])
    const run = (data: any, originalDoc?: any) => attachGuideOnWin({ data, originalDoc, req } as any)
    expect(await run({ pipelineStatus: 'won', service: 'branding' })).toMatchObject({ onboardingGuide: 7 })
    expect(await run({ pipelineStatus: 'won', service: 'branding' }, { pipelineStatus: 'proposal' })).toMatchObject({ onboardingGuide: 7 })
    expect((await run({ pipelineStatus: 'won', service: 'branding', onboardingGuide: null }, { pipelineStatus: 'won' })).onboardingGuide).toBeNull()
    expect((await run({ pipelineStatus: 'won', service: 'branding', onboardingGuide: 3 })).onboardingGuide).toBe(3)
    expect((await run({ pipelineStatus: 'proposal', service: 'branding' })).onboardingGuide).toBeUndefined()
  })

  it('a failed lookup never stops the client being saved', async () => {
    const req = { payload: { find: vi.fn(async () => { throw new Error('down') }), logger: { error: vi.fn() } } } as any
    const data = await attachGuideOnWin({ data: { pipelineStatus: 'won', service: 'branding' }, req } as any)
    expect(data).toMatchObject({ pipelineStatus: 'won' })
    expect(req.payload.logger.error).toHaveBeenCalled()
  })
})
