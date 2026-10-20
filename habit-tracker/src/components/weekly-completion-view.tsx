import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** One Monday–Sunday cell in the weekly completion grid. */
export type WeeklyCompletionDay = {
  /** Local `YYYY-MM-DD` bucket key. */
  date: string;
  /** Habits that completed their goal (or logged progress for weekly habits). */
  completed: number;
  /** Habits being tracked on that day. */
  total: number;
  /** True for days after the API's current day. */
  isFuture: boolean;
};

type WeeklyCompletionViewProps = {
  /** Seven day entries, oldest first (Monday through Sunday). */
  days: WeeklyCompletionDay[];
  /** Card heading; defaults to "Weekly completion". */
  title?: string;
};

/** Weekday initials, indexed like `Date#getDay()` (Sunday first). */
const WEEKDAY_INITIALS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Parses a `YYYY-MM-DD` day bucket at local midnight so the label keeps its date. */
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** "Oct 19 – Oct 25" for the visible week. */
function formatRange(days: WeeklyCompletionDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';

  const format = (date: string) =>
    parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${format(first.date)} – ${format(last.date)}`;
}

/** Screen-reader description for one day cell. */
function describeDay(day: WeeklyCompletionDay): string {
  const label = parseDay(day.date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  if (day.isFuture) return `${label}: upcoming`;
  if (day.total === 0) return `${label}: no habits tracked`;
  return `${label}: ${day.completed} of ${day.total} habits complete`;
}

/** One key from the widget's legend. */
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
 * The Weekly tab's headline widget: the current Monday–Sunday week with one
 * cell per day, tinted by the share of tracked habits that completed their goal
 * that day (opaque primary when every habit is done, 50% for some, 10% for
 * none, and the muted selected background for days still to come).
 *
 * Daily habits count as complete once their daily goal is met; weekly habits
 * count as complete for a day once they have at least one completion, since
 * their goal is measured across the whole week. The footer totals the elapsed
 * days, so the in-progress week never reads as a failure.
 */
export function WeeklyCompletionView({ days, title = 'Weekly completion' }: WeeklyCompletionViewProps) {
  const theme = useTheme();

  const elapsedDays = days.filter((day) => !day.isFuture);
  const completed = elapsedDays.reduce((sum, day) => sum + day.completed, 0);
  const total = elapsedDays.reduce((sum, day) => sum + day.total, 0);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatRange(days)}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="primary" style={styles.summary}>
          {`${percent}% complete`}
        </ThemedText>
      </View>

      <View style={styles.week}>
        {days.map((day) => {
          const ratio = !day.isFuture && day.total > 0 ? day.completed / day.total : 0;
          const complete = !day.isFuture && day.total > 0 && day.completed === day.total;
          const partial = !day.isFuture && !complete && day.completed > 0;
          // Opaque primary for fully complete days, 50% for partial, 10% for none,
          // and the muted selected background for days that haven't happened.
          const fillColor = day.isFuture
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
              key={day.date}
              accessible
              accessibilityLabel={describeDay(day)}
              style={styles.dayColumn}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.weekday}>
                {WEEKDAY_INITIALS[parseDay(day.date).getDay()]}
              </ThemedText>
              <View style={[styles.day, { backgroundColor: fillColor }]}>
                <ThemedText style={[styles.dayLabel, { color: labelColor }]}>
                  {parseDay(day.date).getDate()}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dayCount}>
                {day.isFuture ? '—' : `${day.completed}/${day.total}`}
              </ThemedText>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.ratioTrack, { backgroundColor: `${theme.primary}1A` }]}>
                <View
                  style={[
                    styles.ratioFill,
                    { width: `${Math.round(ratio * 100)}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        {total === 0
          ? 'No habit check-ins yet this week.'
          : `${completed} of ${total} habit check-ins complete this week.`}
      </ThemedText>

      <View style={styles.legend}>
        <LegendItem color={theme.primary} label="All done" />
        <LegendItem color={`${theme.primary}80`} label="Some" />
        <LegendItem color={`${theme.primary}1A`} label="None" />
        <LegendItem color={theme.backgroundSelected} label="Upcoming" />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
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
  dayCount: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  ratioTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  ratioFill: {
    height: '100%',
    borderRadius: 2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
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
