import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

/**
 * Nothing-style dotted progress: a row of round dots, the first `lit` filled
 * with `color`. Reads like a glyph/LED strip rather than a plain bar.
 */
export function DotMeter({
  total,
  lit,
  color,
  dim = Colors.dark.surface2,
  size = 8,
  gap = 5,
  stretch,
  style,
}: {
  total: number;
  lit: number;
  color: string;
  dim?: string;
  size?: number;
  gap?: number;
  /** Spread the dots across the full width instead of packing them. */
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, { gap: stretch ? 0 : gap }, stretch && styles.stretch, style]} accessible={false}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: i < lit ? color : dim }}
        />
      ))}
    </View>
  );
}

/** A small pulsing dot — "live" / "now" marker (Nothing's red recording dot). */
export function LiveDot({ color = Colors.dark.alert, size = 8 }: { color?: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    o.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, [reduceMotion, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stretch: { justifyContent: 'space-between', alignSelf: 'stretch' },
});
