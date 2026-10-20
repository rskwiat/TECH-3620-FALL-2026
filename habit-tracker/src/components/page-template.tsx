import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeader } from './page-header';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PageTemplateProps = {
  /** Page title — keep it identical to the tab's label. */
  title: string;
  /** Optional one-liner shown underneath the title. */
  subtitle?: string;
  /** Copy for the placeholder card when no `children` are supplied. */
  placeholder?: string;
  children?: ReactNode;
};

/**
 * Shared shell for every screen inside the (app) group: the shared page header
 * (title matching the tab name, avatar, optional subtitle) and either real
 * content or a placeholder card describing what will live here.
 */
export function PageTemplate({ title, subtitle, placeholder, children }: PageTemplateProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}>
      <PageHeader title={title} subtitle={subtitle} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ThemedView style={styles.inner}>
          {children ?? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {placeholder ?? `${title} content will live here.`}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
