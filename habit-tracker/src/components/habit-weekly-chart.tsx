import { StyleSheet, View } from 'react-native';

import type { HabitHistory } from '@/api';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Weeks shown by the widget — about two months of history. */
export const HABIT_WEEKLY_CHART_WEEKS = 8;

type ChartDay = HabitHistory['perDay'][number];

type HabitWeeklyChartProps = {
  /** `perDay` entries from `GET /api/habits/:id/history`, oldest first. */
  days: HabitHistory['perDay'];
  /** Daily habits count goal-met days; weekly habits count completions per week. */
  frequency: HabitHistory['frequency'];
  /** Completions needed per week for a `WEEKLY` habit. */
  timesPerPeriod: number;
};

/** One Monday-to-Sunday bucket, clipped to the requested history window. */
type Week = {
  /** Monday that starts the week, as a local `YYYY-MM-DD` key. */
  start: string;
  firstDate: string;
  lastDate: string;
  /** Days of this week that fall inside the window (7 for past weeks). */
  dayCount: number;
  goalMetDays: number;
  completions: number;
  isCurrent: boolean;
  /** 0–1, where 1 means fully consistent. */
  consistency: number;
};

/** Parses a `YYYY-MM-DD` day bucket at local midnight so the weekday is correct. */
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** Midnight on the Monday of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** Formats a local date as `YYYY-MM-DD` without shifting through UTC. */
function localKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "Sep 21" for the week's first day. */
function formatWeekLabel(date: string): string {
  return parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "September 21 – 27" for the screen-reader description. */
function formatWeekRange(week: Week): string {
  const first = parseDay(week.firstDate).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  const last = parseDay(week.lastDate).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  return first === last ? first : `${first} – ${last}`;
}

/** Consistency for one week: goal-met share, or completion-goal progress. */
function weekConsistency(
  bucket: Omit<Week, 'consistency' | 'isCurrent'>,
  frequency: HabitHistory['frequency'],
  timesPerPeriod: number,
): number {
  if (frequency === 'WEEKLY') {
    return Math.min(bucket.completions / Math.max(timesPerPeriod, 1), 1);
  }
  return bucket.dayCount > 0 ? bucket.goalMetDays / bucket.dayCount : 0;
}

/**
 * Groups the window into Monday-start weeks, keeping every full week plus the
 * in-progress current week. A partial week at the start of the window is
 * dropped so it can't drag the chart down, and the list is capped to the most
 * recent `HABIT_WEEKLY_CHART_WEEKS` weeks.
 */
function buildWeeks(
  days: ChartDay[],
  frequency: HabitHistory['frequency'],
  timesPerPeriod: number,
): Week[] {
  const byStart = new Map<string, Omit<Week, 'isCurrent' | 'consistency'>>();
  const order: string[] = [];

  for (const day of days) {
    const key = localKey(startOfWeek(parseDay(day.date)));
    let bucket = byStart.get(key);

    if (!bucket) {
      bucket = {
        start: key,
        firstDate: day.date,
        lastDate: day.date,
        dayCount: 0,
        goalMetDays: 0,
        completions: 0,
      };
      byStart.set(key, bucket);
      order.push(key);
    }

    bucket.lastDate = day.date;
    bucket.dayCount += 1;
    bucket.completions += day.count;
    if (day.goalMet) bucket.goalMetDays += 1;
  }

  const latestDate = days.reduce<string | null>(
    (latest, day) => (latest === null || day.date > latest ? day.date : latest),
    null,
  );
  const currentStart = latestDate ? localKey(startOfWeek(parseDay(latestDate))) : null;

  return order
    .map((key) => byStart.get(key))
    .filter((bucket): bucket is Omit<Week, 'isCurrent' | 'consistency'> => Boolean(bucket))
    .filter((bucket) => bucket.start === currentStart || bucket.dayCount === 7)
    .slice(-HABIT_WEEKLY_CHART_WEEKS)
    .map((bucket) => ({
      ...bucket,
      isCurrent: bucket.start === currentStart,
      consistency: weekConsistency(bucket, frequency, timesPerPeriod),
    }));
}

/** Screen-reader description for one week's bar. */
function describeWeek(
  week: Week,
  frequency: HabitHistory['frequency'],
  timesPerPeriod: number,
): string {
  const percent = Math.round(week.consistency * 100);
  const progress =
    frequency === 'WEEKLY'
      ? `${week.completions} of ${timesPerPeriod} completions`
      : `goal met on ${week.goalMetDays} of ${week.dayCount} days`;
  const pending = week.isCurrent ? ' This week is still in progress.' : '';
  return `Week of ${formatWeekRange(week)}: ${percent}% consistent, ${progress}.${pending}`;
}

/**
 * A bar chart of weekly consistency for one habit: one bar per Monday–Sunday
 * week (up to eight) with the percentage above it and the week's start date
 * below. Daily habits measure the share of days the daily goal was met; weekly
 * habits measure progress toward `timesPerPeriod` completions.
 *
 * Past weeks with no data in the window are skipped, and the current week is
 * shown faded because it is still in progress.
 */
export function HabitWeeklyChart({ days, frequency, timesPerPeriod }: HabitWeeklyChartProps) {
  const theme = useTheme();
  const weeks = buildWeeks(days, frequency, timesPerPeriod);

  if (weeks.length === 0) return null;

  // Weekly habits average their per-week goal progress; daily habits weight
  // days evenly, so a short in-progress week can't skew the average.
  const daysInWindow = weeks.reduce((sum, week) => sum + week.dayCount, 0);
  const goalMetDays = weeks.reduce((sum, week) => sum + week.goalMetDays, 0);
  const average =
    frequency === 'WEEKLY'
      ? weeks.reduce((sum, week) => sum + week.consistency, 0) / weeks.length
      : goalMetDays / Math.max(daysInWindow, 1);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.summaryRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {`Last ${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="primary">
          {`${Math.round(average * 100)}% average`}
        </ThemedText>
      </View>

      <View style={styles.chart}>
        {weeks.map((week) => {
          const percent = Math.round(week.consistency * 100);
          // Give non-zero weeks a visible stub even when the percentage rounds low.
          const fillHeight = week.consistency > 0 ? Math.max(week.consistency * 100, 4) : 0;

          return (
            <View
              key={week.start}
              accessible
              accessibilityLabel={describeWeek(week, frequency, timesPerPeriod)}
              style={styles.column}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.valueLabel}>
                {`${percent}%`}
              </ThemedText>
              <View style={[styles.track, { backgroundColor: `${theme.primary}1A` }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      height: `${fillHeight}%`,
                      backgroundColor: week.isCurrent ? `${theme.primary}99` : theme.primary,
                    },
                  ]}
                />
              </View>
              <ThemedText
                type="small"
                themeColor={week.isCurrent ? 'text' : 'textSecondary'}
                style={styles.weekLabel}>
                {formatWeekLabel(week.firstDate)}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        {frequency === 'WEEKLY'
          ? `Share of your ${timesPerPeriod}× weekly goal. This week is still in progress.`
          : 'Share of days the daily goal was met. This week is counted through today.'}
      </ThemedText>
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chart: {
    flexDirection: 'row',
    gap: Spacing.one,
    height: 140,
  },
  column: {
    flex: 1,
    alignItems: 'stretch',
    gap: Spacing.one,
  },
  valueLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    borderRadius: Spacing.one,
  },
  weekLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
