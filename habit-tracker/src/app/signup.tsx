import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Name, email and password are required');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Email is not valid');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      // On success the session changes and the guard in the root layout
      // redirects away from this screen to the authenticated app.
      await signUp({ name: trimmedName, email: trimmedEmail, password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            />

            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
            />

            <FormField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your password"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
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
      </KeyboardAvoidingView>
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
