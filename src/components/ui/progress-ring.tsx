import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Motion } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A round progress ring that sweeps to `progress` (0–1). The fastest way to
 * say "how far along" without words — used for training, the fuel cycle and
 * anywhere else a single ratio matters. Content sits in the middle.
 */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track,
  delay = 0,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
  delay?: number;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = useSharedValue(0);
  const target = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    shown.value = reduceMotion
      ? target
      : withDelay(delay, withTiming(target, { duration: Motion.duration.fill, easing: Easing.out(Easing.cubic) }));
  }, [target, reduceMotion, delay, shown]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.value),
    // A round cap on a zero-length arc still paints a dot — hide it at 0.
    strokeOpacity: shown.value < 0.004 ? 0 : 1,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arcProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
