import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { user, signOut } = useSession();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const firstName = user?.name.trim().split(' ')[0] ?? 'there';
  const memberSince = user ? new Date(user.createdAt).toLocaleDateString() : null;

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Clearing the session makes the (app) group unavailable, so the guard
      // in the root layout sends the user back to the login screen.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webContent]}>
        <ThemedView style={styles.inner}>
          <ThemedView style={styles.header}>
            <ThemedView style={styles.greeting}>
              <ThemedText type="subtitle">Welcome back, {firstName}</ThemedText>
              <ThemedText themeColor="textSecondary">
                You&apos;re signed in as {user?.email}
              </ThemedText>
            </ThemedView>

            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              onPress={onSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                { borderColor: theme.danger },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                themeColor={signingOut ? 'textSecondary' : 'danger'}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Your account
            </ThemedText>
            <HintRow title="Name" hint={<ThemedText>{user?.name ?? '—'}</ThemedText>} />
            <HintRow title="Email" hint={<ThemedText>{user?.email ?? '—'}</ThemedText>} />
            <HintRow
              title="Member since"
              hint={<ThemedText>{memberSince ?? '—'}</ThemedText>}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Today
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your habit list will live here. Signed-in state is persisted with
              <ThemedText type="code"> expo-secure-store</ThemedText> on device and local
              storage on web, so you stay logged in between launches.
            </ThemedText>
          </ThemedView>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    gap: Spacing.one,
    flexShrink: 1,
  },
  signOutButton: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  cardTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
