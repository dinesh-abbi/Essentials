import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Viewfinder for camera screens: four thick rounded corners in the area's
 * hue that gently breathe, and a scan line sweeping top to bottom. Purely
 * decorative — centre it over a CameraView with pointerEvents="none".
 */
export function ScanFrame({ size = 250, color }: { size?: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    sweep.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    breathe.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );
  }, [reduceMotion, sweep, breathe]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * (size - 6) }] }));
  const frameStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.025 }] }));

  const corner = { borderColor: color, width: 44, height: 44 };
  return (
    <Animated.View style={[{ width: size, height: size }, frameStyle]} pointerEvents="none">
      <View style={[styles.corner, styles.tl, corner]} />
      <View style={[styles.corner, styles.tr, corner]} />
      <View style={[styles.corner, styles.bl, corner]} />
      <View style={[styles.corner, styles.br, corner]} />
      {!reduceMotion && <Animated.View style={[styles.line, { backgroundColor: color, shadowColor: color }, lineStyle]} />}
    </Animated.View>
  );
}

const W = 6;
const R = 22;
const styles = StyleSheet.create({
  corner: { position: 'absolute' },
  tl: { top: 0, left: 0, borderTopWidth: W, borderLeftWidth: W, borderTopLeftRadius: R },
  tr: { top: 0, right: 0, borderTopWidth: W, borderRightWidth: W, borderTopRightRadius: R },
  bl: { bottom: 0, left: 0, borderBottomWidth: W, borderLeftWidth: W, borderBottomLeftRadius: R },
  br: { bottom: 0, right: 0, borderBottomWidth: W, borderRightWidth: W, borderBottomRightRadius: R },
  line: { position: 'absolute', left: 16, right: 16, top: 0, height: 4, borderRadius: 2, opacity: 0.85, elevation: 6 },
});
