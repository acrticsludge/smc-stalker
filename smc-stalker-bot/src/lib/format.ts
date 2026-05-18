/**
 * Text formatting utilities for Discord output.
 */

/**
 * Escape Discord markdown in user-provided text.
 * Prevents _italic_, **bold**, ~~strikethrough~~, `code` injection.
 */
export function escapeMD(text: string): string {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`');
}

/**
 * Convert raw days-until-insolvent to a display value.
 * - Negative → -1 (already insolvent)
 * - 0 or 1 → 0 (falling today or within the next cycle)
 * - 2+ → as-is
 * - 999 → 999 (no upkeep, infinite)
 */
export function displayDays(raw: number): number {
  if (raw <= 0) return raw;
  if (raw <= 1) return 0;
  if (raw >= 999) return 999;
  return raw;
}

/**
 * Format a currency value with $ sign and 2 decimal places.
 */
export function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

/**
 * Format an embed description with section headers.
 * Each section is separated by a blank line.
 */
export function sectioned(
  sections: { title?: string; fields: string[] }[],
): string {
  return sections
    .map((s) => {
      const body = s.fields.join('\n');
      if (s.title) {
        return `${s.title}\n${body}`;
      }
      return body;
    })
    .join('\n\n');
}
