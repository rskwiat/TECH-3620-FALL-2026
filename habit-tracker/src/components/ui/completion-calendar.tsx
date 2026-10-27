import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, completionLabel, dateKey, weekEnd, WEEKDAY_LABELS } from '@/utils/dates';

/** Squares in the calendar — four 7-day weeks. */
const CALENDAR_DAYS = 28;
/** Columns in the grid: one weekday each, Sunday first. */
const CALENDAR_COLUMNS = 7;
/**
 * Fill opacity for an in-window day sitting at zero completions, so a missed
 * day is still a visible square rather than a blank. A goal-met day lands at 1.
 */
const MIN_FILL_OPACITY = 0.16;

/** One day's data for the calendar. */
export type CalendarEntry = {
  /** `YYYY-MM-DD` day bucket — the same string the history API uses. */
  date: string;
  /** Completions logged that day. Days left out render as empty squares. */
  count: number;
};

type CompletionCalendarProps = {
  /** Day-by-day counts to plot; days without an entry render as empty squares. */
  entries: CalendarEntry[];
  /** Completions in one day that count as the goal — reaching it fills the square. */
  goalPerDay: number;
  /** Color family for the square fills. Defaults to the app's `primary`. */
  color?: ThemeColor;
};

/** One square: its date, completion count, and the visuals derived from them. */
type CalendarSquare = {
  /** Local `YYYY-MM-DD`, used to match entries and key the render. */
  key: string;
  /** Day of the month printed in the square. */
  dayOfMonth: number;
  /** The entry's count, or null when the caller sent no row for this date. */
  count: number | null;
  /** Fill opacity derived from the day's completion rate. */
  fillOpacity: number;
  /** Screen-reader label, e.g. `Oct 26: 7 of 8 completions, goal met`. */
  label: string;
};

/** Parses an `#RRGGBB` literal into `[r, g, b]` channels, or null if it isn't one. */
function parseHex(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** WCAG relative luminance of `[r, g, b]` channels (0–255 each). */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const value = c / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * `#000000` or `#ffffff`, whichever reads better on `fill` blended over `base`
 * at `opacity` — i.e. whichever has the higher WCAG contrast, so the day number
 * stays legible at every step of the fade (the winner always clears AA's 4.5:1)
 * instead of trusting one theme color across a fill that ranges from nearly
 * invisible to solid. Null when a color isn't a hex literal, so callers can
 * fall back to the theme's text color.
 */
function contrastingText(base: string, fill: string, opacity: number): string | null {
  const baseRgb = parseHex(base);
  const fillRgb = parseHex(fill);
  if (!baseRgb || !fillRgb) return null;

  const t = Math.min(Math.max(opacity, 0), 1);
  const blended: [number, number, number] = [
    baseRgb[0] + (fillRgb[0] - baseRgb[0]) * t,
    baseRgb[1] + (fillRgb[1] - baseRgb[1]) * t,
    baseRgb[2] + (fillRgb[2] - baseRgb[2]) * t,
  ];

  const l = luminance(blended);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff';
}

/**
 * Builds the 28 squares as four Sunday-first weeks ending on the current
 * week's Saturday (`weekEnd`), so columns line up with `WEEKDAY_LABELS` and
 * today sits in the last row. Each square's fill opacity tracks
 * `count / goalPerDay` (clamped to 0–1 and floored at `MIN_FILL_OPACITY`);
 * dates with no entry get no fill.
 */
function buildSquares(entries: CalendarEntry[], goal: number): CalendarSquare[] {
  const counts = new Map(entries.map((entry) => [entry.date, entry.count]));
  const lastDay = weekEnd();

  const squares: CalendarSquare[] = [];
  for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
    const date = addDays(lastDay, -i);
    const key = dateKey(date);
    const count = counts.get(key) ?? null;
    const rate = count === null ? 0 : Math.min(count / goal, 1);

    squares.push({
      key,
      dayOfMonth: date.getDate(),
      count,
      fillOpacity: count === null ? 0 : MIN_FILL_OPACITY + (1 - MIN_FILL_OPACITY) * rate,
      label: completionLabel(date, count, goal),
    });
  }
  return squares;
}

/** One square in the calendar: the day number over the day's opacity fill. */
function DayCell({ square, fill }: { square: CalendarSquare; fill: string }) {
  const theme = useTheme();
  const textColor =
    square.count === null
      ? theme.textSecondary
      : contrastingText(theme.backgroundElement, fill, square.fillOpacity) ?? theme.text;

  return (
    <View style={styles.cell} accessible accessibilityLabel={square.label}>
      {/* Separate layer so only the fill fades — the number stays legible. */}
      <View style={[styles.cellFill, { backgroundColor: fill, opacity: square.fillOpacity }]} />
      <ThemedText type="small" style={[styles.cellDay, { color: textColor }]}>
        {square.dayOfMonth}
      </ThemedText>
    </View>
  );
}

/**
 * A 28-day completion calendar (four weeks × seven weekday columns) where each
 * square's fill opacity is that day's completion rate: a goal-met day is solid,
 * a zero-completion day sits at a faint floor, and a day with no entry has no
 * fill at all. Feed it any `{ date, count }[]` — the habit detail screen passes
 * `history.perDay` straight through.
 */
export function CompletionCalendar({
  entries,
  goalPerDay,
  color = 'primary',
}: CompletionCalendarProps) {
  const theme = useTheme();
  const fill = theme[color];
  // goalPerDay is ≥ 1 from the API; the guard keeps a bad value from dividing by zero.
  const goal = Math.max(goalPerDay, 1);

  const squares = buildSquares(entries, goal);
  const rows: CalendarSquare[][] = [];
  for (let i = 0; i < squares.length; i += CALENDAR_COLUMNS) {
    rows.push(squares.slice(i, i + CALENDAR_COLUMNS));
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        {WEEKDAY_LABELS.map((label, index) => (
          <ThemedText
            key={`${index}-${label}`}
            type="small"
            themeColor="textSecondary"
            style={styles.weekdayLabel}>
            {label}
          </ThemedText>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((square) => (
            <DayCell key={square.key} square={square} fill={fill} />
          ))}
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    // Capped so squares stay a sensible size on wide (web) screens.
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    // flex + square aspect keeps 7 columns at any content width.
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  cellFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: Spacing.two,
  },
  cellDay: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
});
