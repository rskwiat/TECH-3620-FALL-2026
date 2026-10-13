import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { FormField } from './form-field';
import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import type { NewHabitInput } from '@/api';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NewHabitModalProps = {
  /** Toggles the sheet; `false` slides it away without losing the draft. */
  visible: boolean;
  /** Closes the sheet (backdrop tap, Cancel, or hardware back on Android). */
  onClose: () => void;
  /**
   * Creates the habit — reject to show the message inside the sheet, resolve
   * to close it. The parent owns this so it can refresh the Today list.
   */
  onCreate: (input: NewHabitInput) => Promise<void>;
};

type Draft = {
  name: string;
  description: string;
  emoji: string;
  frequency: 'DAILY' | 'WEEKLY';
  timesPerPeriod: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  emoji: '',
  frequency: 'DAILY',
  timesPerPeriod: '1',
};

/** Bottom sheet built on React Native's `Modal` for creating one habit. */
export function NewHabitModal({ visible, onClose, onCreate }: NewHabitModalProps) {
  const theme = useTheme();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setError(null);
    onClose();
  };

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);

    const name = draft.name.trim();
    if (!name) {
      setError('Give your habit a name');
      return;
    }

    // An empty field means "once per period" — the API default.
    const times = draft.timesPerPeriod.trim() === '' ? 1 : Number(draft.timesPerPeriod.trim());
    if (!Number.isInteger(times) || times < 1) {
      setError('Times per period must be a positive number');
      return;
    }

    const input: NewHabitInput = { name, frequency: draft.frequency, timesPerPeriod: times };
    const description = draft.description.trim();
    const emoji = draft.emoji.trim();
    if (description) input.description = description;
    if (emoji) input.emoji = emoji;

    setSubmitting(true);
    try {
      await onCreate(input);
      // Only a successful save clears the draft — backing out keeps it.
      setDraft(EMPTY_DRAFT);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the habit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Tap outside the sheet to dismiss it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close new habit form"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />

        <ThemedView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              New habit
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={close}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}

          <FormField
            label="Name"
            value={draft.name}
            onChangeText={(name) => setDraft((prev) => ({ ...prev, name }))}
            placeholder="e.g. Drink Water"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          <FormField
            label="Emoji"
            value={draft.emoji}
            onChangeText={(emoji) => setDraft((prev) => ({ ...prev, emoji }))}
            placeholder="💧"
            maxLength={16}
          />
          <FormField
            label="Description"
            value={draft.description}
            onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))}
            placeholder="Optional — how you'll do it"
            multiline
          />

          <View style={styles.group}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Frequency
            </ThemedText>
            <View style={styles.frequencyRow}>
              {(['DAILY', 'WEEKLY'] as const).map((value) => {
                const selected = draft.frequency === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setDraft((prev) => ({ ...prev, frequency: value }))}
                    style={({ pressed }) => [
                      styles.frequencyOption,
                      { backgroundColor: selected ? theme.primary : theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: selected ? '#ffffff' : theme.text }}>
                      {value === 'DAILY' ? 'Daily' : 'Weekly'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <FormField
            label={draft.frequency === 'DAILY' ? 'Times per day' : 'Times per week'}
            value={draft.timesPerPeriod}
            onChangeText={(timesPerPeriod) => setDraft((prev) => ({ ...prev, timesPerPeriod }))}
            placeholder="1"
            keyboardType="number-pad"
          />

          <PrimaryButton label="Add habit" onPress={onSubmit} loading={submitting} />
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    // Clear the home indicator / gesture bar on the modal's last control.
    paddingBottom: BottomTabInset + Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 32,
  },
  group: {
    gap: Spacing.two,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  frequencyOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
