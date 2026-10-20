import { StyleSheet, View } from 'react-native';

import type { HabitHistory } from '@/api';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TrackerDay = HabitHistory['perDay'][number];

type WeeklyHabitTrackerProps = {
  /** `perDay` entries from `GET /api/habits/:id/history`, oldest first. */
  days: HabitHistory['perDay'];
  /** Completions needed in one day for the goal to count as met. */
  goalPerDay: number;
  /** Day the week starts on, indexed like `Date#getDay()` (Monday by default). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Card heading; defaults to "This week". */
  title?: string;
  /** Whether to show the Complete/Partial/Incomplete/Upcoming key. */
  showLegend?: boolean;
};

/** Weekday initials, indexed like `Date#getDay()` (Sunday first). */
const WEEKDAY_INITIALS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Parses a `YYYY-MM-DD` day bucket at local midnight so the label keeps its date. */
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** Formats a local date as the API's `YYYY-MM-DD` bucket key. */
function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** First day of the week containing `date`, at local midnight. */
function startOfWeek(date: Date, weekStartsOn: number): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() - weekStartsOn + 7) % 7));
  return start;
}

/** "Oct 19 – Oct 25" for the visible week. */
function formatRange(dates: Date[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return '';

  const format = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${format(first)} – ${format(last)}`;
}

/** Screen-reader description for one day cell. */
function describeDay(
  day: TrackerDay | undefined,
  date: Date,
  goalPerDay: number,
  isFuture: boolean,
): string {
  const label = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  if (isFuture) return `${label}: upcoming`;
  if (!day || day.count === 0) return `${label}: no completions`;
  if (day.goalMet) return `${label}: goal met`;
  return `${label}: ${day.count} of ${goalPerDay} completions`;
}

/** One key from the tracker's legend. */
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.legendLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * A Monday–Sunday widget for one habit's current week, built from the same
 * `perDay` history as `HabitCalendar`. Each day square is tinted with the
 * theme's primary color by completion state (opaque when the day's goal was
 * met, 50% when the day has completions but the goal was not met, and 10% when
 * there are none), while days still to come are shown in the muted selected
 * background. A footer line counts how many elapsed days met the goal.
 *
 * The week is anchored to the newest `perDay` entry (the API's UTC "today"),
 * so the widget stays in sync with the history window it is given. Pass
 * `weekStartsOn={0}` to start weeks on Sunday instead of Monday.
 */
export function WeeklyHabitTracker({
  days,
  goalPerDay,
  weekStartsOn = 1,
  title = 'This week',
  showLegend = true,
}: WeeklyHabitTrackerProps) {
  const theme = useTheme();

  // `perDay` is oldest → newest, so the last entry is the API's current day.
  const today = days[days.length - 1];
  const referenceDate = today ? parseDay(today.date) : new Date();
  const todayKey = today?.date ?? formatDayKey(referenceDate);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const weekStart = startOfWeek(referenceDate, weekStartsOn);

  const week = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const key = formatDayKey(date);
    return { key, date, day: byDate.get(key), isFuture: key > todayKey };
  });

  const elapsedDays = week.filter((entry) => !entry.isFuture);
  const daysMet = elapsedDays.filter((entry) => entry.day?.goalMet).length;
  const summary = `${daysMet} of ${elapsedDays.length} ${
    elapsedDays.length === 1 ? 'day' : 'days'
  } met`;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatRange(week.map((entry) => entry.date))}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
          {summary}
        </ThemedText>
      </View>

      <View style={styles.week}>
        {week.map((entry) => {
          const complete = !entry.isFuture && Boolean(entry.day?.goalMet);
          const partial = !entry.isFuture && !complete && (entry.day?.count ?? 0) > 0;
          // Opaque primary for complete days, 50% for partial, 10% for none,
          // and the muted selected background for days that haven't happened.
          const fillColor = entry.isFuture
            ? theme.backgroundSelected
            : complete
              ? theme.primary
              : partial
                ? `${theme.primary}80`
                : `${theme.primary}1A`;
          const labelColor = complete
            ? '#ffffff'
            : partial
              ? theme.text
              : theme.textSecondary;

          return (
            <View
              key={entry.key}
              accessible
              accessibilityLabel={describeDay(entry.day, entry.date, goalPerDay, entry.isFuture)}
              style={styles.dayColumn}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.weekday}>
                {WEEKDAY_INITIALS[entry.date.getDay()]}
              </ThemedText>
              <View style={[styles.day, { backgroundColor: fillColor }]}>
                <ThemedText style={[styles.dayLabel, { color: labelColor }]}>
                  {entry.date.getDate()}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      {showLegend ? (
        <View style={styles.legend}>
          <LegendItem color={theme.primary} label="Complete" />
          <LegendItem color={`${theme.primary}80`} label="Partial" />
          <LegendItem color={`${theme.primary}1A`} label="Incomplete" />
          <LegendItem color={theme.backgroundSelected} label="Upcoming" />
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  headerText: {
    gap: Spacing.one,
  },
  summary: {
    // Drops under the range label when the card is too narrow.
    marginLeft: 'auto',
  },
  week: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'stretch',
    gap: Spacing.one,
  },
  weekday: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  day: {
    aspectRatio: 1,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
});
