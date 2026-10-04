import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Hue, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;
const DOTS: HueName[] = ['water', 'train', 'fuel', 'spend', 'checkin'];

/** Full-screen loader: a row of hue dots hopping in a wave, and one short line. */
export default function AppLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <View style={styles.row}>
        {DOTS.map((h, i) => (
          <Dot key={h} color={Hue[h].main} index={i} />
        ))}
      </View>
      {label ? <Text style={[Type.dotLabel, styles.label, { color: C.textMid }]}>{label}</Text> : null}
    </View>
  );
}

function Dot({ color, index }: { color: string; index: number }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    y.value = withDelay(
      index * 110,
      withRepeat(withSequence(withSpring(-14, { damping: 7, stiffness: 300 }), withSpring(0, { damping: 9 }), withTiming(0, { duration: 350 })), -1, false),
    );
  }, [index, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  row: { flexDirection: 'row', gap: 10, height: 40, alignItems: 'flex-end' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  label: { marginTop: 18 },
});
