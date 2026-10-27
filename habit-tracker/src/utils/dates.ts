/**
 * Calendar-date helpers shared by the completion components (the 28-day
 * calendar and the weekly bar chart). Both views must agree on where a week
 * starts and how a day is keyed, so those rules live here instead of being
 * copied into each component — if they drifted, the two charts on a screen
 * would disagree about which column a day belongs to.
 *
 * Every date is local-calendar based: the history API's `perDay` strings are
 * UTC-day buckets, and the app reads them as plain `YYYY-MM-DD` day labels
 * everywhere else, so cells and bars match them the same way.
 */

/** Local `YYYY-MM-DD` for a date — the key the history API buckets days by. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Steps a date by whole days as `(y, m, d + n)`, so DST can't shift the day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Saturday of the week containing `reference` (today by default) — the anchor
 * both completion views end on, with weeks running Sunday → Saturday. Today
 * therefore always falls in the calendar's last row, and the bar chart always
 * shows the week containing today.
 */
export function weekEnd(reference: Date = new Date()): Date {
  // 0 days ahead when the reference is a Saturday, 6 when it's a Sunday.
  return addDays(reference, 6 - reference.getDay());
}

/**
 * Narrow weekday initials for Sunday-first columns, in the user's locale. The
 * reference date (2026-01-04) is a Sunday, so `4 + i` walks Sun → Sat.
 */
export const WEEKDAY_LABELS: string[] = Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 0, 4 + i).toLocaleDateString(undefined, { weekday: 'narrow' }),
);

/**
 * Screen-reader label for one day, e.g. `Oct 26: 7 of 8 completions, goal met`.
 * `count` is null when the caller has no row for the date (a future day, or one
 * outside the window it fetched).
 */
export function completionLabel(date: Date, count: number | null, goal: number): string {
  const when = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (count === null) return `${when}: no data yet`;
  return `${when}: ${count} of ${goal} completions${count >= goal ? ', goal met' : ''}`;
}
