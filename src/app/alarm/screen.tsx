import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  NativeModules,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFace, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';

const { AlarmScheduler } = NativeModules;

export default function ActiveAlarmScreen() {
  const router = useRouter();
  const theme = useTheme();

  // ── States ─────────────────────────────────────────────────────────────────
  const [targetBarcode, setTargetBarcode] = useState<string | null>(null);
  const [timeString, setTimeString] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Shared reanimated value for shake animation on wrong barcode
  const shakeOffset = useSharedValue(0);

  // ── Handlers & Effects ─────────────────────────────────────────────────────

  // Lock back handler on RN side as well
  useEffect(() => {
    const onBackPress = () => {
      // Return true to prevent default back action
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  // Load configured barcode
  useEffect(() => {
    async function loadConfig() {
      const config = await BarcodeAlarmStorage.getAlarmConfig();
      if (config && config.barcodePayload) {
        setTargetBarcode(config.barcodePayload);
      } else {
        // Fallback: if no config is stored but the alarm somehow fired,
        // allow dismissing using any scan or a default string.
        console.warn('Alarm fired but no target barcode payload registered!');
      }
    }
    loadConfig();
  }, []);

  // Ticking clock display
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minStr = minutes < 10 ? '0' + minutes : minutes;
      setTimeString(`${hours}:${minStr} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 60-second auto-snooze countdown sync
  useEffect(() => {
    if (secondsRemaining <= 0) {
      // The native service will trigger auto-snooze on its own, but we
      // sync the JS router state to redirect the user back to home
      router.replace('/(tabs)');
      return;
    }
    const timer = setTimeout(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  // Barcode scanned callback
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!data) return;

    if (targetBarcode && data.trim() !== targetBarcode.trim()) {
      // Wrong barcode — trigger shake animation and error message
      setErrorMsg(`Incorrect barcode (Scanned: ${data.length > 15 ? data.substring(0, 15) + '...' : data})`);
      shakeOffset.value = withSequence(
        withTiming(-15, { duration: 50 }),
        withTiming(15, { duration: 50 }),
        withTiming(-15, { duration: 50 }),
        withTiming(15, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }

    // Match or fallback success!
    try {
      if (AlarmScheduler) {
        // Sends dismiss broadcast to stop Service & AlarmScreenActivity
        await AlarmScheduler.dismissAlarm();
      }
      // Redirect React Native router back to Dashboard
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Failed to dismiss alarm natively:', err);
      Alert.alert('Dismiss Failed', 'Failed to stop native alarm, try closing the app.');
      router.replace('/(tabs)');
    }
  };

  // Reanimated style for error shake
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeOffset.value }],
    };
  });

  if (!permission) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  // If camera permission isn't granted, show action button to request it
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <View style={{ alignItems: 'center', padding: Spacing.five }}>
          <ThemedText type="subtitle" style={{ marginBottom: Spacing.two }}>
            Camera Required
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: Spacing.four }}>
            Camera permission must be enabled to scan the barcode and dismiss this alarm!
          </ThemedText>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.primary }]}
            onPress={requestPermission}
          >
            <Text style={{ color: '#FFF', fontFamily: FontFace.bold }}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#000' }]}>
      {/* Background Camera View */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Foreground Dimmed HUD Overlay */}
      <View style={styles.hudOverlay} pointerEvents="none">
        <View style={styles.dimmedBg} />
        <View style={styles.centerRow}>
          <View style={styles.dimmedBg} />
          <View style={styles.focusFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.dimmedBg} />
        </View>
        <View style={styles.dimmedBg} />
      </View>

      {/* Top Interface Info */}
      <View style={styles.header}>
        <ThemedText style={styles.clockText}>{timeString}</ThemedText>
        <ThemedText style={styles.statusText}>⏰ BARCODE ALARM ACTIVE</ThemedText>
      </View>

      {/* Bottom Controls / Status */}
      <View style={styles.footer}>
        <Animated.View style={[styles.shakeWrapper, animatedStyle]}>
          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : (
            <Text style={styles.promptText}>Scan physical barcode to dismiss</Text>
          )}
        </Animated.View>

        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>
            Auto-snooze in <Text style={{ fontFamily: FontFace.bold, color: theme.primary }}>{secondsRemaining}s</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 8,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  clockText: {
    fontSize: 48,
    fontFamily: FontFace.bold,
    color: '#FFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  statusText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: FontFace.bold,
    letterSpacing: 3,
    marginTop: Spacing.one,
    backgroundColor: '#DC2626',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
    borderRadius: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  shakeWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  promptText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: FontFace.bold,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    overflow: 'hidden',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 15,
    fontFamily: FontFace.bold,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderColor: '#FF4444',
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    overflow: 'hidden',
  },
  countdownContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 12,
  },
  countdownText: {
    color: '#DDD',
    fontSize: 13,
    fontFamily: FontFace.semibold,
  },
  // HUD Overlays
  hudOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  dimmedBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  centerRow: {
    flexDirection: 'row',
    height: 250,
  },
  focusFrame: {
    width: 250,
    height: 250,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
  },
});
