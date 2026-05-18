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
