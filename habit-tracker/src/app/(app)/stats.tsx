import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getHabitHistory, getHabits, STATS_WINDOW_DAYS } from '@/api';
import type { Habit, HabitHistory } from '@/api';
import { CategoryBreakdown } from '@/components/category-breakdown';
import type { CategoryBreakdownItem } from '@/components/category-breakdown';
import { MonthlyConsistencyChart } from '@/components/monthly-consistency-chart';
import type { MonthlyConsistencyPoint } from '@/components/monthly-consistency-chart';
import { PageTemplate } from '@/components/page-template';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** Months shown by the trend chart. */
const TREND_MONTHS = 6;

/** One active habit paired with its 365-day history. */
type HabitStats = {
  habit: Habit;
  history: HabitHistory;
};

/** Result of one stats load, tagged with the token it belongs to. */
type Loaded = {
  token: string;
  stats: HabitStats[];
  error: string | null;
};

/** The habit with the longest streak, plus its best run. */
type BestStreak = {
  days: number;
  habit: Habit | null;
};

/** A habit's name prefixed with its emoji, when it has one. */
function habitLabel(habit: Habit): string {
  const emoji = habit.emoji?.trim();
  return emoji ? `${emoji} ${habit.name}` : habit.name;
}

/** The single longest streak among every active habit. */
function bestStreak(stats: HabitStats[]): BestStreak {
  return stats.reduce<BestStreak>(
    (best, { habit, history }) =>
      history.longestStreak > best.days
        ? { days: history.longestStreak, habit }
        : best,
    { days: 0, habit: null },
  );
}

/** The `YYYY-MM` key for a `YYYY-MM-DD` day bucket. */
function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Every month key from `firstMonth` through `lastMonth`, oldest first. */
function monthRange(firstMonth: string, lastMonth: string): string[] {
  const keys: string[] = [];
  let [year, month] = firstMonth.split('-').map(Number);
  let key = firstMonth;

  while (key <= lastMonth) {
    keys.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    key = `${year}-${String(month).padStart(2, '0')}`;
  }

  return keys;
}

/**
 * Builds the monthly trend from every habit's `perDay` entries. Months are
 * counted from the first day with any completion, so seeded backfill (or a new
 * account) doesn't produce a run of empty 0% months before tracking began.
 *
 * Each habit contributes a 0–1 consistency score per month: daily habits use
 * the share of days their goal was met, and weekly habits use progress toward
 * `timesPerPeriod` completions scaled by the days elapsed in the month. The
 * month's score is the average across habits so a single habit can't dominate.
 */
function buildMonthlyTrend(stats: HabitStats[]): MonthlyConsistencyPoint[] {
  const allDays = stats.flatMap(({ history }) => history.perDay);
  if (allDays.length === 0) return [];

  const activeDates = allDays.filter((day) => day.count > 0).map((day) => day.date);
  if (activeDates.length === 0) return [];

  const firstActive = activeDates.reduce((earliest, date) =>
    date < earliest ? date : earliest,
  );
  const lastDate = allDays.reduce((latest, day) => (day.date > latest ? day.date : latest), '');

  const months = monthRange(monthKey(firstActive), monthKey(lastDate)).slice(-TREND_MONTHS);

  return months.map((month) => {
    let consistencySum = 0;
    let habitCount = 0;
    let completions = 0;

    for (const { habit, history } of stats) {
      const days = history.perDay.filter(
        (day) => monthKey(day.date) === month && day.date >= firstActive,
      );
      if (days.length === 0) continue;

      const monthCompletions = days.reduce((sum, day) => sum + day.count, 0);
      completions += monthCompletions;

      if (habit.frequency === 'WEEKLY') {
        // A month is `days.length / 7` weeks long; scale the weekly target to it.
        const target = (habit.timesPerPeriod * days.length) / 7;
        consistencySum += Math.min(monthCompletions / target, 1);
      } else {
        consistencySum += days.filter((day) => day.goalMet).length / days.length;
      }
      habitCount += 1;
    }

    return {
      month,
      consistency: habitCount === 0 ? 0 : consistencySum / habitCount,
      completions,
    };
  });
}

/** Splits completions between daily and weekly habits, skipping empty categories. */
function buildCategories(
  stats: HabitStats[],
  totalCompletions: number,
): CategoryBreakdownItem[] {
  return (['DAILY', 'WEEKLY'] as const)
    .map((frequency) => {
      const habits = stats.filter(({ habit }) => habit.frequency === frequency);
      const completions = habits.reduce((sum, { history }) => sum + history.totalCompletions, 0);

      return {
        key: frequency,
        label: frequency === 'DAILY' ? 'Daily habits' : 'Weekly habits',
        habitCount: habits.length,
        completions,
        share: totalCompletions === 0 ? 0 : completions / totalCompletions,
      };
    })
    .filter((item) => item.habitCount > 0);
}

/** One headline number with its label and optional supporting line. */
function StatCard({
  value,
  unit,
  label,
  detail,
}: {
  value: string;
  unit?: string;
  label: string;
  detail: string;
}) {
  return (
    <ThemedView
      type="backgroundElement"
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}. ${detail}`}
      style={styles.statCard}>
      <View style={styles.statValueRow}>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        {unit ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.statUnit}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {detail}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * The Stats tab: two headline cards (the longest streak across every habit and
 * the total number of completions in the last year), a month-by-month
 * consistency trend, and a daily-vs-weekly category breakdown.
 *
 * Habits and their histories are fetched together — one `getHabitHistory` per
 * active habit, using the API's maximum 365-day window — so every widget reads
 * from a single consistent snapshot. Loading and error are derived from which
 * token's result is loaded, matching the Today and Weekly screens (and keeping
 * the effect free of synchronous state updates).
 */
export default function StatsScreen() {
  const { session } = useSession();
  const theme = useTheme();

  const token = session?.token ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const isLoading = Boolean(token) && (!loaded || loaded.token !== token);
  const error = isLoading ? null : loaded?.error ?? null;
  const stats = isLoading ? [] : loaded?.stats ?? [];

  useEffect(() => {
    if (!token) return;

    // Ignore responses that land after the token changed or the screen unmounted.
    let cancelled = false;

    getHabits(token)
      .then(async (habits) => {
        const activeHabits = habits.filter((habit) => !habit.archived);
        const histories = await Promise.all(
          activeHabits.map((habit) =>
            getHabitHistory(token, habit.id, { days: STATS_WINDOW_DAYS }),
          ),
        );
        return activeHabits.map((habit, index) => ({ habit, history: histories[index] }));
      })
      .then((result) => {
        if (!cancelled) setLoaded({ token, stats: result, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          const message =
            cause instanceof Error ? cause.message : 'Could not load your stats.';
          setLoaded({ token, stats: [], error: message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const totalCompletions = stats.reduce((sum, { history }) => sum + history.totalCompletions, 0);
  const best = bestStreak(stats);
  const months = buildMonthlyTrend(stats);
  const categories = buildCategories(stats, totalCompletions);

  const renderBody = () => {
    if (isLoading) {
      return <ActivityIndicator color={theme.primary} accessibilityLabel="Loading stats" />;
    }
    if (error) {
      return (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        </ThemedView>
      );
    }
    if (stats.length === 0) {
      return (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            No habits to measure yet. Add one from the Today tab and your streaks and charts will
            show up here.
          </ThemedText>
        </ThemedView>
      );
    }

    const longestDetail = best.habit
      ? habitLabel(best.habit)
      : 'Check off a few days to start a streak.';

    return (
      <>
        <View style={styles.statGrid}>
          <StatCard
            value={String(best.days)}
            unit={best.days === 1 ? 'day' : 'days'}
            label="🏆 Longest streak"
            detail={longestDetail}
          />
          <StatCard
            value={totalCompletions.toLocaleString()}
            label="✅ Total completions"
            detail={`Across ${stats.length} ${stats.length === 1 ? 'habit' : 'habits'} · last year`}
          />
        </View>

        <MonthlyConsistencyChart months={months} />

        <CategoryBreakdown items={categories} totalCompletions={totalCompletions} />
      </>
    );
  };

  return (
    <PageTemplate title="Stats" subtitle="Your progress over time.">
      {renderBody()}
    </PageTemplate>
  );
}

const styles = StyleSheet.create({
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statCard: {
    // Two columns on phones; grows to fill the row on wider (web) screens.
    flexGrow: 1,
    flexBasis: '45%',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  statValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '600',
  },
  statUnit: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
