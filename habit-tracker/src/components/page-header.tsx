import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

type PageHeaderProps = {
  /** Page title — keep it identical to the tab's label on tab screens. */
  title: string;
  /** Optional one-liner shown underneath the title. */
  subtitle?: string;
  /** Renders a back button before the title. Used on nested (stack) pages. */
  showBack?: boolean;
  /** Custom back handler. Defaults to `router.back()`. */
  onBack?: () => void;
};

/** First letters of the user's first and last name, for the avatar. */
function initialsFor(name: string | null | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * The top bar shared by every signed-in screen: the page title (with an
 * optional subtitle), the signed-in user's avatar, and a back button on
 * nested pages such as `/habit/[id]`.
 */
export function PageHeader({ title, subtitle, showBack = false, onBack }: PageHeaderProps) {
  const { user } = useSession();
  const router = useRouter();
  const theme = useTheme();

  const goBack =
    onBack ??
    (() => {
      // Deep links can open a nested screen with no history to pop.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    });

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.titles}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>

        <View
          accessibilityRole="image"
          accessibilityLabel={user ? `Signed in as ${user.name}` : 'Signed in'}
          style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.avatarText}>{initialsFor(user?.name)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  containerWeb: {
    paddingTop: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  titles: {
    flex: 1,
    gap: Spacing.half,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
});
