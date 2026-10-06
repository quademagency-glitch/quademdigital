// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { generateContract, generateSetupInstructions, type ClientData } from '../../../src/lib/onboardingDocs'
import { assignParties } from '../../src/lib/signing/assign'
import { detectSignatureFields } from '../../src/lib/signing/detect'

/*
  What a new client's Service Agreement and Setup Instructions actually say
  (the site's src/lib/onboardingDocs.ts), read back out of the documents.
  A custom project promises exactly what was quoted; a one-off never
  promises monthly reports; the checklist never asks a client to send the
  work we are delivering.
*/

const siteRequire = createRequire(new URL('../../../src/lib/onboardingDocs.ts', import.meta.url))

async function pdfText(bytes: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise
  let text = ''
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    text += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n'
  }
  await doc.destroy()
  return text.replace(/\s+/g, ' ')
}

async function docxText(bytes: Buffer) {
  const JSZip = siteRequire('jszip')
  const zip = await JSZip.loadAsync(bytes)
  const xml: string = await zip.file('word/document.xml').async('string')
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
}

const client = (service: string, extra: Partial<ClientData['customizations']> = {}): ClientData => ({
  businessName: 'Ama Bakery Ltd',
  contactName: 'Ama Owusu',
  email: 'ama@example.test',
  service,
  price: 9000,
  currency: 'GHS',
  startDate: '2026-11-02',
  customizations: { duration: 0, ...extra },
})

const quoted = 'Online booking system for the salon\nStaff calendar with reminders by SMS\nTraining for two staff'

describe('the Service Agreement', () => {
  it('a custom project covers exactly what was quoted, and says the rest is quoted separately', async () => {
    const t = await pdfText(await generateContract(client('custom', { extraDeliverables: quoted })))
    expect(t).toContain('Custom Project')
    expect(t).toContain('The work covered by this Agreement is:')
    for (const line of quoted.split('\n')) expect(t).toContain(line)
    expect(t).toContain('Up to 2 rounds of revisions on the agreed work')
    expect(t).toContain('Anything not listed above is outside the scope of this Agreement and will be quoted separately if requested.')
    expect(t).not.toContain('Basic SEO setup')
    expect(t).not.toContain('Monthly reporting')
    expect(t).toContain('single, one-off engagement')
  }, 30_000)

  it('a custom project can be signed online: each party has its column', async () => {
    const pdf = await generateContract(client('custom', { extraDeliverables: quoted }))
    const det = await detectSignatureFields(new Uint8Array(pdf))
    const signers = [
      { name: 'Ama Owusu', email: 'ama@example.test', role: 'Client', organisation: 'Ama Bakery Ltd' },
      { name: 'Ernest Avorwlanu', email: 'ernest@quademdigital.com', role: 'Service Provider', organisation: 'Quadem Digital Enterprise' },
    ]
    const assigned = assignParties({ pages: det.pages, fields: [], parties: det.parties.map((p) => ({ id: p.id, page: p.page, witness: p.witness, context: p.context })) }, signers)
    expect(assigned[det.parties.find((p) => /SERVICE PROVIDER/.test(p.context))!.id]).toBe(1)
    expect(assigned[det.parties.find((p) => /CLIENT/.test(p.context))!.id]).toBe(0)
  }, 30_000)

  it('a custom project with no deliverables listed points to the quotation', async () => {
    const t = await pdfText(await generateContract(client('custom')))
    expect(t).toContain('The work described in the accepted quotation')
  }, 30_000)

  it('several services: no monthly reports on a one-off, and they stay on a monthly job', async () => {
    const once = await pdfText(await generateContract(client('multiple')))
    expect(once).toContain('The services set out in the accepted proposal or quotation')
    expect(once).not.toContain('Monthly reporting')
    expect(once).not.toContain('Anything not listed above')
    const monthly = await pdfText(await generateContract(client('multiple', { duration: 6 })))
    expect(monthly).toContain('Monthly reporting covering all active services')
  }, 30_000)

  it('a standard service keeps its standard list, with anything extra after it', async () => {
    const t = await pdfText(await generateContract(client('web-design', { extraDeliverables: 'Booking calendar' })))
    expect(t).toContain('Scope of deliverables includes:')
    expect(t).toContain('Basic SEO setup')
    expect(t).toContain('Booking calendar')
    expect(t).not.toContain('Anything not listed above')
  }, 30_000)
})

describe('the Setup Instructions', () => {
  it('a custom project asks for the basics and what is agreed on the kick-off call', async () => {
    const t = await docxText(await generateSetupInstructions(client('custom', { extraDeliverables: quoted })))
    expect(t).toContain('Setup Instructions: Custom Project')
    expect(t).toContain('What We Agree on Our Kick-off Call')
    expect(t).not.toContain('individual setup instruction sheets')
    expect(t).not.toContain('Additional Requirements')
    // The work we deliver is listed as received, never as a box for the client to tick.
    expect(t).toContain('What You Will Receive')
    expect(t).toContain('•  Online booking system for the salon')
    expect(t).not.toContain('☐  Online booking system for the salon')
  }, 30_000)

  it('several services no longer points to sheets that do not exist', async () => {
    const t = await docxText(await generateSetupInstructions(client('multiple')))
    expect(t).not.toContain('individual setup instruction sheets')
    expect(t).not.toContain('account manager')
    expect(t).toContain('We confirm exactly what each service needs on our kick-off call')
  }, 30_000)
})
