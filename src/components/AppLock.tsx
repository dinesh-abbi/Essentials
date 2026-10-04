import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

import { ChunkyButton } from '@/components/ui/chunky';
import { Colors, Hue, Spacing, Type } from '@/constants/theme';

const C = Colors.dark;

/**
 * Whole-app biometric lock, opt-in from Profile. Rendered by the root layout
 * above the navigator on a cold start and after the app has been in the
 * background longer than the grace period. Prompts on mount; if the device
 * has no enrolled biometrics it lets the user through rather than locking
 * them out of their own data.
 */
export function AppLock({ onUnlock }: { onUnlock: () => void }) {
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ring = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    ring.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 0 })), -1);
  }, [reduceMotion, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.6 }] }));

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const [hasHardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hasHardware || !enrolled) {
        onUnlock();
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Essentials', fallbackLabel: 'Use passcode', disableDeviceFallback: false });
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

  const tint = error ? C.alert : Hue.profile.main;

  return (
    <Animated.View exiting={reduceMotion ? undefined : FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: C.bg }]}>
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, { borderColor: tint }, ringStyle]} />
        <View style={[styles.badge, { backgroundColor: tint }]}>
          <MaterialCommunityIcons name={error ? 'fingerprint-off' : 'fingerprint'} size={56} color={C.onAccent} />
        </View>
      </View>
      <Text style={[Type.largeTitle, { color: C.textHi }]}>Locked</Text>
      <Text style={[Type.body, styles.sub, { color: error ? C.alert : C.textMid }]}>{error ?? 'Touch the sensor to come in.'}</Text>
      <ChunkyButton label={busy ? 'Waiting…' : 'Unlock'} icon="lock-open-variant" hue="profile" onPress={unlock} disabled={busy} style={styles.button} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  stage: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  ring: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 3 },
  badge: { width: 112, height: 112, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  sub: { marginTop: Spacing.two, textAlign: 'center' },
  button: { marginTop: Spacing.five, minWidth: 220 },
});
