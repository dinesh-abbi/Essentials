import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { FontFace, Motion, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Button label. Optional when the button is icon-only (pass `accessibilityLabel`). */
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner in the foreground color and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  icon?: FeatherName;
  iconPosition?: 'leading' | 'trailing';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

const SIZES: Record<ButtonSize, { height: number; paddingH: number; fontSize: number; radius: number; iconSize: number; gap: number }> = {
  sm: { height: 36, paddingH: 14, fontSize: 13, radius: Radius.sm + 1, iconSize: 15, gap: 6 },
  md: { height: 44, paddingH: 18, fontSize: 14, radius: Radius.md - 3, iconSize: 17, gap: 8 },
  lg: { height: 52, paddingH: 22, fontSize: 15, radius: Radius.md - 1, iconSize: 18, gap: 8 },
};

/**
 * The one button. Four variants × three sizes, with a shared spring press-scale
 * (gated by reduced-motion), a real loading/disabled/focus story, an accessible
 * role/state, and a guaranteed ≥44 dp tap target even at the 36 dp visual size.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'leading',
  fullWidth = false,
  style,
  textStyle,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dims = SIZES[size];

  // ── Variant → colors ───────────────────────────────────────────────────
  let backgroundColor: string = 'transparent';
  let foreground: string = theme.signal;
  let borderColor: string = 'transparent';

  switch (variant) {
    case 'primary':
      backgroundColor = theme.signal;
      foreground = theme.signalInk;
      break;
    case 'secondary':
      backgroundColor = theme.backgroundSelected;
      foreground = theme.text;
      borderColor = theme.border;
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      foreground = theme.signal;
      break;
    case 'destructive':
      backgroundColor = 'transparent';
      foreground = theme.alert;
      borderColor = theme.alert;
      break;
  }

  const handlePressIn = (e: any) => {
    if (!reduceMotion) {
      scale.value = withSpring(0.96, Motion.spring);
    }
    onPressIn?.(e);
  };
  const handlePressOut = (e: any) => {
    if (!reduceMotion) {
      scale.value = withSpring(1, Motion.spring);
    }
    onPressOut?.(e);
  };

  const icoNode = icon ? <Feather name={icon} size={dims.iconSize} color={foreground} /> : null;

  return (
    <AnimatedPressableBase
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      // Keep the tap target ≥ 44 dp even when the visual height is 36 (sm).
      hitSlop={dims.height < 44 ? (44 - dims.height) / 2 : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.base,
        {
          height: dims.height,
          paddingHorizontal: dims.paddingH,
          borderRadius: dims.radius,
          backgroundColor,
          borderColor,
          borderWidth: borderColor === 'transparent' ? 0 : 1,
          opacity: disabled ? 0.4 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      {/* Content stays in flow (transparent while loading) so width is stable. */}
      <View style={[styles.row, { gap: dims.gap, opacity: loading ? 0 : 1 }]}>
        {iconPosition === 'leading' ? icoNode : null}
        {children ??
          (title ? (
            <Text
              numberOfLines={1}
              style={[styles.label, { color: foreground, fontFamily: FontFace.regular, fontSize: dims.fontSize }, textStyle]}
            >
              {title}
            </Text>
          ) : null)}
        {iconPosition === 'trailing' ? icoNode : null}
      </View>

      {loading ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="small" color={foreground} />
        </View>
      ) : null}
    </AnimatedPressableBase>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFace.semibold,
    letterSpacing: 0.2,
  },
});

export default Button;
