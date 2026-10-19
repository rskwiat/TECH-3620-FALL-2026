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

/** How many digits the one-time code contains — mirrors the API's `CODE_LENGTH`. */
const CODE_LENGTH = 6;

export default function LoginScreen() {
  const { requestCode, verifyCode } = useSession();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async () => {
    setSubmitting(true);
    try {
      await requestCode(email.trim());
      setCode('');
      setStep('code');
      setNotice(
        `If ${email.trim()} has an account, a ${CODE_LENGTH}-digit code was sent. ` +
          'For this demo, check the API server console.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitEmail = async () => {
    if (submitting) return;
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!trimmed.includes('@')) {
      setError('Email is not valid');
      return;
    }

    try {
      await sendCode();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the code');
    }
  };

  const onSubmitCode = async () => {
    if (submitting) return;
    setError(null);

    const trimmed = code.trim();
    if (trimmed.length !== CODE_LENGTH || !/^\d+$/.test(trimmed)) {
      setError(`Enter the ${CODE_LENGTH}-digit code`);
      return;
    }

    setSubmitting(true);
    try {
      // On success the session changes and the guard in the root layout
      // redirects away from this screen to the authenticated app.
      await verifyCode(email.trim(), trimmed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (submitting) return;
    setError(null);
    try {
      await sendCode();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resend the code');
    }
  };

  const onEditEmail = () => {
    if (submitting) return;
    setStep('email');
    setCode('');
    setNotice(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.card}>
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                {step === 'email' ? 'Welcome back' : 'Check your code'}
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {step === 'email'
                  ? 'Sign in to pick up your habits where you left off.'
                  : `We sent a code to ${email.trim()}.`}
              </ThemedText>
            </ThemedView>

            {notice && (
              <ThemedText type="small" themeColor="textSecondary">
                {notice}
              </ThemedText>
            )}

            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}

            {step === 'email' ? (
              <>
                <FormField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="go"
                  onSubmitEditing={onSubmitEmail}
                />

                <PrimaryButton label="Send code" onPress={onSubmitEmail} loading={submitting} />
              </>
            ) : (
              <>
                <FormField
                  label="Login code"
                  value={code}
                  onChangeText={setCode}
                  placeholder={'0'.repeat(CODE_LENGTH)}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={CODE_LENGTH}
                  returnKeyType="go"
                  onSubmitEditing={onSubmitCode}
                />

                <PrimaryButton label="Sign in" onPress={onSubmitCode} loading={submitting} />

                <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
                  <ThemedText type="smallBold" themeColor="primary" onPress={onResend}>
                    Resend code
                  </ThemedText>
                  {'  ·  '}
                  <ThemedText type="smallBold" themeColor="primary" onPress={onEditEmail}>
                    Use a different email
                  </ThemedText>
                </ThemedText>
              </>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
              Don&apos;t have an account?{' '}
              <Link href="/signup" replace>
                <ThemedText type="smallBold" themeColor="primary">
                  Sign up
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
