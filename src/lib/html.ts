/**
 * Escape a value for interpolation into an HTML string.
 *
 * Outbound email bodies are assembled as raw HTML strings across several API
 * routes, so anything originating from a form field must pass through here.
 * Previously each route carried its own private copy (or none at all).
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
