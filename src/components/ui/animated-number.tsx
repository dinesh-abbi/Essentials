import { useEffect } from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * A number that counts to its value on the UI thread (RN's <Text> has no
 * animatable text prop, so this drives a non-editable TextInput — the same
 * trick as Home's hydration hero). Pair with a `Type` style that carries
 * tabular figures so the width never jitters mid-count.
 */
export function AnimatedNumber({
  value,
  style,
  color,
  decimals = 0,
  height,
}: {
  value: number;
  style: TextStyle;
  color: string;
  decimals?: number;
  /** Fixed line box — prevents the TextInput's default padding from shifting baselines. */
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? value : 0);

  useEffect(() => {
    shown.value = reduceMotion
      ? value
      : withTiming(value, { duration: Motion.duration.count, easing: Easing.out(Easing.cubic) });
  }, [value, reduceMotion, shown]);

  const animatedProps = useAnimatedProps(() => {
    const factor = Math.pow(10, decimals);
    const n = Math.round(shown.value * factor) / factor;
    return { text: decimals > 0 ? n.toFixed(decimals) : `${Math.round(n)}` } as any;
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      accessible={false}
      importantForAccessibility="no"
      value={decimals > 0 ? value.toFixed(decimals) : `${value}`}
      animatedProps={animatedProps}
      style={[style, styles.input, { color }, height ? { height } : null]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
