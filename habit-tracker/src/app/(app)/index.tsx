import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

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
 * The Today tab: every habit due today in a FlatList — each row shows the
 * habit's emoji, title, current streak, and when the habit was last updated.
 * Tapping a row pushes the habit's detail screen (`/habit/[id]`). The header
 * pins the screen title next to the "+ New Habit" action, which opens React
 * Native's `Modal` via `NewHabitModal`.
 *
 * The FlatList is the screen's scroll container (it is *not* wrapped in the
 * PageTemplate ScrollView, because a virtualized list may not be nested inside
 * a plain ScrollView of the same orientation), so the header sits above the
 * list instead of inside `PageTemplate`.
 */
export default function TodayScreen() {
  const { session } = useSession();
  const theme = useTheme();
  const router = useRouter();

  const token = session?.token ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Bumped after a habit is created so the habits effect fetches again.
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Streaks arrive one habit at a time so each row can fill in as soon as its
  // history lands, without holding up the list itself.
  const [streaks, setStreaks] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!token || !loaded || loaded.error) return;

    let cancelled = false;

    loaded.habits.forEach((habit) => {
      getHabitHistory(token, habit.id, { days: HISTORY_WINDOW_DAYS })
        .then((history) => {
          if (!cancelled) setStreaks((prev) => ({ ...prev, [habit.id]: history.currentStreak }));
        })
        .catch(() => {
          // A failed lookup leaves the row showing "—"; the list itself still renders.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [token, loaded]);

  /** Row meta: current streak plus when the habit itself was last edited. */
  const metaFor = (habit: Habit) => {
    const streak = streaks[habit.id];
    const streakLabel =
      streak === undefined ? '—' : streak === 0 ? 'No streak yet' : `🔥 ${streak}-day streak`;
    return `${streakLabel} · Updated ${formatLastUpdated(habit.lastUpdated)}`;
  };

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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <View style={[styles.header, Platform.OS === 'web' && styles.headerWeb]}>
        <ThemedText type="subtitle">Today</ThemedText>
        <Button variant="outline" label="+ New Habit" onPress={() => setModalOpen(true)} />
      </View>

      <FlatList
        data={habits}
        keyExtractor={(habit) => String(habit.id)}
        renderItem={renderItem}
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
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    // Title on the left, the "+ New Habit" action pinned to the right edge.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerWeb: {
    paddingTop: Spacing.six,
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
