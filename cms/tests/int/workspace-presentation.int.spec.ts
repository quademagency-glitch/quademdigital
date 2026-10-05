import { describe, expect, it } from 'vitest'
import type { CollectionConfig, Field } from 'payload'
import {
  sectionFields,
  workspaceCollection,
  workspaceGlobal,
} from '../../src/lib/workspacePresentation'

const named = (fields: Field[]): string[] =>
  fields.flatMap((f) =>
    f.type === 'tabs' ? f.tabs.flatMap((t) => named(t.fields)) : 'name' in f ? [f.name] : [],
  )

describe('Workspace editor sections', () => {
  it('retains every field exactly once, including future additions, hidden values and sidebar controls', () => {
    const fields: Field[] = [
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'richText' },
      { name: 'futureField', type: 'text' },
      { name: 'hiddenValue', type: 'text', admin: { hidden: true } },
      { name: 'status', type: 'text', admin: { position: 'sidebar' } },
    ]
    const grouped = sectionFields(fields, [{ label: 'Article', names: ['title', 'content'] }])
    expect(named(grouped).sort()).toEqual(named(fields).sort())
    expect(grouped.slice(1)).toEqual(fields.slice(3))
    expect(grouped[0]).toMatchObject({
      type: 'tabs',
      tabs: [{ label: 'Article' }, { label: 'More details' }],
    })
    expect('name' in grouped[0]).toBe(false)
  })
  it('keeps collection hooks and access rules and leaves source definitions untouched', () => {
    const original: CollectionConfig = {
      slug: 'blogPosts',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'json' },
      ],
      access: { read: () => true },
      hooks: { beforeChange: [({ data }) => data] },
    }
    const before = JSON.stringify(original)
    const presented = workspaceCollection(original)
    expect(presented.access).toBe(original.access)
    expect(presented.hooks).toBe(original.hooks)
    expect(JSON.stringify(original)).toBe(before)
    expect(named(presented.fields).sort()).toEqual(['body', 'title'])
    const tabs = presented.fields[0]
    if (tabs.type !== 'tabs') throw Error('Expected tabs')
    expect(tabs.tabs.find((t) => t.label === 'Legacy content')?.fields[0].admin).toMatchObject({
      readOnly: true,
    })
  })
  it('does not drop unknown global settings or change their permissions', () => {
    const global = {
      slug: 'siteSettings',
      fields: [
        {
          name: 'bankDetails',
          type: 'group' as const,
          access: { read: () => false },
          fields: [{ name: 'accountNumber', type: 'text' as const }],
        },
        { name: 'futureSetting', type: 'text' as const },
      ],
    }
    const result = workspaceGlobal(global)
    expect(named(result.fields).sort()).toEqual(['bankDetails', 'futureSetting'])
    const tabs = result.fields[0]
    if (tabs.type !== 'tabs') throw Error('Expected tabs')
    expect(tabs.tabs[0].fields[0]).toBe(global.fields[0])
  })
})
