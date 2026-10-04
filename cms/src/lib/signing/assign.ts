import type { Detection, DetectedParty } from './detect'

/**
 * Who each detected place belongs to.
 *
 * A party is a column of a signature block (or a witness under it, or a set of
 * initials), and the words around it usually say whose it is: "CLIENT", "For
 * Citywide Property Services Ltd", "THE TRAINEE · Charles Ohanu". Each signer
 * is scored against every party and the clearest matches are taken first.
 * Anything left unclear is left unassigned for Ernest to choose on the
 * request, rather than guessed, with one exception: when exactly one party and
 * one signer are left over, they belong together.
 */

export interface SignerLike {
  name: string
  email: string
  role?: string | null
  organisation?: string | null
}

export type Assignment = Record<string, number | null>

const C = (s: string | null | undefined) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const words = (s: string) => (s || '').split(/[^A-Za-z]+/).filter((w) => w.length >= 3).map(C)

const QUADEM_WORDS = /QUADEM|SERVICEPROVIDER|THEPROVIDER|PROVIDER|THECOMPANY|COMPANY|EMPLOYER/
export const isQuademSigner = (s: SignerLike) =>
  /@quademdigital\.com$/i.test(s.email.trim()) || /QUADEM/.test(C(s.organisation)) || /ERNESTAVORWLANU/.test(C(s.name))
const isWitnessSigner = (s: SignerLike) => /WITNESS/.test(C(s.role))

function score(party: DetectedParty, s: SignerLike, contextOverride?: string) {
  const ctx = C(contextOverride ?? party.context)
  let n = 0
  if (C(s.name) && ctx.includes(C(s.name))) n += 30
  for (const w of words(s.name)) if (ctx.includes(w)) n += 8
  if (C(s.organisation).length >= 3 && ctx.includes(C(s.organisation))) n += 20
  for (const w of words(s.organisation || '')) if (w.length >= 4 && ctx.includes(w)) n += 4
  for (const w of words(s.role || '')) if (w !== 'WITNESS' && ctx.includes(w)) n += 12
  const quademSide = QUADEM_WORDS.test(ctx)
  if (isQuademSigner(s)) n += quademSide ? 25 : -10
  else if (quademSide) n -= 15
  return n
}

/**
 * Whose a blank outside the signature section is, from the words around it:
 * "Address: ____" under "THE TRAINEE · Charles Ohanu" is Charles's. Only a
 * clear winner counts; anything less stays Ernest's to fill before sending.
 */
export function signerForContext(context: string, signers: SignerLike[]): number | null {
  if (!context.trim()) return null
  const party: DetectedParty = { id: '', page: 0, witness: false, context }
  const ranked = signers.map((s, i) => ({ i, n: score(party, s) })).sort((a, b) => b.n - a.n)
  if (!ranked.length || ranked[0].n < 12) return null
  // Words naming both sides ("between Quadem and Citywide") say nothing about
  // whose blank it is, so a second person with any claim at all means nobody.
  if (ranked[1] && ranked[1].n > 0) return null
  return ranked[0].i
}

function greedy(parties: DetectedParty[], signers: SignerLike[], pool: number[], out: Assignment, ctx?: (p: DetectedParty) => string) {
  const pairs: { p: string; i: number; n: number }[] = []
  for (const p of parties) for (const i of pool) pairs.push({ p: p.id, i, n: score(p, signers[i], ctx?.(p)) })
  pairs.sort((a, b) => b.n - a.n)
  const used = new Set<number>()
  for (const { p, i, n } of pairs) {
    if (n <= 0 || out[p] != null || used.has(i)) continue
    out[p] = i
    used.add(i)
  }
  // Exactly one of each left over: they belong together.
  const leftP = parties.filter((p) => out[p.id] == null)
  const leftS = pool.filter((i) => !used.has(i))
  if (leftP.length === 1 && leftS.length === 1) out[leftP[0].id] = leftS[0]
}

export function assignParties(det: Detection, signers: SignerLike[]): Assignment {
  const out: Assignment = Object.fromEntries(det.parties.map((p) => [p.id, null]))
  const main = det.parties.filter((p) => !p.witness && !p.id.startsWith('initials:'))
  const witnesses = det.parties.filter((p) => p.witness)
  const initials = det.parties.filter((p) => p.id.startsWith('initials:'))
  const people = signers.map((_, i) => i).filter((i) => !isWitnessSigner(signers[i]))
  const witnessPeople = signers.map((_, i) => i).filter((i) => isWitnessSigner(signers[i]))

  // A document can repeat its signature block on more than one page; each
  // page's block is matched on its own.
  for (const page of new Set(main.map((p) => p.page))) greedy(main.filter((p) => p.page === page), signers, people, out)
  for (const page of new Set(witnesses.map((p) => p.page))) greedy(witnesses.filter((p) => p.page === page), signers, witnessPeople, out)

  // Initials go with whichever party carries the same word ("Initials:
  // Trainee" with "THE TRAINEE"), then by the same scoring, then in order.
  initials.forEach((p, idx) => {
    const key = C(p.id.slice('initials:'.length))
    const twin = main.find((m) => key.length >= 3 && C(m.context).includes(key) && out[m.id] != null)
    if (twin) { out[p.id] = out[twin.id]; return }
    if (key === 'COMPANY' || QUADEM_WORDS.test(key)) {
      const q = people.find((i) => isQuademSigner(signers[i]))
      if (q != null) { out[p.id] = q; return }
    }
    const best = people.map((i) => ({ i, n: score(p, signers[i], key) })).sort((a, b) => b.n - a.n)[0]
    if (best && best.n > 0) { out[p.id] = best.i; return }
    if (/^\d+$/.test(key) && people[Number(key)] != null) out[p.id] = people[Number(key)]
    void idx
  })

  // Initials left over when everyone else is placed: the one signer not yet
  // initialling takes the one key not yet taken.
  const leftKeys = initials.filter((p) => out[p.id] == null)
  const initialling = new Set(initials.map((p) => out[p.id]).filter((v) => v != null))
  const leftPeople = people.filter((i) => !initialling.has(i))
  if (leftKeys.length === 1 && leftPeople.length === 1) out[leftKeys[0].id] = leftPeople[0]

  return out
}
