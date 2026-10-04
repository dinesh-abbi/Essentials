import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

/**
 * The house entrance: fade + translateY(10 → 0), ease-out, staggered by
 * `index`. Same curve and numbers as Home's local EntranceView so the new
 * Train / Fuel screens arrive with the identical rhythm. Under
 * Reduce Motion it renders in place with no animation.
 */
export function EntranceView({
  index = 0,
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : Motion.entranceOffset);

  useEffect(() => {
    if (reduceMotion) return;
    const delay = index * 70;
    const config = { duration: Motion.duration.entrance, easing: Easing.out(Easing.cubic) };
    opacity.value = withDelay(delay, withTiming(1, config));
    // Rises with a soft spring so blocks settle rather than slide.
    translateY.value = withDelay(delay, withSpring(0, Motion.softSpring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
