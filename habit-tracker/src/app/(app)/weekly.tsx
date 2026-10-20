import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { getHabitHistory, getHabits, HISTORY_WINDOW_DAYS } from '@/api';
import type { Habit, HabitHistory } from '@/api';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyCompletionView } from '@/components/weekly-completion-view';
import type { WeeklyCompletionDay } from '@/components/weekly-completion-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** One day of the current week for a single habit. */
type WeekDay = {
  /** Local `YYYY-MM-DD` bucket key. */
  date: string;
  count: number;
  goalMet: boolean;
  isFuture: boolean;
};

/** One habit's progress through the current Monday–Sunday week. */
type HabitWeek = {
  habit: Habit;
  /** Monday through Sunday, oldest first. */
  days: WeekDay[];
  /** Elapsed days where the habit's daily goal was met. */
  daysMet: number;
  /** Completions logged on elapsed days. */
  completions: number;
  /** Days of the week that have already happened. */
  elapsedDays: number;
  /** 0–1 progress toward the habit's weekly target. */
  progress: number;
  /** True once every elapsed day (daily) or the weekly target (weekly) is met. */
  isComplete: boolean;
};

/** Result of one `getHabits` + histories load, tagged with the token it belongs to. */
type Loaded = {
  token: string;
  weeks: HabitWeek[];
  error: string | null;
};

/** Parses a `YYYY-MM-DD` day bucket at local midnight so the weekday is correct. */
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** Formats a local date as `YYYY-MM-DD` without shifting through UTC. */
function formatDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Midnight on the Monday of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** A new date `offset` days after `date`, at local midnight. */
function addDays(date: Date, offset: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

/**
 * Builds one habit's current week from its history. The week is anchored to the
 * newest `perDay` entry (the API's UTC "today"), matching `WeeklyHabitTracker`,
 * so future days read as upcoming rather than missed.
 *
 * Daily habits are measured by goal-met days; weekly habits by completions
 * against `timesPerPeriod`, since their goal spans the whole week.
 */
function buildWeek(habit: Habit, history: HabitHistory): HabitWeek {
  const byDate = new Map(history.perDay.map((day) => [day.date, day]));
  const newest = history.perDay[history.perDay.length - 1]?.date;
  const referenceDate = newest ? parseDay(newest) : new Date();
  const todayKey = newest ?? formatDayKey(referenceDate);
  const weekStart = startOfWeek(referenceDate);

  const days = Array.from({ length: 7 }, (_, offset) => {
    const key = formatDayKey(addDays(weekStart, offset));
    const entry = byDate.get(key);
    return {
      date: key,
      count: entry?.count ?? 0,
      goalMet: entry?.goalMet ?? false,
      isFuture: key > todayKey,
    };
  });

  const elapsed = days.filter((day) => !day.isFuture);
  const daysMet = elapsed.filter((day) => day.goalMet).length;
  const completions = elapsed.reduce((sum, day) => sum + day.count, 0);
  const target =
    habit.frequency === 'DAILY' ? elapsed.length : Math.max(habit.timesPerPeriod, 1);
  const done = habit.frequency === 'DAILY' ? daysMet : Math.min(completions, target);

  return {
    habit,
    days,
    daysMet,
    completions,
    elapsedDays: elapsed.length,
    progress: target === 0 ? 0 : done / target,
    isComplete: target > 0 && done >= target,
  };
}

/**
 * Collapses every habit's week into one grid for `WeeklyCompletionView`. Daily
 * habits count once their daily goal is met; weekly habits count once they log
 * any completion that day, since their goal is measured across the week.
 */
function completionDays(weeks: HabitWeek[]): WeeklyCompletionDay[] {
  const reference = weeks[0];
  if (!reference) return [];

  return reference.days.map((day, index) => {
    if (day.isFuture) {
      return { date: day.date, completed: 0, total: 0, isFuture: true };
    }

    const completed = weeks.filter((week) => {
      const entry = week.days[index];
      return week.habit.frequency === 'DAILY' ? entry.goalMet : entry.count > 0;
    }).length;

    return { date: day.date, completed, total: weeks.length, isFuture: false };
  });
}

/** A habit's name prefixed with its emoji, when it has one. */
function habitLabel(habit: Habit): string {
  const emoji = habit.emoji?.trim();
  return emoji ? `${emoji} ${habit.name}` : habit.name;
}

/**
 * The Weekly tab: an aggregate Monday–Sunday completion widget for every active
 * habit, followed by a `FlatList` of this week's progress per habit. Each row
 * shows the habit's emoji, name, percentage, a progress bar, and a
 * days-met/completions line; tapping a row opens the habit's detail screen.
 *
 * Like the Today tab, the `FlatList` is the screen's scroll container (a
 * virtualized list may not be nested inside `PageTemplate`'s `ScrollView`), so
 * the completion widget and section header live in `ListHeaderComponent` and
 * scroll with the list. Every habit's history is fetched alongside the habit
 * list so the widget and rows render from a single consistent snapshot.
 */
export default function WeeklyScreen() {
  const { session } = useSession();
  const theme = useTheme();
  const router = useRouter();

  const token = session?.token ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Loading and error are derived from which token's result we have, so the
  // effect never sets state synchronously (see TodayScreen).
  const isLoading = Boolean(token) && (!loaded || loaded.token !== token);
  const error = isLoading ? null : loaded?.error ?? null;
  const weeks = isLoading ? [] : loaded?.weeks ?? [];

  useEffect(() => {
    if (!token) return;

    // Ignore responses that land after the token changed or the screen unmounted.
    let cancelled = false;

    getHabits(token)
      .then(async (habits) => {
        const activeHabits = habits.filter((habit) => !habit.archived);
        const histories = await Promise.all(
          activeHabits.map((habit) =>
            getHabitHistory(token, habit.id, { days: HISTORY_WINDOW_DAYS }),
          ),
        );
        return activeHabits.map((habit, index) => buildWeek(habit, histories[index]));
      })
      .then((result) => {
        if (!cancelled) setLoaded({ token, weeks: result, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message =
          cause instanceof Error ? cause.message : 'Could not load this week’s habits.';
        setLoaded({ token, weeks: [], error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const renderItem = ({ item }: ListRenderItemInfo<HabitWeek>) => {
    const emoji = item.habit.emoji?.trim();
    const percent = Math.round(item.progress * 100);
    const detail =
      item.habit.frequency === 'DAILY'
        ? `${item.daysMet} of ${item.elapsedDays} ${
            item.elapsedDays === 1 ? 'day' : 'days'
          } met · Daily`
        : `${item.completions} of ${item.habit.timesPerPeriod} ${
            item.habit.timesPerPeriod === 1 ? 'completion' : 'completions'
          } · Weekly`;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${habitLabel(item.habit)}. ${detail}, ${percent}% complete.`}
        onPress={() =>
          router.push({ pathname: '/habit/[id]', params: { id: String(item.habit.id) } })
        }>
        {({ pressed }) => (
          <ThemedView type="backgroundElement" style={[styles.row, pressed && styles.rowPressed]}>
            {/* Fixed-width slot keeps titles aligned when a habit has no emoji. */}
            <ThemedText style={styles.emoji} themeColor={emoji ? 'text' : 'textSecondary'}>
              {emoji || '·'}
            </ThemedText>
            <View style={styles.rowBody}>
              <View style={styles.rowTitle}>
                <ThemedText numberOfLines={1} style={styles.habitName}>
                  {item.habit.name}
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  themeColor={item.isComplete ? 'primary' : 'textSecondary'}>
                  {`${item.isComplete ? '✓ ' : ''}${percent}%`}
                </ThemedText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`${item.habit.name} this week`}
                accessibilityValue={{ min: 0, max: 100, now: percent }}
                style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${percent}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {detail}
              </ThemedText>
            </View>
          </ThemedView>
        )}
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return <ActivityIndicator color={theme.primary} accessibilityLabel="Loading this week" />;
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
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          No habits to track this week. Add a habit from the Today tab and its progress will show
          up here.
        </ThemedText>
      </ThemedView>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      {weeks.length > 0 ? <WeeklyCompletionView days={completionDays(weeks)} /> : null}

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>This Week&apos;s Progress</ThemedText>
        {!isLoading && !error && weeks.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`${weeks.length} ${weeks.length === 1 ? 'habit' : 'habits'}`}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <PageHeader title="Weekly" />

      <FlatList
        data={weeks}
        keyExtractor={(week) => String(week.habit.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listHeader: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowPressed: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 30,
    width: 32,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    gap: Spacing.one,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  habitName: {
    flex: 1,
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
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
