import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';

export default function SignupScreen() {
  const { signUp } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      setError('Name and email are required');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Email is not valid');
      return;
    }

    setSubmitting(true);
    try {
      // On success the session changes and the guard in the root layout
      // redirects away from this screen to the authenticated app.
      await signUp({ name: trimmedName, email: trimmedEmail });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.card}>
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                Create account
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Start building habits in a couple of taps.
              </ThemedText>
            </ThemedView>

            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}

            <FormField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Jane Doe"
              textContentType="name"
              autoComplete="name"
              autoCapitalize="words"
            />

            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            <PrimaryButton label="Sign up" onPress={onSubmit} loading={submitting} />

            <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
              Already have an account?{' '}
              <Link href="/login" replace>
                <ThemedText type="smallBold" themeColor="primary">
                  Sign in
                </ThemedText>
              </Link>
            </ThemedText>
          </ThemedView>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth / 2,
    width: '100%',
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
  },
  footerText: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
