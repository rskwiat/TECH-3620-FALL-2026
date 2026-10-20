import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { getHabitHistory, getHabits, HISTORY_WINDOW_DAYS } from '@/api';
import type { Habit, HabitHistory } from '@/api';
import { HabitCalendar } from '@/components/habit-calendar';
import { HabitWeeklyChart } from '@/components/habit-weekly-chart';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyHabitTracker } from '@/components/weekly-habit-tracker';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** Result of the detail screen's fetch, tagged with the token and habit it belongs to. */
type Loaded = {
  token: string;
  habitId: number;
  habit: Habit | null;
  history: HabitHistory | null;
  error: string | null;
};

/** One headline number with its label, used for the streak/completion stats. */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.statCard}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * Habit detail screen (`/habit/[id]`), pushed from a Today row. Shows the
 * habit's name/emoji/description, its current streak, best (longest) streak,
 * completion totals from `GET /api/habits/:id/history`, a weekly consistency
 * chart, a Monday–Sunday weekly tracker, and the last 28 days as a calendar
 * widget. View-only for now.
 *
 * It lives at the root level rather than inside `(app)` so it gets real stack
 * push/back behavior — the `(app)` group is a tab navigator, and every route
 * in it is a tab.
 */
export default function HabitDetailScreen() {
  const { session } = useSession();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const token = session?.token ?? null;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const habitId = Number(rawId);
  const hasValidId = rawId !== undefined && Number.isInteger(habitId) && habitId > 0;

  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Loading and error are derived from which token/habit's result we have, so
  // the effect never sets state synchronously (see TodayScreen) — a stale
  // result for another token or habit simply reads as "still loading".
  const isLoading =
    Boolean(token) && hasValidId && (!loaded || loaded.token !== token || loaded.habitId !== habitId);
  const error = isLoading ? null : loaded?.error ?? null;
  const habit = isLoading ? null : loaded?.habit ?? null;
  const history = isLoading ? null : loaded?.history ?? null;

  useEffect(() => {
    if (!token || !hasValidId) return;

    // Ignore responses that land after the token/id changed or the screen unmounted.
    let cancelled = false;

    Promise.all([
      getHabits(token),
      getHabitHistory(token, habitId, { days: HISTORY_WINDOW_DAYS }),
    ])
      .then(([habits, habitHistory]) => {
        if (cancelled) return;
        setLoaded({
          token,
          habitId,
          habit: habits.find((candidate) => candidate.id === habitId) ?? null,
          history: habitHistory,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Could not load this habit.';
        setLoaded({ token, habitId, habit: null, history: null, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, habitId, hasValidId]);

  /** Days within the window where the goal was met — the "completed" count. */
  const daysGoalMet = history?.perDay.filter((day) => day.goalMet).length ?? 0;

  const renderBody = () => {
    if (!hasValidId) {
      return (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            That habit link isn&apos;t valid.
          </ThemedText>
        </ThemedView>
      );
    }
    if (isLoading) {
      return <ActivityIndicator color={theme.primary} accessibilityLabel="Loading habit" />;
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
    if (!habit || !history) {
      return (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            We couldn&apos;t find that habit. It may have been deleted.
          </ThemedText>
        </ThemedView>
      );
    }

    const emoji = habit.emoji?.trim();
    const frequencyLabel =
      habit.frequency === 'DAILY'
        ? `Daily · ${habit.timesPerPeriod}× per day`
        : `Weekly · ${habit.timesPerPeriod}× per week`;

    return (
      <>
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.hero}>
            <ThemedText style={styles.heroEmoji} themeColor={emoji ? 'text' : 'textSecondary'}>
              {emoji || '·'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{frequencyLabel}</ThemedText>
          </View>
          {habit.description ? (
            <ThemedText type="small" themeColor="textSecondary">
              {habit.description}
            </ThemedText>
          ) : null}
        </ThemedView>

        <View style={styles.statGrid}>
          <StatCard value={String(history.currentStreak)} label="🔥 Current streak (days)" />
          <StatCard value={String(history.longestStreak)} label="🏆 Best streak (days)" />
          <StatCard value={String(history.totalCompletions)} label="✅ Total completions" />
          <StatCard
            value={`${daysGoalMet}/${history.perDay.length}`}
            label="📅 Days goal met"
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Weekly consistency</ThemedText>
          <HabitWeeklyChart
            days={history.perDay}
            frequency={history.frequency}
            timesPerPeriod={history.timesPerPeriod}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Weekly tracker</ThemedText>
          <WeeklyHabitTracker days={history.perDay} goalPerDay={history.goalPerDay} />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Completed days</ThemedText>
          <HabitCalendar days={history.perDay} goalPerDay={history.goalPerDay} />
        </View>
      </>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <PageHeader title={habit?.name ?? 'Habit'} showBack />

      <ScrollView contentContainerStyle={styles.content}>{renderBody()}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroEmoji: {
    fontSize: 40,
    lineHeight: 48,
    width: 48,
    textAlign: 'center',
  },
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
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
  },
  section: {
    gap: Spacing.two,
  },
});
