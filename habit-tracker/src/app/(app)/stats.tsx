import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getHabitHistory, getHabits, HISTORY_WINDOW_DAYS } from '@/api';
import type { HabitHistory } from '@/api';
import { PageTemplate } from '@/components/page-template';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CompletionCalendar, type CalendarEntry } from '@/components/ui/completion-calendar';
import { WeeklyChart } from '@/components/ui/weekly-chart';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** One combined calendar: every habit's completions folded into a single grid. */
type Combined = {
  entries: CalendarEntry[];
  /** Sum of each habit's `goalPerDay` — the day's combined target. */
  goalPerDay: number;
  /** How many habits feed the grid, for the legend line. */
  habitCount: number;
};

/** Result of the Stats fetch, tagged with the token it belongs to. */
type Loaded = {
  token: string;
  /** null when there is nothing to chart (no habits, or no usable history). */
  stats: Combined | null;
  error: string | null;
};

/**
 * Folds every habit's `perDay` rows into one date → count series, summing each
 * habit's `goalPerDay` into the day's combined target. The sums line up with
 * the per-habit grids because the API already scores weekly habits as 1/day.
 */
function combine(histories: HabitHistory[]): Combined {
  const counts = new Map<string, number>();
  let goalPerDay = 0;

  for (const history of histories) {
    goalPerDay += history.goalPerDay;
    for (const day of history.perDay) {
      counts.set(day.date, (counts.get(day.date) ?? 0) + day.count);
    }
  }

  return {
    entries: [...counts].map(([date, count]) => ({ date, count })),
    goalPerDay,
    habitCount: histories.length,
  };
}

/**
 * The Stats tab: one 28-day calendar plus a weekly bar chart, both combining
 * every active habit's completions against their combined daily goal, so the
 * views read as overall consistency rather than any one habit. Archived habits
 * are excluded — they're no longer active, and keeping their goal in the
 * denominator would penalise every day after the archive date.
 */
export default function StatsScreen() {
  const { session } = useSession();
  const theme = useTheme();

  const token = session?.token ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Loading and error derive from which token's result we have (the pattern
  // the Today and habit detail screens use), so the effect never sets state
  // synchronously — a result for another token simply reads as "still loading".
  const isLoading = Boolean(token) && (!loaded || loaded.token !== token);
  const error = isLoading ? null : loaded?.error ?? null;
  const stats = isLoading ? null : loaded?.stats ?? null;

  // Fetch on focus rather than mount alone, so returning to this tab reflects
  // habits deleted or logged elsewhere (see the Today screen). A refetch keeps
  // the current grid on screen until the fresh one lands.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;

      // Ignore responses that land after the token changed or the screen lost focus.
      let cancelled = false;

      getHabits(token)
        .then((habits) =>
          // One failed history drops out instead of blanking the whole page.
          Promise.all(
            habits
              .filter((habit) => !habit.archived)
              .map((habit) =>
                getHabitHistory(token, habit.id, { days: HISTORY_WINDOW_DAYS }).catch(() => null),
              ),
          ),
        )
        .then((histories) => {
          if (cancelled) return;
          const usable = histories.filter((history): history is HabitHistory => history !== null);
          const allFailed = usable.length === 0 && histories.length > 0;
          setLoaded({
            token,
            stats: usable.length === 0 ? null : combine(usable),
            error: allFailed ? 'Could not load your habit history.' : null,
          });
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          const message = cause instanceof Error ? cause.message : 'Could not load your stats.';
          setLoaded({ token, stats: null, error: message });
        });

      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} accessibilityLabel="Loading stats" />
        </View>
      );
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
    if (!stats) {
      return (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            Nothing to chart yet. Add a habit on the Today tab and its completions will show up
            here.
          </ThemedText>
        </ThemedView>
      );
    }

    return (
      <>
        <View style={styles.section}>
          <ThemedText type="smallBold">Completed days — 28-day calendar</ThemedText>
          <CompletionCalendar entries={stats.entries} goalPerDay={stats.goalPerDay} />
          <ThemedText type="small" themeColor="textSecondary">
            {`Each square fades with how close the day came to your combined ${stats.goalPerDay}× goal across ${stats.habitCount} ${
              stats.habitCount === 1 ? 'habit' : 'habits'
            }.`}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">This week — completions</ThemedText>
          <WeeklyChart entries={stats.entries} goalPerDay={stats.goalPerDay} />
          <ThemedText type="small" themeColor="textSecondary">
            {`Bars show how close each day came to your combined ${stats.goalPerDay}× goal — the dashed line is the goal.`}
          </ThemedText>
        </View>
      </>
    );
  };

  return (
    <PageTemplate title="Stats">
      {renderBody()}
    </PageTemplate>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
});
