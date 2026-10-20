import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** One month bucket in the stats trend chart. */
export type MonthlyConsistencyPoint = {
  /** Local `YYYY-MM` bucket key. */
  month: string;
  /** 0–1, where 1 means fully consistent. */
  consistency: number;
  /** Completions logged across every habit in the month. */
  completions: number;
};

type MonthlyConsistencyChartProps = {
  /** Oldest first; usually the last six months that contain activity. */
  months: MonthlyConsistencyPoint[];
};

/** Parses a `YYYY-MM` key at local midnight on the first of the month. */
function parseMonth(month: string): Date {
  return new Date(`${month}-01T00:00:00`);
}

/** "Oct" for the axis label. */
function formatMonthLabel(month: string): string {
  return parseMonth(month).toLocaleDateString(undefined, { month: 'short' });
}

/** "October 2026" for the screen-reader description. */
function formatMonthName(month: string): string {
  return parseMonth(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Screen-reader description for one month's bar. */
function describeMonth(point: MonthlyConsistencyPoint, isCurrent: boolean): string {
  const percent = Math.round(point.consistency * 100);
  const pending = isCurrent ? ' This month is still in progress.' : '';
  return `${formatMonthName(point.month)}: ${percent}% consistent, ${point.completions} ${
    point.completions === 1 ? 'completion' : 'completions'
  }.${pending}`;
}

/**
 * A bar chart of monthly consistency across every active habit: one bar per
 * month (up to six) with the percentage above it and the month below. Daily
 * habits contribute the share of days their goal was met; weekly habits
 * contribute progress toward their weekly target. The current month is faded
 * because it is still in progress.
 */
export function MonthlyConsistencyChart({ months }: MonthlyConsistencyChartProps) {
  const theme = useTheme();

  if (months.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Monthly consistency</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Once you start checking off habits, a month-by-month trend will appear here.
        </ThemedText>
      </ThemedView>
    );
  }

  const average = months.reduce((sum, month) => sum + month.consistency, 0) / months.length;
  const range = `${formatMonthName(months[0].month)} – ${formatMonthName(
    months[months.length - 1].month,
  )}`;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">Monthly consistency</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {range}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="primary" style={styles.summary}>
          {`${Math.round(average * 100)}% average`}
        </ThemedText>
      </View>

      <View style={styles.chart}>
        {months.map((point, index) => {
          const percent = Math.round(point.consistency * 100);
          const isCurrent = index === months.length - 1;
          // Give non-zero months a visible stub even when the percentage rounds low.
          const fillHeight = point.consistency > 0 ? Math.max(point.consistency * 100, 4) : 0;

          return (
            <View
              key={point.month}
              accessible
              accessibilityLabel={describeMonth(point, isCurrent)}
              style={styles.column}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.valueLabel}>
                {`${percent}%`}
              </ThemedText>
              <View style={[styles.track, { backgroundColor: `${theme.primary}1A` }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      height: `${fillHeight}%`,
                      backgroundColor: isCurrent ? `${theme.primary}99` : theme.primary,
                    },
                  ]}
                />
              </View>
              <ThemedText
                type="small"
                themeColor={isCurrent ? 'text' : 'textSecondary'}
                style={styles.monthLabel}>
                {formatMonthLabel(point.month)}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        Daily habits count goal-met days; weekly habits count progress toward their weekly goal. This
        month is still in progress.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  headerText: {
    gap: Spacing.one,
  },
  summary: {
    // Drops under the range label when the card is too narrow.
    marginLeft: 'auto',
  },
  chart: {
    flexDirection: 'row',
    gap: Spacing.one,
    height: 140,
  },
  column: {
    flex: 1,
    alignItems: 'stretch',
    gap: Spacing.one,
  },
  valueLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    borderRadius: Spacing.one,
  },
  monthLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
