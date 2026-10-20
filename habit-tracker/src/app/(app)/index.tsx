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

import { createHabit, getHabitHistory, getHabits, HISTORY_WINDOW_DAYS } from '@/api';
import type { Habit, NewHabitInput } from '@/api';
import { NewHabitModal } from '@/components/new-habit-modal';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/**
 * Affirmations shown under the welcome greeting. One is picked at random each
 * time the screen mounts, so the Today tab opens with a little variety.
 */
const AFFIRMATIONS = [
  'Small steps every day add up to big change.',
  "You don't have to be perfect — just consistent.",
  'Progress, not perfection.',
  'A little progress each day is still progress.',
  'Show up for yourself today.',
  'Your future self will thank you.',
  'One habit at a time.',
  'Consistency beats intensity.',
  "You're doing better than you think.",
  'Every check-in counts.',
  'Start where you are. Use what you have.',
  'Keep the promise you made to yourself.',
];

/** Time-of-day greeting for the welcome block. */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** First word of the signed-in user's name, for a friendlier greeting. */
function firstName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : 'there';
}

/** A habit's name prefixed with its emoji, when it has one. */
function habitLabel(habit: Habit): string {
  const emoji = habit.emoji?.trim();
  return emoji ? `${emoji} ${habit.name}` : habit.name;
}

/** The summary cards' slice of one habit's history. */
type Pulse = {
  currentStreak: number;
  goalMetToday: boolean;
};

/**
 * Today's habits are everything the API hands back for the signed-in user
 * minus archived ones: `DAILY` habits are due every day, and `WEEKLY` habits
 * can be completed on any day of the week, so both belong on this list.
 */
function todaysHabits(habits: Habit[]): Habit[] {
  return habits.filter((habit) => !habit.archived);
}

/** Result of one `getHabits` call, tagged with the token and refresh it belongs to. */
type Loaded = {
  token: string;
  refreshKey: number;
  habits: Habit[];
  error: string | null;
};

/** Formats a habit's `lastUpdated` timestamp for the row's meta line. */
function formatLastUpdated(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/**
 * The Today tab: a welcome block (time-of-day greeting plus a random
 * affirmation), two summary cards (today's progress and the best active
 * streak), and every habit due today in a FlatList — each row shows the
 * habit's emoji, title, current streak, and when the habit was last updated.
 * Tapping a row pushes the habit's detail screen (`/habit/[id]`). The section
 * header pairs the title with the "+ New Habit" action, which opens React
 * Native's `Modal` via `NewHabitModal`.
 *
 * The FlatList is the screen's scroll container (it is *not* wrapped in the
 * PageTemplate ScrollView, because a virtualized list may not be nested inside
 * a plain ScrollView of the same orientation), so the welcome block, cards,
 * and header all sit in `ListHeaderComponent` and scroll with the list.
 */
export default function TodayScreen() {
  const { session, user } = useSession();
  const theme = useTheme();
  const router = useRouter();

  const token = session?.token ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Bumped after a habit is created so the habits effect fetches again.
  const [refreshKey, setRefreshKey] = useState(0);
  // Picked once per mount so the welcome block doesn't reshuffle on re-render.
  const [affirmation] = useState(
    () => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)],
  );

  // Loading and error are derived from which token's result we have, so the
  // effect never has to set state synchronously: a result for another token
  // (or no result yet) simply reads as "still loading". A refresh keeps the
  // current rows on screen until the fresh ones arrive.
  const isLoading = Boolean(token) && (!loaded || loaded.token !== token);
  const error = isLoading ? null : loaded?.error ?? null;
  const habits = isLoading ? [] : loaded?.habits ?? [];

  useEffect(() => {
    if (!token) return;

    // Ignore responses that land after the token changed or the screen unmounted.
    let cancelled = false;

    getHabits(token)
      .then((result) => {
        if (!cancelled) setLoaded({ token, refreshKey, habits: todaysHabits(result), error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Could not load your habits.';
        setLoaded({ token, refreshKey, habits: [], error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  /** Creates a habit, then bumps `refreshKey` so the list (and streaks) reload. */
  const onCreateHabit = async (input: NewHabitInput) => {
    if (!token) throw new Error('Sign in again to add habits.');
    await createHabit(token, input);
    setRefreshKey((key) => key + 1);
  };

  // Streaks and today's progress arrive one habit at a time so each row can
  // fill in as soon as its history lands, without holding up the list itself.
  // `undefined` means the lookup is still in flight; `null` means it failed.
  const [pulses, setPulses] = useState<Record<number, Pulse | null>>({});

  useEffect(() => {
    if (!token || !loaded || loaded.error) return;

    let cancelled = false;

    loaded.habits.forEach((habit) => {
      getHabitHistory(token, habit.id, { days: HISTORY_WINDOW_DAYS })
        .then((history) => {
          if (cancelled) return;
          // `perDay` is oldest → newest, and the last entry is today's UTC
          // bucket — the same bucket the API used to compute the streak.
          const today = history.perDay[history.perDay.length - 1];
          setPulses((prev) => ({
            ...prev,
            [habit.id]: {
              currentStreak: history.currentStreak,
              goalMetToday: today?.goalMet ?? false,
            },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          // A failed lookup leaves the row showing "—"; the list itself still renders.
          setPulses((prev) => ({ ...prev, [habit.id]: null }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [token, loaded]);

  /** Row meta: current streak plus when the habit itself was last edited. */
  const metaFor = (habit: Habit) => {
    const streak = pulses[habit.id]?.currentStreak;
    const streakLabel =
      streak === undefined ? '—' : streak === 0 ? 'No streak yet' : `🔥 ${streak}-day streak`;
    return `${streakLabel} · Updated ${formatLastUpdated(habit.lastUpdated)}`;
  };

  // Summary cards: how many habits have met today's goal, and the longest
  // active streak (with the habit carrying it).
  const totalHabits = habits.length;
  const doneToday = habits.filter((habit) => pulses[habit.id]?.goalMetToday).length;
  const progressPercent = totalHabits === 0 ? 0 : Math.round((doneToday / totalHabits) * 100);
  const bestStreak = habits.reduce(
    (best, habit) => Math.max(best, pulses[habit.id]?.currentStreak ?? 0),
    0,
  );
  const bestStreakHabit = habits.find(
    (habit) => bestStreak > 0 && (pulses[habit.id]?.currentStreak ?? 0) === bestStreak,
  );

  // Wait for every lookup to settle (success or failure) so the cards don't
  // flash "0%" while the histories are still in flight.
  const summariesReady =
    !isLoading && !error && habits.every((habit) => pulses[habit.id] !== undefined);
  /** Shown while the cards have no trustworthy numbers to display. */
  const summaryPlaceholder = error ? 'Unavailable right now' : 'Checking today…';

  const progressCaption = summariesReady
    ? totalHabits === 0
      ? 'No habits yet'
      : `${doneToday} of ${totalHabits} habits done`
    : summaryPlaceholder;

  const streakCaption = summariesReady
    ? bestStreakHabit
      ? `🔥 ${habitLabel(bestStreakHabit)}`
      : totalHabits === 0
        ? 'Add a habit to begin'
        : 'Start one today'
    : summaryPlaceholder;

  const renderItem = ({ item }: ListRenderItemInfo<Habit>) => {
    const emoji = item.emoji?.trim();
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${item.name}`}
        onPress={() => router.push({ pathname: '/habit/[id]', params: { id: String(item.id) } })}>
        {({ pressed }) => (
          <ThemedView type="backgroundElement" style={[styles.row, pressed && styles.rowPressed]}>
            {/* Fixed-width slot keeps titles aligned when a habit has no emoji. */}
            <ThemedText
              style={styles.emoji}
              themeColor={emoji ? 'text' : 'textSecondary'}>
              {emoji || '·'}
            </ThemedText>
            <View style={styles.rowBody}>
              <ThemedText>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {metaFor(item)}
              </ThemedText>
            </View>
          </ThemedView>
        )}
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return <ActivityIndicator color={theme.primary} accessibilityLabel="Loading habits" />;
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
          Nothing to track today. Add a habit and it will show up here.
        </ThemedText>
      </ThemedView>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <ThemedView type="backgroundElement" style={styles.welcome}>
        <ThemedText style={styles.greeting}>
          {`${greetingFor(new Date())}, ${firstName(user?.name)}`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`${affirmation}`}
        </ThemedText>
      </ThemedView>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Today&apos;s Habits</ThemedText>
        <Button size="small" variant="outline" label="+ New Habit" onPress={() => setModalOpen(true)} />
      </View>

      <View style={styles.summaryRow}>
        <ThemedView type="backgroundElement" style={styles.summaryCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Daily progress
          </ThemedText>
          <ThemedText style={styles.summaryValue}>
            {summariesReady ? `${progressPercent}%` : '—'}
          </ThemedText>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Daily progress"
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
            style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${summariesReady ? progressPercent : 0}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {progressCaption}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.summaryCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Current streak
          </ThemedText>
          <View style={styles.streakRow}>
            <ThemedText style={styles.summaryValue}>
              {summariesReady ? String(bestStreak) : '—'}
            </ThemedText>
            {summariesReady ? (
              <ThemedText type="small" themeColor="textSecondary">
                {bestStreak === 1 ? 'day' : 'days'}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {streakCaption}
          </ThemedText>
        </ThemedView>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <PageHeader title="Today" />

      <FlatList
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
      />

      <NewHabitModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={onCreateHabit}
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
  welcome: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  greeting: {
    fontSize: 18,
    lineHeight: 32,
    fontWeight: '600',
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
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryCard: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  summaryValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
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
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
