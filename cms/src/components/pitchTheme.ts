/** Semantic colours shared by custom panels in both CMS themes. */
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
  good: 'var(--qd-success, #187342)',
  bad: 'var(--qd-danger, #b12f38)',
} as const

/** The card every pitch panel sits in. */
export const panel: React.CSSProperties = {
  border: `1px solid ${T.border}`,
  background: T.raised,
  borderRadius: 8,
  padding: '18px 20px',
  marginBottom: 24,
  fontSize: 13,
  lineHeight: 1.65,
  color: T.text,
}

export const heading: React.CSSProperties = {
  display: 'block',
  fontSize: 15,
  fontWeight: 600,
  color: T.text,
  marginBottom: 8,
}
