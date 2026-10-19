import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Color family used for the button's fill/border and label. */
export type ButtonType = 'primary' | 'secondary' | 'danger' | 'success' | 'accent';

/** Visual treatment: solid background or transparent with a colored border. */
export type ButtonVariant = 'filled' | 'outline';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** Color family for the button. Defaults to `primary`. */
  type?: ButtonType;
  /** Filled or outlined treatment. Defaults to `filled`. */
  variant?: ButtonVariant;
  /** Element rendered before the label (for example, an icon). */
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

/** The themed call-to-action button, scalable across color types and filled/outline variants. */
export function Button({
  label,
  onPress,
  type = 'primary',
  variant = 'filled',
  icon,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const color = theme[type];
  const isFilled = variant === 'filled';
  const contentColor = isFilled ? '#ffffff' : color;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.button,
            isFilled
              ? { backgroundColor: color }
              : { backgroundColor: pressed ? `${color}1A` : 'transparent', borderColor: color, borderWidth: 1 },
            { opacity: isDisabled ? 0.6 : pressed && isFilled ? 0.8 : 1 },
          ]}>
          {loading ? (
            <ActivityIndicator color={contentColor} />
          ) : (
            <View style={styles.content}>
              {icon ? <View>{icon}</View> : null}
              <ThemedText type="smallBold" style={[styles.label, { color: contentColor }]}>
                {label}
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: 16,
  },
});
