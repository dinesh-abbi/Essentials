import React, { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: any;
  height?: any;
  borderRadius?: number;
  style?: any;
}

export default function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, {
        duration: 900,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
      }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const baseColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    return {
      backgroundColor: baseColor,
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width ?? '100%',
          height: height ?? 20,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
