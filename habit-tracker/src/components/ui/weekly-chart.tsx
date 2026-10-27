import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { CalendarEntry } from '@/components/ui/completion-calendar';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, completionLabel, dateKey, weekEnd, WEEKDAY_LABELS } from '@/utils/dates';

/** Height of the bars area; the weekday/day labels sit underneath it. */
const CHART_HEIGHT = 140;

type WeeklyChartProps = {
  /** Day-by-day counts to plot; days without an entry render as an empty track. */
  entries: CalendarEntry[];
  /**
   * Completions in one day that count as the goal — drawn as the dashed line,
   * and the height a bar reaches when the goal is met.
   */
  goalPerDay: number;
  /** Color family for the bars. Defaults to the app's `primary`. */
  color?: ThemeColor;
};

/** One column: its bar height, track, and labels, all derived from one day. */
type WeekBar = {
  /** Local `YYYY-MM-DD`, used to match entries and key the render. */
  key: string;
  dayOfMonth: number;
  /** Weekday initial for this column (from the shared Sunday-first labels). */
  weekday: string;
  /** Bar height as a percentage of the chart (`rate / scale`). */
  heightPct: number;
  /** Whether the caller sent data for this date — an empty track when not. */
  hasData: boolean;
  /** Screen-reader label, e.g. `Oct 26: 7 of 8 completions, goal met`. */
  label: string;
};

/**
 * Turns this week's entries into bars plus the goal line's position. The scale
 * is `max(1, highest rate)` so a day that beat the goal still fits, with the
 * dashed line at `1 / scale` — normally the top of the chart, dipping down only
 * when some day overshot the goal.
 */
function buildBars(entries: CalendarEntry[], goal: number): { bars: WeekBar[]; goalPct: number } {
  const counts = new Map(entries.map((entry) => [entry.date, entry.count]));
  // The same week the 28-day calendar's last row shows: Sunday → Saturday,
  // ending on the Saturday on or after today.
  const end = weekEnd();

  const days = WEEKDAY_LABELS.map((weekday, index) => {
    const date = addDays(end, index - (WEEKDAY_LABELS.length - 1));
    const count = counts.get(dateKey(date)) ?? null;
    return { date, weekday, count, rate: count === null ? 0 : count / goal };
  });
  const scale = Math.max(1, ...days.map((day) => day.rate));

  return {
    bars: days.map((day) => ({
      key: dateKey(day.date),
      dayOfMonth: day.date.getDate(),
      weekday: day.weekday,
      // rate ≤ scale by construction, so this never exceeds the chart height.
      heightPct: day.count === null ? 0 : (day.rate / scale) * 100,
      hasData: day.count !== null,
      label: completionLabel(day.date, day.count, goal),
    })),
    goalPct: (1 / scale) * 100,
  };
}

/**
 * Weekly bar chart for the week containing today: one bar per day, its height
 * that day's completion rate against `goalPerDay`, with a dashed goal line the
 * bars reach when the goal is met. Days with no entry (past today, or outside
 * the window the caller fetched) show an empty track and a muted label, so the
 * grid reads as "not yet" rather than "zero".
 *
 * Shares the week boundary and day labels with `CompletionCalendar`, so the
 * columns line up directly under the 28-day grid.
 */
export function WeeklyChart({ entries, goalPerDay, color = 'primary' }: WeeklyChartProps) {
  const theme = useTheme();
  const fill = theme[color];
  // goalPerDay is ≥ 1 from the API; the guard keeps a bad value from dividing by zero.
  const goal = Math.max(goalPerDay, 1);
  const { bars, goalPct } = buildBars(entries, goal);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View
        style={[
          styles.bars,
          { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundSelected },
        ]}>
        {bars.map((bar) => (
          <View key={bar.key} accessible accessibilityLabel={bar.label} style={styles.column}>
            <View
              style={[
                styles.track,
                { backgroundColor: bar.hasData ? theme.backgroundSelected : 'transparent' },
              ]}>
              <View
                style={[styles.bar, { height: `${bar.heightPct}%`, backgroundColor: fill }]}
              />
            </View>
          </View>
        ))}
        {/* Drawn last so the line reads over the bars; it never takes touches. */}
        <View
          pointerEvents="none"
          style={[styles.goalLine, { bottom: `${goalPct}%`, borderColor: theme.textSecondary }]}
        />
      </View>

      <View style={styles.labels}>
        {bars.map((bar) => (
          <View key={bar.key} style={styles.labelColumn}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {bar.weekday}
            </ThemedText>
            <ThemedText
              type="smallBold"
              themeColor={bar.hasData ? 'text' : 'textSecondary'}
              style={styles.label}>
              {bar.dayOfMonth}
            </ThemedText>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    // Capped to match CompletionCalendar so the two grids stay column-aligned.
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  bars: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  column: {
    flex: 1,
    height: '100%',
  },
  track: {
    // Fills the column; the bar sits flush at the bottom inside it.
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: Spacing.one,
    borderTopRightRadius: Spacing.one,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  labels: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  label: {
    textAlign: 'center',
  },
});
