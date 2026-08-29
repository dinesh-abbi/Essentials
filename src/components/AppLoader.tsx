import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/use-theme';
import { FontFace } from '@/constants/theme';

/**
 * AppLoader — elegant, clean, and simple minimalist loading spinner.
 */
export default function AppLoader({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.spinnerContainer}>
        {/* Simple elegant spinning ring */}
        <Animated.View
          style={[
            styles.spinner,
            spinnerStyle,
            {
              borderWidth: 3,
              borderColor: theme.primary,
              borderTopColor: 'transparent',
            },
          ]}
        />
      </View>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const SPINNER_SIZE = 36;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  spinnerContainer: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    borderRadius: SPINNER_SIZE / 2,
  },
  label: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: FontFace.semibold,
    letterSpacing: 0.5,
  },
});
