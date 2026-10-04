import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { Colors, Motion } from '@/constants/theme';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * A chunky donut chart — slices with small gaps and round ends, sweeping in
 * on mount. Content (a total, an icon) sits in the hole.
 */
export function Donut({
  size,
  stroke,
  slices,
  children,
}: {
  size: number;
  stroke: number;
  slices: { value: number; color: string }[];
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const gap = slices.length > 1 ? Math.min(stroke * 0.9, circ * 0.02) : 0;
  const sweep = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    sweep.value = 0;
    sweep.value = withTiming(1, { duration: Motion.duration.fill + 200, easing: Easing.out(Easing.cubic) });
  }, [total, slices.length, reduceMotion, sweep]);

  const groupProps = useAnimatedProps(() => ({ opacity: 0.2 + sweep.value * 0.8 }));

  let offset = 0;
  const arcs = total > 0
    ? slices.map((s, i) => {
        const len = (s.value / total) * circ;
        const arc = { key: i, color: s.color, dash: Math.max(0.1, len - gap), offset };
        offset += len;
        return arc;
      })
    : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={Colors.dark.surface2} strokeWidth={stroke} fill="none" />
        <AnimatedG animatedProps={groupProps}>
          {arcs.map((a) => (
            <Circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={a.color}
              strokeWidth={stroke}
              strokeLinecap={slices.length > 1 ? 'butt' : 'round'}
              fill="none"
              strokeDasharray={`${a.dash} ${circ}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </AnimatedG>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
