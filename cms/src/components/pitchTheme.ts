/**
 * Colours for the pitch panels, taken from the admin's own skin.
 *
 * This CMS runs a custom dark theme (src/app/(payload)/custom.scss) that keeps
 * `data-theme="light"` and **remaps Payload's elevation scale to a dark
 * palette**: `--theme-elevation-0` is #030508 and `--theme-elevation-1000` is
 * white, the opposite way round from stock Payload.
 *
 * Everything built here before this file used those elevation variables for
 * borders and inherited `color` for text, which in stock Payload means "dark
 * ink on a pale card" and in this admin means #090f1c on #030508. The panels
 * were rendering, correctly, in black on black. Ernest opened the pitch screen
 * after the folder drop shipped and said "I don't see it", and he was right:
 * the drop zone's dashed border was two shades away from the background and
 * its label sat at about three to one against it.
 *
 * So the panels use the skin's own tokens now, each falling back to the
 * elevation variable that means the same thing in stock Payload. Read the
 * fallbacks as "and if this admin is ever unskinned, still be legible".
 */
export const T = {
  text: 'var(--qd-text-1, var(--theme-elevation-1000))',
  muted: 'var(--qd-text-2, var(--theme-elevation-800))',
  faint: 'var(--qd-text-3, var(--theme-elevation-600))',
  border: 'var(--qd-border, var(--theme-elevation-150))',
  raised: 'var(--qd-bg-raised, var(--theme-elevation-50))',
  overlay: 'var(--qd-bg-overlay, var(--theme-elevation-100))',
  accent: 'var(--qd-accent, #00AEEF)',
  accentBorder: 'var(--qd-accent-border, rgba(0, 174, 239, 0.28))',
  accentSubtle: 'var(--qd-accent-subtle, rgba(0, 174, 239, 0.07))',
  /* Kept literal. Red and green have to read as red and green in any skin. */
  good: '#16a34a',
  bad: '#dc2626',
} as const

/** The card every pitch panel sits in. */
export const panel: React.CSSProperties = {
  border: `1px solid ${T.border}`,
  background: T.raised,
  borderRadius: 6,
  padding: '14px 16px',
  marginBottom: 24,
  fontSize: 13,
  lineHeight: 1.6,
  color: T.text,
}

export const heading: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: T.text,
  marginBottom: 4,
}
