import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getHabitHistory, getHabits, HISTORY_WINDOW_DAYS } from '@/api';
import type { Habit, HabitHistory } from '@/api';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** How many of the most recent days the "Completed days" list shows. */
const RECENT_DAYS_SHOWN = 14;

/**
 * Formats a `perDay` entry's `YYYY-MM-DD` date. The API's dates are UTC-day
 * buckets, so parse at local midnight to keep the label on the day the user
 * expects.
 */
function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

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
 * A single day in the "Completed days" list: the day, how many completions it
 * had against the goal, and whether the goal was met.
 */
function DayRow({
  day,
  goalPerDay,
}: {
  day: NonNullable<HabitHistory['perDay'][number]>;
  goalPerDay: number;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.dayRow}>
      <ThemedText type="small" style={styles.dayDate}>
        {formatDay(day.date)}
      </ThemedText>
      <ThemedText
        type="smallBold"
        themeColor={day.goalMet ? 'success' : 'textSecondary'}>
        {`${day.count}/${goalPerDay} ${day.goalMet ? '✓' : ''}`.trim()}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * Habit detail screen (`/habit/[id]`), pushed from a Today row. Shows the
 * habit's name/emoji/description, its current streak, best (longest) streak,
 * completion totals from `GET /api/habits/:id/history`, and the most recent
 * days with whether the goal was met. View-only for now.
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
  /** Newest first, capped so the list stays a glanceable summary. */
  const recentDays = history
    ? [...history.perDay].reverse().slice(0, RECENT_DAYS_SHOWN)
    : [];

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
          <ThemedText type="smallBold">
            {`Completed days — last ${Math.min(RECENT_DAYS_SHOWN, history.perDay.length)}`}
          </ThemedText>
          {recentDays.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No completions in the last {HISTORY_WINDOW_DAYS} days yet.
            </ThemedText>
          ) : (
            recentDays.map((day) => <DayRow key={day.date} day={day} goalPerDay={history.goalPerDay} />)
          )}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <View style={[styles.header, Platform.OS === 'web' && styles.headerWeb]}>
        <Button variant="outline" label="← Back" onPress={() => router.back()} />
      </View>

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
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerWeb: {
    paddingTop: Spacing.six,
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
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dayDate: {
    flex: 1,
  },
});
