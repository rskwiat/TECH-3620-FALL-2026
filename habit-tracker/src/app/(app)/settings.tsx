import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { exportAccountData } from '@/api';
import { HintRow } from '@/components/hint-row';
import { PageTemplate } from '@/components/page-template';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/**
 * Hands the CSV to the user: a real file download on web, and the OS share
 * sheet on native (the POC API also logs the export server-side).
 */
async function saveCsv(csv: string) {
  const filename = `habit-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    // Safari needs the link in the document before it can be clicked.
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({ title: filename, message: csv });
}

/** Everything account-related lives here: profile details, data controls, and signing out. */
export default function SettingsScreen() {
  const { session, user, signOut, deleteAccount } = useSession();
  const theme = useTheme();

  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const onExport = async () => {
    if (!session || exporting) return;
    setExporting(true);
    setExportNote(null);
    try {
      const csv = await exportAccountData(session.token);
      await saveCsv(csv);
      setExportNote({ tone: 'success', message: 'Your CSV export is ready.' });
    } catch (error) {
      setExportNote({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not export your data.',
      });
    } finally {
      setExporting(false);
    }
  };

  const onDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // On success the local session is cleared, so the root layout redirects
      // to the login screen; keep `deleting` set until this screen unmounts.
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Could not delete your account.',
      );
      setDeleting(false);
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
          Data &amp; privacy
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Download a copy of your habits and completion history as a CSV file.
        </ThemedText>

        <View style={styles.selfStart}>
          <Button
            label={exporting ? 'Preparing export…' : 'Export as CSV'}
            type="secondary"
            variant="outline"
            size="small"
            loading={exporting}
            disabled={!session}
            onPress={onExport}
          />
        </View>

        {exportNote ? (
          <ThemedText type="small" themeColor={exportNote.tone}>
            {exportNote.message}
          </ThemedText>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="small" themeColor="textSecondary">
          Deleting your account permanently removes your profile, habits, and history.
          This can&apos;t be undone.
        </ThemedText>

        {confirmingDelete ? (
          <View style={styles.confirmRow}>
            <Button
              label="Cancel"
              type="secondary"
              variant="outline"
              size="small"
              disabled={deleting}
              onPress={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
            />
            <Button
              label={deleting ? 'Deleting…' : 'Delete my account'}
              type="danger"
              size="small"
              loading={deleting}
              onPress={onDeleteAccount}
            />
          </View>
        ) : (
          <View style={styles.selfStart}>
            <Button
              label="Delete account"
              type="danger"
              variant="outline"
              size="small"
              disabled={!session}
              onPress={() => setConfirmingDelete(true)}
            />
          </View>
        )}

        {deleteError ? (
          <ThemedText type="small" themeColor="danger">
            {deleteError}
          </ThemedText>
        ) : null}
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

        <View style={styles.selfStart}>
          <Button
            label={signingOut ? 'Signing out…' : 'Sign out'}
            type="danger"
            variant="outline"
            size="small"
            loading={signingOut}
            onPress={onSignOut}
          />
        </View>
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
  selfStart: {
    alignSelf: 'flex-start',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  confirmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
});
