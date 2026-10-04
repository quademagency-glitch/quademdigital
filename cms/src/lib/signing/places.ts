/**
 * The places on a document: where each person signs, and the blanks that get
 * typed into it.
 *
 * Shared by the CMS (saving, sending, stamping) and the admin editor, so it
 * imports nothing that only runs on a server.
 *
 * Who fills a place is written in its `party`:
 *
 *   a detected party id    "p7c0", "p7c1w", "initials:trainee": whoever that
 *                          signature block or initials key is matched to
 *   "signer:<row id>"      one signer, chosen by hand in the editor
 *   "sender"               Ernest, before sending: a blank he types into
 *   "none"                 nobody: the place stays empty
 */

export const KINDS = ['signature', 'initials', 'name', 'date', 'title', 'text'] as const
export type PlaceKind = (typeof KINDS)[number]

export const SENDER = 'sender'
export const NOBODY = 'none'
export const SIGNER_PREFIX = 'signer:'

export interface Place {
  id?: string | null
  page: number
  x: number
  y: number
  width: number
  height: number
  kind: PlaceKind
  party: string
  /** Where the detector found it, in the document's own words. */
  context?: string | null
  /** For a text blank: what goes in it, shown to whoever fills it. */
  label?: string | null
  /** For a blank Ernest fills: what he typed. */
  value?: string | null
  /** For a blank a signer fills: whether they must. */
  required?: boolean | null
}

/** A detected party as stored: loosely typed, because stored rows are. */
export interface PartyLike {
  partyId?: unknown
  signerId?: unknown
}

export const LIMITS = { places: 400, label: 120, value: 500, signerText: 300 }

/** A blank found on a placeholder ("[Client name]", "{{fee}}"): what is typed covers the placeholder. */
export const covers = (place: { context?: unknown }) => /^(\[.*\]|\{\{.*\}\}|<<.*>>|«.*»)$/.test(String(place.context || '').trim())

/** A signer row id, SENDER, or null when nobody fills the place. */
export function ownerOf(place: { party?: unknown }, parties: PartyLike[]): string | null {
  const party = String(place.party || '')
  if (party === SENDER) return SENDER
  if (party.startsWith(SIGNER_PREFIX)) return party.slice(SIGNER_PREFIX.length) || null
  const p = parties.find((x) => String(x.partyId) === party)
  return p?.signerId ? String(p.signerId) : null
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))
const r1 = (n: number) => Math.round(n * 10) / 10
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/**
 * Checks the places the editor sends, and returns them clean, or a sentence
 * saying what is wrong. Positions are clamped onto the page rather than
 * refused, because a box dragged a little past the edge is not a mistake
 * worth stopping a save for.
 */
export function cleanPlaces(
  input: unknown,
  ctx: { pages: { width: number; height: number }[]; partyIds: Set<string>; signerIds: Set<string> },
): Place[] | string {
  if (!Array.isArray(input)) return 'The places did not arrive.'
  if (input.length > LIMITS.places) return `That is more than ${LIMITS.places} places.`
  const out: Place[] = []
  for (const [i, raw] of input.entries()) {
    const p = (raw || {}) as Record<string, unknown>
    const at = `Place ${i + 1}`
    const page = num(p.page)
    if (!Number.isInteger(page) || page < 1 || page > ctx.pages.length) return `${at} is on a page the document does not have.`
    const { width: W, height: H } = ctx.pages[page - 1]
    const kind = String(p.kind) as PlaceKind
    if (!KINDS.includes(kind)) return `${at} is an unknown kind of place.`
    const [x, y, w, h] = [num(p.x), num(p.y), num(p.width), num(p.height)]
    if (![x, y, w, h].every(Number.isFinite)) return `${at} has no position.`
    const width = Math.min(Math.max(8, w), W)
    const height = Math.min(Math.max(6, h), H)
    const party = String(p.party || '')
    const ownedBySigner = party.startsWith(SIGNER_PREFIX)
    if (party === SENDER) {
      if (kind !== 'text') return `${at}: only a text blank can be filled in by you before sending.`
    } else if (ownedBySigner) {
      if (!ctx.signerIds.has(party.slice(SIGNER_PREFIX.length))) return `${at} is given to someone no longer on the list of signers. Save the signers first.`
    } else if (party !== NOBODY && !ctx.partyIds.has(party)) {
      return `${at} belongs to a signature block the document does not have.`
    }
    out.push({
      id: typeof p.id === 'string' && /^[a-f0-9]{24}$/.test(p.id) ? p.id : null,
      page,
      x: r1(Math.min(Math.max(0, x), W - width)),
      y: r1(Math.min(Math.max(0, y), H - height)),
      width: r1(width),
      height: r1(height),
      kind,
      party,
      context: text(p.context, 200) || null,
      label: kind === 'text' ? text(p.label, LIMITS.label) || null : null,
      value: kind === 'text' && party === SENDER ? (typeof p.value === 'string' ? p.value.trim().slice(0, LIMITS.value) : '') || null : null,
      required: kind === 'text' && party !== SENDER ? p.required !== false : null,
    })
  }
  return out
}
