import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, FontFace, Radius, Spacing, Type } from '@/constants/theme';

/**
 * Whole-app biometric lock (Catalyst's "shield"), opt-in from Profile.
 * Rendered by the root layout above the navigator on a cold start and after
 * the app has been in the background longer than the grace period. Prompts
 * on mount; if the device has no enrolled biometrics it lets the user
 * through rather than locking them out of their own data.
 */
export function AppLock({ onUnlock }: { onUnlock: () => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ring = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    ring.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
  }, [reduceMotion, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 0.5 }],
  }));

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !enrolled) {
        onUnlock();
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Essentials',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });
      if (res.success) onUnlock();
      else if (res.error !== 'user_cancel' && res.error !== 'system_cancel') setError('That didn’t match. Try again.');
    } catch {
      setError('Biometrics are unavailable right now.');
    } finally {
      setBusy(false);
    }
  }, [busy, onUnlock]);

  // Prompt once the overlay has painted, so the system sheet rises over the
  // lock screen rather than over a flash of the app underneath.
  useEffect(() => {
    const t = setTimeout(unlock, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View exiting={reduceMotion ? undefined : FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, { borderColor: error ? colors.alert : colors.water }, ringStyle]} />
        <View style={[styles.badge, { borderColor: error ? colors.alert : colors.hairline, backgroundColor: colors.surface }]}>
          <Feather name="lock" size={30} color={error ? colors.alert : colors.water} />
        </View>
      </View>
      <Text style={[styles.headline, { color: colors.textHi }]}>Locked</Text>
      <Text style={[Type.body, styles.sub, { color: error ? colors.alert : colors.textMid }]}>
        {error ?? 'Confirm it’s you to continue.'}
      </Text>
      <AnimatedPressable
        onPress={unlock}
        disabled={busy}
        haptic="medium"
        style={[styles.button, { backgroundColor: colors.water, opacity: busy ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Unlock with biometrics"
      >
        <Feather name="unlock" size={17} color={colors.onAccent} />
        <Text style={[Type.controlLabel, { color: colors.onAccent }]}>{busy ? 'Waiting…' : 'Unlock'}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  stage: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.five },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { fontFamily: FontFace.displayBold, fontSize: 44, lineHeight: 50, letterSpacing: -1.4 },
  sub: { marginTop: Spacing.two, textAlign: 'center' },
  button: {
    marginTop: Spacing.five,
    height: 56,
    minWidth: 200,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
