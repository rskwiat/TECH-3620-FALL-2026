import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import {
  createHabitLog,
  getHabitHistory,
  getHabits,
  HISTORY_WINDOW_DAYS,
} from '@/api';
import type { Habit, HabitHistory } from '@/api';
import { HabitCalendar } from '@/components/habit-calendar';
import { HabitWeeklyChart } from '@/components/habit-weekly-chart';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
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
 * habit's name/emoji/description, today's progress with a "log completion"
 * action that writes to `POST /api/habits/:id/logs`, its current streak, best
 * (longest) streak, completion totals from `GET /api/habits/:id/history`, a
 * weekly consistency chart, a Monday–Sunday weekly tracker, and the last 28
 * days as a calendar widget.
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
  // Bumped after a completion is logged so the history (and every stat derived
  // from it) refetches. The current data stays on screen while that happens.
  const [refreshKey, setRefreshKey] = useState(0);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

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
  }, [token, habitId, hasValidId, refreshKey]);

  /** Writes one completion for right now, then reloads the history. */
  const onLogCompletion = async () => {
    if (!token || !habit || logging) return;

    setLogging(true);
    setLogError(null);

    try {
      await createHabitLog(token, habit.id);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setLogError(cause instanceof Error ? cause.message : 'Could not log this completion.');
    } finally {
      setLogging(false);
    }
  };

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

    // `perDay` is oldest → newest, so the last entry is the API's current day.
    const today = history.perDay[history.perDay.length - 1];
    const todayCount = today?.count ?? 0;
    const goalMetToday = today?.goalMet ?? false;
    const todayPercent = Math.min(
      100,
      Math.round((todayCount / Math.max(history.goalPerDay, 1)) * 100),
    );
    const completionsLabel = `${todayCount} of ${Math.max(history.goalPerDay, 1)} ${
      history.goalPerDay === 1 ? 'completion' : 'completions'
    }`;

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

        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.logHeader}>
            <View style={styles.logHeaderText}>
              <ThemedText type="smallBold">Today</ThemedText>
              <ThemedText
                type="small"
                themeColor={goalMetToday ? 'success' : 'textSecondary'}>
                {goalMetToday
                  ? `✓ Goal met — ${completionsLabel} logged`
                  : `${completionsLabel} logged`}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {`${todayPercent}%`}
            </ThemedText>
          </View>

          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Today's progress"
            accessibilityValue={{ min: 0, max: 100, now: todayPercent }}
            style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${todayPercent}%`,
                  backgroundColor: goalMetToday ? theme.success : theme.primary,
                },
              ]}
            />
          </View>

          <Button
            label={goalMetToday ? 'Log another completion' : 'Log completion'}
            type={goalMetToday ? 'secondary' : 'primary'}
            onPress={onLogCompletion}
            loading={logging}
          />

          {logError ? (
            <ThemedText type="small" themeColor="danger">
              {logError}
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
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  logHeaderText: {
    flex: 1,
    gap: Spacing.one,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
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
