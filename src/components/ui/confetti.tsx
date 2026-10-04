import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Hue } from '@/constants/theme';

const COLORS = [Hue.water.main, Hue.train.main, Hue.fuel.main, Hue.spend.main, Hue.checkin.main, Hue.alarm.main];

// Fixed pseudo-random layout so renders are deterministic.
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 37) % 100) / 100,
  delay: (i * 173) % 1400,
  duration: 2600 + ((i * 97) % 1600),
  size: 7 + ((i * 13) % 7),
  round: i % 3 === 0,
  spin: i % 2 === 0 ? 1 : -1,
  color: COLORS[i % COLORS.length],
}));

/** Falling, spinning confetti in every hue — for goals hit and workouts done. */
export function Confetti({ loop = true }: { loop?: boolean }) {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  if (reduceMotion) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PIECES.map((p, i) => (
        <Piece key={i} {...p} width={width} height={height} loop={loop} />
      ))}
    </View>
  );
}

function Piece({
  x,
  delay,
  duration,
  size,
  round,
  spin,
  color,
  width,
  height,
  loop,
}: (typeof PIECES)[number] & { width: number; height: number; loop: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const fall = withTiming(1, { duration, easing: Easing.in(Easing.quad) });
    t.value = withDelay(delay, loop ? withRepeat(fall, -1, false) : fall);
  }, [delay, duration, loop, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 || t.value === 1 ? 0 : 1,
    transform: [
      { translateY: -40 + t.value * (height + 80) },
      { translateX: Math.sin(t.value * Math.PI * 3) * 18 },
      { rotate: `${spin * t.value * 720}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * width,
          top: 0,
          width: size,
          height: round ? size : size * 1.8,
          borderRadius: round ? size / 2 : 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
