import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/use-theme';

/**
 * AppLoader — branded full-screen loading overlay.
 *
 * Replaces raw <ActivityIndicator> throughout the app with a
 * premium pulsing animation tied to the app's primary colour.
 */
export default function AppLoader({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();

  // Outer ring pulse
  const outerScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.3);

  // Inner dot breathe
  const innerScale = useSharedValue(0.85);

  useEffect(() => {
    outerScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    outerOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 900 }),
        withTiming(0.3, { duration: 600 }),
      ),
      -1,
      false,
    );
    innerScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(0.85, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Pulsing outer ring */}
      <Animated.View
        style={[
          styles.outerRing,
          outerStyle,
          { borderColor: theme.primary },
        ]}
      />
      {/* Inner filled dot */}
      <Animated.View
        style={[
          styles.innerDot,
          innerStyle,
          { backgroundColor: theme.primary },
        ]}
      />
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const DOT = 18;
const RING = 48;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  outerRing: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
  },
  innerDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  label: {
    marginTop: 36,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
