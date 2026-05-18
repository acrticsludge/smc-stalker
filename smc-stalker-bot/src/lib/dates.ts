/**
 * Date formatting utilities — all times in GMT.
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Format a date or ISO string as "DD Mon YYYY" in GMT.
 * Example: `16 May 2026`
 */
export function formatDateGMT(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = MONTHS_SHORT[d.getUTCMonth()]!;
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format a date or ISO string as "Day, DD Mon YYYY" in GMT.
 * Example: `Mon, 16 May 2026`
 */
export function formatDateLongGMT(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const dayName = DAYS_SHORT[d.getUTCDay()]!;
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = MONTHS_SHORT[d.getUTCMonth()]!;
  const year = d.getUTCFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format a Discord snowflake timestamp for `<t:...>` relative display.
 * Returns a unix timestamp in seconds.
 */
export function discordTimestamp(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor(d.getTime() / 1000);
}

/**
 * Format a time string (HH:MM) for display, with GMT note.
 * Example: `20:00 GMT`
 */
export function formatTimeGMT(time: string): string {
  return `${time} GMT`;
}
