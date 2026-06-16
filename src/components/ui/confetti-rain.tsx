import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  withSequence,
} from 'react-native-reanimated';

const PARTICLE_COUNT = 30;
// Vibrant palette: blue, cyan, purple, gold, pink, green, orange
const COLORS = [
  '#38BDF8', // Sky Blue
  '#60A5FA', // Cool Blue
  '#3B82F6', // Primary Blue
  '#A78BFA', // Purple
  '#F472B6', // Pink
  '#FBBF24', // Gold
  '#34D399', // Mint Green
  '#F97316', // Orange
];

function Particle({ index }: { index: number }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  const isRain = index % 3 === 0; // Staggered rain (1/3) vs confetti shapes (2/3)
  const size = Math.random() * 6 + (isRain ? 4 : 6);
  const height = isRain ? size * 2.2 : size; // Droplets are elongated
  const color = COLORS[index % COLORS.length];

  const startX = Math.random() * 100; // Left offset percentage
  const delay = Math.random() * 1800; // Staggered entry delay
  const duration = Math.random() * 2500 + 2000; // 2s to 4.5s fall time
  const drift = (Math.random() - 0.5) * 30; // Side-to-side wind drift
  const rotateSpeed = Math.random() * 360 + 180;

  useEffect(() => {
    // Reset starting state
    translateY.value = -30;
    translateX.value = 0;
    rotate.value = 0;
    opacity.value = 0;

    // Fade in initially
    opacity.value = withDelay(delay, withTiming(0.85, { duration: 300 }));

    // Fall down continuously inside the card height (around 162px)
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(180, { duration, easing: Easing.linear }),
        -1,
        false
      )
    );

    // Drifting back and forth
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(drift, { duration: duration * 0.5, easing: Easing.inOut(Easing.quad) }),
          withTiming(-drift, { duration: duration * 0.5, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    // Rotation (confetti only, rain doesn't rotate as much)
    if (!isRain) {
      rotate.value = withDelay(
        delay,
        withRepeat(
          withTiming(rotateSpeed, { duration: duration * 0.8, easing: Easing.linear }),
          -1,
          false
        )
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { rotate: isRain ? '0deg' : `${rotate.value}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${startX}%`,
          width: size,
          height: height,
          backgroundColor: color,
          borderRadius: isRain ? size / 2 : Math.random() > 0.4 ? size / 2 : 2,
        },
        animatedStyle,
      ]}
    />
  );
}

export function ConfettiRain({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <Particle key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});
