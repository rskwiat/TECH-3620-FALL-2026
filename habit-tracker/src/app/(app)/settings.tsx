import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { HintRow } from '@/components/hint-row';
import { PageTemplate } from '@/components/page-template';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/** Everything account-related lives here: profile details and signing out. */
export default function SettingsScreen() {
  const { user, signOut } = useSession();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);

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
    <PageTemplate title="Settings" subtitle="Your account and sign-in options.">
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
          Session
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You&apos;re signed in as <ThemedText type="code">{user?.email ?? '—'}</ThemedText>.
          Your session is persisted with <ThemedText type="code">expo-secure-store</ThemedText>{' '}
          on device and local storage on web, so you stay logged in between launches.
        </ThemedText>

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
    </PageTemplate>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  cardTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
