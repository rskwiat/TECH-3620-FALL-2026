import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Color family used for the button's fill/border and label. */
export type ButtonType = 'primary' | 'secondary' | 'danger' | 'success' | 'accent';

/** Visual treatment: solid background or transparent with a colored border. */
export type ButtonVariant = 'filled' | 'outline';

/** Padding, minimum height, and label scale. */
export type ButtonSize = 'small' | 'medium' | 'large';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** Color family for the button. Defaults to `primary`. */
  type?: ButtonType;
  /** Filled or outlined treatment. Defaults to `filled`. */
  variant?: ButtonVariant;
  /** Compact, default, or prominent sizing. Defaults to `medium`. */
  size?: ButtonSize;
  /** Element rendered before the label (for example, an icon). */
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

/** The themed call-to-action button, scalable across color types, variants, and sizes. */
export function Button({
  label,
  onPress,
  type = 'primary',
  variant = 'filled',
  size = 'medium',
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
            sizeStyles[size],
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
              <ThemedText
                type="smallBold"
                style={[labelStyles[size], { color: contentColor }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

const sizeStyles = StyleSheet.create({
  small: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    // Keep a 44pt touch target even with the tighter padding.
    minHeight: 44,
  },
  medium: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
  },
  large: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    minHeight: 56,
  },
});

const labelStyles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  medium: {
    fontSize: 16,
    lineHeight: 20,
  },
  large: {
    fontSize: 18,
    lineHeight: 24,
  },
});
