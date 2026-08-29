import React from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, useReducedMotion } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export type HapticStyle = 'light' | 'medium' | 'selection';

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Fire a haptic on press-in. Off by default so existing call sites are
   * unchanged — buzzing every tap in the app would be noise, not feedback.
   */
  haptic?: HapticStyle;
  /** Press-in scale. */
  pressScale?: number;
  /** Press-in opacity. Omit for no opacity change (the previous behaviour). */
  pressOpacity?: number;
}

const IMPACT: Record<HapticStyle, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  selection: () => Haptics.selectionAsync(),
};

export function AnimatedPressable({
  children,
  style,
  haptic,
  pressScale = 0.96,
  pressOpacity,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = (e: any) => {
    // Haptics are physical feedback, not motion — they stay on under
    // "Reduce Motion" (that setting is about vestibular comfort, not touch).
    if (haptic) IMPACT[haptic]().catch(() => {});
    if (!reduceMotion) {
      scale.value = withSpring(pressScale, Motion.spring);
      if (pressOpacity !== undefined) {
        opacity.value = withTiming(pressOpacity, { duration: Motion.duration.fast });
      }
    }
    props.onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    if (!reduceMotion) {
      scale.value = withSpring(1, Motion.spring);
      if (pressOpacity !== undefined) {
        opacity.value = withTiming(1, { duration: Motion.duration.fast });
      }
    }
    props.onPressOut?.(e);
  };

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}
