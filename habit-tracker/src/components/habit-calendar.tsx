import { StyleSheet, View } from 'react-native';

import type { HabitHistory } from '@/api';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Days shown by the widget — four full rows of seven. */
export const HABIT_CALENDAR_DAYS = 28;

type CalendarDay = HabitHistory['perDay'][number];

type HabitCalendarProps = {
  /** `perDay` entries from `GET /api/habits/:id/history`, oldest first. */
  days: HabitHistory['perDay'];
  /** Completions needed in one day for the goal to count as met. */
  goalPerDay: number;
};

/** Weekday initials, indexed like `Date#getDay()` (Sunday first). */
const WEEKDAY_INITIALS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Parses a `YYYY-MM-DD` day bucket at local midnight so the label keeps its date. */
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** "Sep 23 – Oct 20" for the visible window; empty when there is no history. */
function formatRange(days: CalendarDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';

  const format = (date: string) =>
    parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${format(first.date)} – ${format(last.date)}`;
}

/** Screen-reader description for one day square. */
function describeDay(day: CalendarDay, goalPerDay: number): string {
  const date = parseDay(day.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  if (day.goalMet) return `${date}: goal met`;
  if (day.count === 0) return `${date}: no completions`;
  return `${date}: ${day.count} of ${goalPerDay} completions`;
}

/** One key from the calendar's legend. */
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
 * A 28-day calendar widget for one habit's recent history: four rows of seven
 * day squares with weekday initials, a date-range label, and a legend.
 *
 * Each square is tinted with the theme's primary color by completion state:
 * opaque when the day's goal was met, 50% when the day has completions but the
 * goal was not met, and 10% when the day has no completions.
 */
export function HabitCalendar({ days, goalPerDay }: HabitCalendarProps) {
  const theme = useTheme();

  const visibleDays = days.slice(-HABIT_CALENDAR_DAYS);
  const firstWeekday = visibleDays[0] ? parseDay(visibleDays[0].date).getDay() : 0;
  const weekdayLabels = WEEKDAY_INITIALS.map(
    (_, offset) => WEEKDAY_INITIALS[(firstWeekday + offset) % 7],
  );

  // Chunk the rolling window into calendar weeks, padding a short final week
  // with empty cells so the weekday columns stay aligned.
  const weeks: (CalendarDay | null)[][] = [];
  for (let index = 0; index < visibleDays.length; index += 7) {
    const week: (CalendarDay | null)[] = visibleDays.slice(index, index + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{`Last ${HABIT_CALENDAR_DAYS} days`}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatRange(visibleDays)}
      </ThemedText>

      <View style={styles.grid}>
        <View style={styles.week}>
          {weekdayLabels.map((label, index) => (
            <ThemedText
              key={`${label}-${index}`}
              type="small"
              themeColor="textSecondary"
              style={styles.weekday}>
              {label}
            </ThemedText>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={week[0]?.date ?? `empty-${weekIndex}`} style={styles.week}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return <View key={`empty-${dayIndex}`} style={styles.day} />;
              }

              const complete = day.goalMet;
              const partial = !complete && day.count > 0;
              // Opaque primary for complete days, 50% for partial, 10% for none.
              const fillColor = complete
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
                  key={day.date}
                  accessible
                  accessibilityLabel={describeDay(day, goalPerDay)}
                  style={[styles.day, { backgroundColor: fillColor }]}>
                  <ThemedText style={[styles.dayLabel, { color: labelColor }]}>
                    {parseDay(day.date).getDate()}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendItem color={theme.primary} label="Complete" />
        <LegendItem color={`${theme.primary}80`} label="Partial" />
        <LegendItem color={`${theme.primary}1A`} label="Incomplete" />
      </View>
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
  grid: {
    gap: Spacing.one,
  },
  week: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  weekday: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  day: {
    flex: 1,
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
