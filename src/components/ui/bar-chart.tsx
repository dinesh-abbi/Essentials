import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Hue, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;

export interface Bar {
  label: string;
  value: number;
  /** Tiny label above the bar (e.g. "1.2L"). */
  caption?: string;
  /** Draw at full hue (e.g. today / goal met); others use the soft hue. */
  strong?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * Chunky rounded bars that spring up on mount — the shared chart for weekly
 * water, spend reports, etc. An optional dashed goal line marks a target.
 */
export function BarChart({
  bars,
  hue,
  height = 140,
  goal,
}: {
  bars: Bar[];
  hue: HueName;
  height?: number;
  goal?: number;
}) {
  const max = Math.max(goal ?? 0, ...bars.map((b) => b.value), 1) * 1.05;
  const goalY = goal ? (goal / max) * height : null;
  return (
    <View>
      <View style={[styles.plot, { height }]}>
        {goalY !== null && (
          <View style={[styles.goal, { bottom: goalY, borderColor: Hue[hue].main }]} pointerEvents="none" />
        )}
        {bars.map((b, i) => (
          <BarCol key={`${b.label}-${i}`} bar={b} index={i} max={max} height={height} hue={hue} />
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <Text
            key={`${b.label}-${i}`}
            style={[Type.dotLabel, styles.label, { color: b.selected ? Hue[hue].main : C.textMid }]}
            numberOfLines={1}
          >
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BarCol({ bar, index, max, height, hue }: { bar: Bar; index: number; max: number; height: number; hue: HueName }) {
  const reduceMotion = useReducedMotion();
  const h = useSharedValue(0);
  const target = bar.value > 0 ? Math.max(10, (bar.value / max) * height) : 8;

  useEffect(() => {
    h.value = reduceMotion ? target : withDelay(index * 50, withSpring(target, { damping: 14, stiffness: 140 }));
  }, [target, index, reduceMotion, h]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  const set = Hue[hue];
  const fill = bar.value === 0 ? C.surface2 : bar.strong ? set.main : set.soft;

  const body = (
    <>
      {bar.caption ? (
        <Text style={[Type.badge, styles.caption, { color: bar.strong || bar.selected ? C.textHi : C.textMid }]} numberOfLines={1}>
          {bar.caption}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.bar,
          { backgroundColor: fill },
          bar.selected && { borderWidth: 2, borderColor: C.textHi },
          style,
        ]}
      />
    </>
  );

  if (!bar.onPress) return <View style={styles.col}>{body}</View>;
  return (
    <AnimatedPressable onPress={bar.onPress} haptic="selection" pressScale={0.9} style={styles.col} accessibilityRole="button" accessibilityLabel={`${bar.label}: ${bar.caption ?? bar.value}`}>
      {body}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' },
  bar: { width: '78%', maxWidth: 34, borderRadius: 10 },
  caption: { fontSize: 10 },
  goal: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', opacity: 0.6 },
  labels: { flexDirection: 'row', gap: 8, marginTop: 8 },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
});
