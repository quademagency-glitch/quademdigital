// Colour emphasis for home page words that come from the CMS.
// Editors write [square brackets] for the blue key phrase of a headline and
// **double stars** for the full-strength key phrase of a lead. Everything else
// is escaped, so CMS text can never inject markup.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Returns safe HTML for set:html: [x] becomes .d-hl, **x** becomes .d-em. */
export function emph(value: string | null | undefined): string {
  if (!value) return '';
  return escapeHtml(String(value))
    .replace(/\*\*(.+?)\*\*/g, '<span class="d-em">$1</span>')
    .replace(/\[(.+?)\]/g, '<span class="d-hl">$1</span>');
}

/** The same text with the markers removed, for aria-labels and meta tags. */
export function plain(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[(.+?)\]/g, '$1');
}

/** CMS value when it is a non-empty string, otherwise the approved default. */
export function pick(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/** CMS array when it has rows, otherwise the approved default rows. */
export function pickRows<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) && value.length ? (value as T[]) : fallback;
}
