import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** One category row in the stats breakdown. */
export type CategoryBreakdownItem = {
  /** Stable key for the category. */
  key: 'DAILY' | 'WEEKLY';
  /** Row label, e.g. "Daily habits". */
  label: string;
  /** Active habits in this category. */
  habitCount: number;
  /** Completions logged across the category. */
  completions: number;
  /** 0–1 share of all completions. */
  share: number;
};

type CategoryBreakdownProps = {
  items: CategoryBreakdownItem[];
  /** Completions across every category, used by the card's summary line. */
  totalCompletions: number;
};

/** Screen-reader description for one category row. */
function describeCategory(item: CategoryBreakdownItem): string {
  const percent = Math.round(item.share * 100);
  return `${item.label}: ${item.habitCount} ${
    item.habitCount === 1 ? 'habit' : 'habits'
  }, ${item.completions} ${item.completions === 1 ? 'completion' : 'completions'}, ${percent}% of total.`;
}

/**
 * How the user's completions split between daily and weekly habits. Each row
 * shows the category's habit count, completion count, and share of the total as
 * a progress bar; the two categories are tinted with the theme's primary and
 * secondary accents so they stay distinguishable in light and dark mode.
 */
export function CategoryBreakdown({ items, totalCompletions }: CategoryBreakdownProps) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">Category breakdown</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`${totalCompletions} ${totalCompletions === 1 ? 'completion' : 'completions'}`}
        </ThemedText>
      </View>

      {totalCompletions === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No completions yet. Check off a habit and its category will show up here.
        </ThemedText>
      ) : (
        <View style={styles.rows}>
          {items.map((item) => {
            const percent = Math.round(item.share * 100);
            const color = item.key === 'DAILY' ? theme.primary : theme.secondary;

            return (
              <View
                key={item.key}
                accessible
                accessibilityLabel={describeCategory(item)}
                style={styles.row}>
                <View style={styles.rowHeader}>
                  <View style={styles.labelGroup}>
                    <View style={[styles.swatch, { backgroundColor: color }]} />
                    <ThemedText type="smallBold">{item.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {`${item.habitCount} ${item.habitCount === 1 ? 'habit' : 'habits'}`}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">{`${percent}%`}</ThemedText>
                </View>

                <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                  <View
                    style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]}
                  />
                </View>

                <ThemedText type="small" themeColor="textSecondary">
                  {`${item.completions} ${
                    item.completions === 1 ? 'completion' : 'completions'
                  }`}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  rows: {
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.one,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  labelGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
