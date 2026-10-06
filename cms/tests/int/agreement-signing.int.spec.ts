// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderAgreementPdf } from '../../../src/lib/agreementPdf'
import { assignParties } from '../../src/lib/signing/assign'
import { detectSignatureFields } from '../../src/lib/signing/detect'
import { placesReady } from '../../src/lib/agreementSigning'

/*
  The agreement onboarding writes (the site's src/lib/agreementPdf.ts) must
  keep a signature section the signing detector reads: a column for each
  party, each matched to the right person. If someone redesigns that section,
  this fails before a client is sent an agreement nobody can sign.
*/
const blocks = [
  { kind: 'title' as const, text: 'Service Agreement' },
  ...Array.from({ length: 10 }, (_, i) => [
    { kind: 'heading' as const, text: `${i + 1}. CLAUSE` },
    { kind: 'paragraph' as const, text: 'Both parties agree to keep confidential any proprietary or sensitive information shared during the engagement. '.repeat(3) },
  ]).flat(),
  { kind: 'heading' as const, text: '11. SIGNATURES' },
  { kind: 'paragraph' as const, text: 'By signing below, both parties agree to be bound by the terms of this Agreement.' },
  { kind: 'space' as const },
  { kind: 'signatures' as const },
]
const signers = [
  { name: 'Ama Owusu', email: 'ama@example.test', role: 'Client', organisation: 'Ama Bakery & Sons Ltd' },
  { name: 'Ernest Avorwlanu', email: 'ernest@quademdigital.com', role: 'Service Provider', organisation: 'Quadem Digital Enterprise' },
]

describe('the onboarding agreement, signed online', () => {
  it('has a column for each party, matched to the right person, with signature, name and date', async () => {
    const pdf = await renderAgreementPdf('Ama Bakery & Sons Ltd', blocks)
    const det = await detectSignatureFields(new Uint8Array(pdf))
    expect(det.parties.filter((p) => !p.witness)).toHaveLength(2)
    const assigned = assignParties({ pages: det.pages, fields: [], parties: det.parties.map((p) => ({ id: p.id, page: p.page, witness: p.witness, context: p.context })) }, signers)
    const provider = det.parties.find((p) => /SERVICE PROVIDER/.test(p.context))!
    const client = det.parties.find((p) => /CLIENT/.test(p.context))!
    expect(assigned[provider.id]).toBe(1)
    expect(assigned[client.id]).toBe(0)
    for (const party of [provider, client]) {
      const kinds = det.fields.filter((f) => f.party === party.id).map((f) => f.kind).sort()
      expect(kinds).toEqual(['date', 'name', 'signature'])
    }
    // Both columns line up: the same heights for the same kind of place.
    const sig = det.fields.filter((f) => f.kind === 'signature')
    expect(sig[0].y).toBe(sig[1].y)
  })

  it('a long business name still fits its column', async () => {
    const pdf = await renderAgreementPdf('The Very Long Business Name Holdings Limited of Greater Accra', blocks)
    const det = await detectSignatureFields(new Uint8Array(pdf))
    expect(det.parties.filter((p) => !p.witness)).toHaveLength(2)
  })

  it('says what is missing before anything is sent', () => {
    const base = { signers: [{ id: 'a', name: 'Ama' }, { id: 'b', name: 'Ernest' }] }
    expect(placesReady({ ...base, parties: [], places: [] })).toMatch(/No signature section/)
    expect(placesReady({ ...base, parties: [{ partyId: 'p0', signerId: 'a' }, { partyId: 'p1', signerId: null }], places: [] })).toMatch(/could not be matched/)
    expect(placesReady({ ...base, parties: [{ partyId: 'p0', signerId: 'a' }, { partyId: 'p1', signerId: 'b' }], places: [{ kind: 'signature', party: 'p0' }] })).toMatch(/no place for Ernest/)
    expect(placesReady({ ...base, parties: [{ partyId: 'p0', signerId: 'a' }, { partyId: 'p1', signerId: 'b' }], places: [{ kind: 'signature', party: 'p0' }, { kind: 'signature', party: 'signer:b' }] })).toBeNull()
  })
})
