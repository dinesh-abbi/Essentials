import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, NativeModules, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigMessage } from '@/components/ui/big-message';
import { Chip, ChunkyButton } from '@/components/ui/chunky';
import { LiveDot } from '@/components/ui/dots';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ScanFrame } from '@/components/ui/scan-frame';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';

const { AlarmScheduler } = NativeModules;
const C = Colors.dark;
const P = Hue.alarm;
const SNOOZE_SECONDS = 60;

/**
 * The ringing alarm: a giant pulsing clock, a pink viewfinder, and a ring
 * counting down to the automatic snooze. Scan the registered barcode to stop
 * it; a wrong code shakes the prompt.
 */
export default function ActiveAlarmScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [target, setTarget] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [left, setLeft] = useState(SNOOZE_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const shake = useSharedValue(0);
  const pulse = useSharedValue(1);

  // The back button can't dismiss an alarm.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    BarcodeAlarmStorage.getAlarmConfig().then((config) => {
      if (config?.barcodePayload) setTarget(config.barcodePayload);
      else console.warn('Alarm fired but no target barcode payload registered!');
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 500 }), withTiming(1, { duration: 500 })), -1, false);
  }, [reduceMotion, pulse]);

  // 60-second auto-snooze: the native service snoozes on its own; JS follows.
  useEffect(() => {
    if (left <= 0) {
      router.replace('/(tabs)');
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, router]);

  const onScanned = async ({ data }: { data: string }) => {
    if (!data) return;
    if (target && data.trim() !== target.trim()) {
      setError(`Wrong code (${data.length > 15 ? data.substring(0, 15) + '…' : data})`);
      shake.value = withSequence(
        withTiming(-16, { duration: 50 }),
        withTiming(16, { duration: 50 }),
        withTiming(-16, { duration: 50 }),
        withTiming(16, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      return;
    }
    try {
      if (AlarmScheduler) await AlarmScheduler.dismissAlarm();
    } catch (err) {
      console.error('Failed to dismiss alarm natively:', err);
      Alert.alert('Couldn’t stop it', 'Try closing the app.');
    }
    router.replace('/(tabs)');
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={P.main} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: C.bg }]}>
        <BigMessage icon="alarm-light" hue="alarm" title="Camera needed" text="Scan your barcode to stop the alarm — allow the camera first.">
          <ChunkyButton label="Allow camera" icon="camera" hue="alarm" onPress={requestPermission} />
        </BigMessage>
      </SafeAreaView>
    );
  }

  const hm = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={onScanned}
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <ScanFrame color={P.main} />
      </View>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Chip icon="alarm-light" label="Alarm ringing" hue="alarm" solid />
          <Animated.View style={[styles.clockRow, pulseStyle]}>
            <Text style={[Type.dotHero, styles.clock]}>{hm}</Text>
            <Text style={[Type.dotSmall, { color: P.main }]}>{now.getHours() >= 12 ? 'PM' : 'AM'}</Text>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Animated.View style={[styles.prompt, { backgroundColor: error ? 'rgba(255,59,48,0.92)' : 'rgba(11,11,15,0.8)' }, shakeStyle]}>
            {!error && <LiveDot color={P.main} size={9} />}
            <Text style={[Type.controlLabel, { color: '#FFFFFF' }]}>{error ?? 'Scan your barcode to stop it'}</Text>
          </Animated.View>
          <View style={styles.snooze}>
            <ProgressRing size={64} stroke={7} progress={left / SNOOZE_SECONDS} color={P.main} track="rgba(255,255,255,0.15)">
              <Text style={[Type.dotSmall, { color: '#FFFFFF', fontSize: 18 }]}>{left}</Text>
            </ProgressRing>
            <Text style={[Type.subline, { color: '#FFFFFF' }]}>seconds until snooze</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, backgroundColor: '#000' },
  dim: { backgroundColor: 'rgba(0,0,0,0.35)' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  header: { alignItems: 'center', gap: 6, paddingTop: Spacing.five },
  clockRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  clock: { fontSize: 84, lineHeight: 92, color: '#FFFFFF' },
  footer: { alignItems: 'center', gap: 16, paddingBottom: Spacing.five, paddingHorizontal: Spacing.three },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.pill },
  snooze: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(11,11,15,0.7)', paddingRight: 18, paddingLeft: 6, paddingVertical: 6, borderRadius: Radius.pill },
});
