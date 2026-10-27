import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Habit, HabitHistory } from '@/api';
import { deleteHabit, getHabitHistory, getHabits, HISTORY_WINDOW_DAYS, logHabitCompletion } from '@/api';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { CompletionCalendar } from '@/components/ui/completion-calendar';
import { WeeklyChart } from '@/components/ui/weekly-chart';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** Result of the detail screen's fetch, tagged with the token, habit, and refresh it belongs to. */
type Loaded = {
  token: string;
  habitId: number;
  refreshKey: number;
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
 * completion totals from `GET /api/habits/:id/history`, a 28-day calendar whose
 * squares fade with each day's completion rate, and a weekly bar chart for the
 * week containing today. A habit's fields aren't editable once created — the
 * "✅ Log habit" button above the stat grid records a completion (`POST
 * /api/habits/:id/logs`) and refreshes the stats, and "🗑 Delete habit" at the
 * bottom removes the habit and its history for good.
 *
 * It lives at the root level rather than inside `(app)` so it gets real stack
 * push/back behavior — the `(app)` group is a tab navigator, and every route
 * in it is a tab.
 */
export default function HabitDetailScreen() {
  const { session } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const token = session?.token ?? null;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const habitId = Number(rawId);
  const hasValidId = rawId !== undefined && Number.isInteger(habitId) && habitId > 0;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Bumped after a log/delete-adjacent change so the effect fetches again.
  const [refreshKey, setRefreshKey] = useState(0);

  // Loading and error are derived from which token/habit's result we have, so
  // the effect never sets state synchronously (see TodayScreen) — a stale
  // result for another token or habit simply reads as "still loading". A
  // refresh (after logging a completion) keeps the current content on screen
  // until the fresh data lands.
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
          refreshKey,
          habit: habits.find((candidate) => candidate.id === habitId) ?? null,
          history: habitHistory,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Could not load this habit.';
        setLoaded({ token, habitId, refreshKey, habit: null, history: null, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, habitId, hasValidId, refreshKey]);

  /**
   * Records one completion for now (the API stamps `completedAt`), then bumps
   * `refreshKey` so the streaks, calendar, and charts reload around it.
   */
  const onLogCompletion = async () => {
    if (!token || logging) return;
    setActionError(null);
    setLogging(true);
    try {
      await logHabitCompletion(token, habitId);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not log this habit.');
    } finally {
      setLogging(false);
    }
  };

  /**
   * Asks to confirm, then deletes and pops back to Today. `Alert.alert` is a
   * no-op on web, so the browser's `confirm` stands in there.
   */
  const onDeleteHabit = async () => {
    if (!token || deleting) return;
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Delete this habit and all of its history? This cannot be undone.')
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Delete habit',
              'This deletes the habit and all of its history. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ],
            );
          });
    if (!confirmed) return;

    setActionError(null);
    setDeleting(true);
    try {
      await deleteHabit(token, habitId);
      router.back();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not delete this habit.');
      setDeleting(false);
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

    return (
      <>
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.hero}>
            <ThemedText style={styles.heroEmoji} themeColor={emoji ? 'text' : 'textSecondary'}>
              {emoji || '·'}
            </ThemedText>
            <View style={styles.heroBody}>
              <ThemedText type="subtitle">{habit.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {frequencyLabel}
              </ThemedText>
            </View>
          </View>
          {habit.description ? (
            <ThemedText type="small" themeColor="textSecondary">
              {habit.description}
            </ThemedText>
          ) : null}
        </ThemedView>

        <View style={styles.actions}>
          {/* `loading` swaps the label for a spinner, so these labels stand still. */}
          <Button
            label="✅ Log habit"
            onPress={onLogCompletion}
            loading={logging}
            disabled={deleting}
          />
          {actionError ? (
            <ThemedText type="small" themeColor="danger">
              {actionError}
            </ThemedText>
          ) : null}
        </View>

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
          <ThemedText type="smallBold">Completed days — 28-day calendar</ThemedText>
          <CompletionCalendar entries={history.perDay} goalPerDay={history.goalPerDay} />
          <ThemedText type="small" themeColor="textSecondary">
            {`Each square fades with how close that day got to your ${history.goalPerDay}× goal.`}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">This week — completions</ThemedText>
          <WeeklyChart entries={history.perDay} goalPerDay={history.goalPerDay} />
          <ThemedText type="small" themeColor="textSecondary">
            {`Bars show how close each day came to your ${history.goalPerDay}× goal — the dashed line is the goal.`}
          </ThemedText>
        </View>

        {/* Kept far from "Log habit" so the two are hard to tap by mistake. */}
        <Button
          type="danger"
          variant="outline"
          label="🗑 Delete habit"
          onPress={onDeleteHabit}
          loading={deleting}
          disabled={logging}
        />
      </>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <PageHeader
        title="Habit"
        actions={<Button variant="outline" label="← Back" onPress={() => router.back()} />}
      />

      <ScrollView
        contentContainerStyle={styles.content}>
        {renderBody()}
      </ScrollView>
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
  heroBody: {
    flex: 1,
    gap: Spacing.one,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
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
