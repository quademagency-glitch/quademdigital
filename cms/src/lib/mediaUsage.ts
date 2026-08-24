import type { Payload } from 'payload'

/**
 * Where is this file used?
 *
 * The media library had no answer, so deleting a file was a guess: the upload
 * disappeared and whichever page pointed at it rendered a gap, with nothing at
 * the point of deletion to warn you.
 *
 * The answer comes from Postgres rather than from the Payload config, because
 * Postgres already knows it. Every upload field becomes a real foreign key to
 * `media.id`, so asking the database which columns reference it returns all of
 * them, blocks and globals and arrays included, and keeps returning the right
 * answer when a new block is added without anyone remembering a list here.
 *
 * A hit is walked up its `_parent_id` chain to the document that owns it, so
 * the answer reads "Pages" rather than
 * "_pages_v_blocks_hero_section.background_image_id".
 *
 * All of it is one UNION query. Asking each reference point separately meant
 * 65 round trips per file, which was slow enough to be felt on every media
 * edit screen.
 */

export type MediaUsage = {
  /** Table the owning document lives in, for example `pages`. */
  table: string
  /** Human label, for example "Pages" or "Homepage". */
  label: string
  /** True when the only path to it ran through a version (history) table. */
  historyOnly: boolean
}

type Fk = { child: string; column: string; parent: string }

type Schema = { refs: Fk[]; parentOf: Map<string, string> }
let schemaCache: Schema | null = null

const rowsOf = async (payload: Payload, text: string, values: unknown[] = []) => {
  // The drizzle adapter holds the pool the rest of Payload uses, so this joins
  // the same connection rather than opening a second one.
  const pool = (payload.db as unknown as { pool?: { query: Function } }).pool
  if (!pool?.query) throw new Error('No Postgres pool available for the media usage lookup.')
  const res = await pool.query(text, values)
  return (res.rows || []) as Record<string, any>[]
}

const isVersionTable = (t: string) => /^_.*_v(_|$)/.test(t)

async function loadSchema(payload: Payload): Promise<Schema> {
  if (schemaCache) return schemaCache
  const rows = await rowsOf(
    payload,
    `SELECT tc.table_name AS child, kcu.column_name AS "column", ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
  )
  const fks = rows as unknown as Fk[]
  const parentOf = new Map<string, string>()
  for (const f of fks) {
    if (f.column === '_parent_id' || f.column === 'parent_id') parentOf.set(f.child, f.parent)
  }
  const refs = fks.filter(
    (f) =>
      f.parent === 'media' &&
      f.column !== '_parent_id' &&
      f.column !== 'parent_id' &&
      // An editing lock is not a use of the picture.
      f.child !== 'payload_locked_documents_rels',
  )
  schemaCache = { refs, parentOf }
  return schemaCache
}

/** Follow `_parent_id` up to the document that owns the row. */
function rootOf(table: string, parentOf: Map<string, string>) {
  let current = table
  let history = isVersionTable(current)
  const seen = new Set<string>()
  while (parentOf.has(current) && !seen.has(current)) {
    seen.add(current)
    current = parentOf.get(current)!
    if (isVersionTable(current)) history = true
  }
  return { root: current, history }
}

const toTable = (slug: string) =>
  slug.replace(/-/g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

export async function findMediaUsage(
  payload: Payload,
  mediaId: number | string,
): Promise<MediaUsage[]> {
  const { refs, parentOf } = await loadSchema(payload)
  if (!refs.length) return []

  const known = [
    ...payload.config.collections.map((c) => ({
      table: toTable(c.slug),
      label: typeof c.labels?.plural === 'string' ? c.labels.plural : c.slug,
    })),
    ...payload.config.globals.map((g) => ({
      table: toTable(g.slug),
      label: typeof g.label === 'string' ? g.label : g.slug,
    })),
  ].sort((a, b) => b.table.length - a.table.length)

  /*
    A root table that is not itself a collection or a global falls back to the
    longest known table name it starts with, which is how a nested table like
    `site_settings_certifications` resolves to Site Settings.
  */
  const resolve = (table: string) =>
    known.find((k) => table === k.table) || known.find((k) => table.startsWith(`${k.table}_`))

  /*
    Identifiers are interpolated because they come from information_schema and
    cannot be user input. The media id is parameterised.
  */
  const union = refs
    .map((r, i) => `SELECT ${i} AS ref FROM "${r.child}" WHERE "${r.column}" = $1 LIMIT 1`)
    .join(' UNION ALL ')

  let hits: Record<string, any>[]
  try {
    hits = await rowsOf(payload, union, [mediaId])
  } catch (err) {
    payload.logger.error({ err }, 'Media usage lookup failed')
    throw err
  }

  const found = new Map<string, MediaUsage>()
  for (const hit of hits) {
    const ref = refs[Number(hit.ref)]
    if (!ref) continue
    const { root, history } = rootOf(ref.child, parentOf)
    // A generated mockup pointing back at the image it was made from.
    if (root === 'media') continue
    const owner = resolve(root)
    if (!owner) continue
    const existing = found.get(root)
    if (existing) {
      if (!history) existing.historyOnly = false
    } else {
      found.set(root, { table: root, label: owner.label, historyOnly: history })
    }
  }

  return [...found.values()].sort(
    (a, b) => Number(a.historyOnly) - Number(b.historyOnly) || a.label.localeCompare(b.label),
  )
}

/** The places currently showing this file, as one readable phrase. */
export function describeLiveUsage(usage: MediaUsage[]): string {
  const names = usage.filter((u) => !u.historyOnly).map((u) => u.label)
  if (!names.length) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
