import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

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
 * Shared shell for every screen inside the (app) group: a title matching the
 * tab name, an optional subtitle, and either real content or a placeholder
 * card describing what will live here.
 */
export function PageTemplate({ title, subtitle, placeholder, children }: PageTemplateProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webContent]}>
        <ThemedView style={styles.inner}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {subtitle ? (
              <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
            ) : null}
          </ThemedView>

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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: BottomTabInset + Spacing.four,
  },
  webContent: {
    paddingTop: Spacing.six,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
