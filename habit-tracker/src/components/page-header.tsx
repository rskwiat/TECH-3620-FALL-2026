import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';

type PageHeaderProps = {
  /** Page title — keep it identical to the tab's label. */
  title: string;
  /** Trailing content pinned to the right of the title (page actions, a back button). */
  actions?: ReactNode;
};

/** Up-to-two-letter monogram for the avatar, built from the user's name (or email). */
function initialsFor(name: string | null, email: string | null): string {
  const source = (name ?? email ?? '').trim();
  if (!source) return '·';
  const initials = source
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '');
  return initials.join('') || '·';
}

/**
 * The shared header every screen renders, pinned to the top of the page: the
 * signed-in user's avatar and the page title sit side by side on one line, with
 * optional trailing `actions` (Today's "+ New Habit", the detail screen's back
 * button) on the right. It draws only the header block — no safe-area inset and
 * no subtitle — so each screen keeps its own scroll container underneath.
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  const { user } = useSession();

  const initials = initialsFor(user?.name ?? null, user?.email ?? null);

  return (
    <View style={[styles.header, Platform.OS === 'web' && styles.headerWeb]}>
      <ThemedView
        type="primary"
        accessibilityRole="image"
        accessibilityLabel={user?.name ? `${user.name}'s avatar` : 'Your avatar'}
        style={styles.avatar}>
        <ThemedText style={styles.avatarText}>{initials}</ThemedText>
      </ThemedView>

      <ThemedText type="subtitle" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    // Avatar and title share one line; page actions hang off the right edge.
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerWeb: {
    paddingTop: Spacing.six,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    // White matches the filled Button label color for readable contrast on `primary`.
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    // Pushes any trailing actions out to the right edge.
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
