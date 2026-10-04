import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, UploadType } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { BigMessage } from '@/components/ui/big-message';
import { Chip, ChunkyButton, IconBlob, type IconName } from '@/components/ui/chunky';
import { LiveDot } from '@/components/ui/dots';
import { ScanFrame } from '@/components/ui/scan-frame';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import * as AttendanceStorage from '@/utils/AttendanceStorage';

const C = Colors.dark;
const L = Hue.checkin;

/**
 * Check-in: a full-screen camera with a lavender viewfinder, a live clock,
 * and one huge shutter. The photo goes to your Discord channel; with no
 * signal it's kept on the phone and sent later.
 */
export default function AttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const cameraRef = useRef<CameraView>(null);
  const { discordWebhookUrl } = useAuth();
  const webhookUrl = discordWebhookUrl ?? '';

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [zoom, setZoom] = useState(0);
  const [lenses, setLenses] = useState<string[]>([]);
  const [lens, setLens] = useState<string | undefined>(undefined);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState<{ icon: IconName; text: string } | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    AttendanceStorage.getOfflineQueue().then((q) => setOfflineCount(q.length));
  }, []);

  // Quietly send anything waiting as soon as there's a webhook.
  useEffect(() => {
    if (offlineCount === 0 || !webhookUrl) return;
    AttendanceStorage.syncQueue(webhookUrl)
      .then(async (r) => {
        if (r.successCount > 0) setOfflineCount((await AttendanceStorage.getOfflineQueue()).length);
      })
      .catch((e) => console.log('Auto-sync failed:', e));
  }, [offlineCount, webhookUrl]);

  const flip = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setZoom(0);
    setLens(undefined);
  };

  const cycleZoom = () => {
    if (Platform.OS === 'ios' && lenses.length > 1) {
      const i = lens ? lenses.indexOf(lens) : 0;
      setLens(lenses[(i + 1) % lenses.length]);
    } else {
      setZoom((z) => (z === 0 ? 0.15 : z === 0.15 ? 0.3 : 0));
    }
  };

  const syncNow = async () => {
    if (!webhookUrl) {
      Alert.alert('Connect a channel first', 'Add your Discord webhook in Profile.');
      return;
    }
    setBusy({ icon: 'cloud-upload', text: 'Sending saved check-ins…' });
    try {
      const r = await AttendanceStorage.syncQueue(webhookUrl);
      setOfflineCount((await AttendanceStorage.getOfflineQueue()).length);
      Alert.alert('Done', `${r.successCount} sent${r.failCount ? `, ${r.failCount} still waiting` : ''}.`);
    } catch {
      Alert.alert('Couldn’t send', 'Try again when you have signal.');
    } finally {
      setBusy(null);
    }
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    if (!webhookUrl) {
      Alert.alert('Connect a channel first', 'Check-ins are posted to your Discord channel.', [
        { text: 'Set up', onPress: () => router.push('/discord') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    setBusy({ icon: 'camera-iris', text: 'Snap!' });
    const timestamp = Date.now();
    let uri: string | undefined;
    try {
      uri = (await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false }))?.uri;
      if (!uri) throw new Error('No photo');

      setBusy({ icon: 'send', text: 'Posting to Discord…' });
      const when = new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' }) + ' IST';
      const result = await new File(uri).upload(webhookUrl, {
        uploadType: UploadType.MULTIPART,
        fieldName: 'files[0]',
        mimeType: 'image/jpeg',
        parameters: { payload_json: JSON.stringify({ content: `📸 **Attendance Log Captured**\n**Captured at**: ${when}\n**Status**: Online Upload` }) },
      });
      if (result.status < 200 || result.status >= 300) throw new Error(`Upload returned ${result.status}`);

      await AttendanceStorage.saveLastCheckInTime(timestamp);
      setBusy(null);
      Alert.alert('Checked in!', `Posted at ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
      router.back();
    } catch {
      // No signal (or Discord said no): keep the photo and send it later.
      setBusy({ icon: 'content-save', text: 'Saving on your phone…' });
      try {
        const offlineUri = uri ?? (await cameraRef.current.takePictureAsync({ quality: 0.8 }))?.uri;
        if (!offlineUri) throw new Error('No photo to save');
        await AttendanceStorage.saveOfflineLog(offlineUri, timestamp);
        setOfflineCount((await AttendanceStorage.getOfflineQueue()).length);
        setBusy(null);
        Alert.alert('Saved for later', 'No connection right now — it’ll be sent automatically.', [{ text: 'OK', onPress: () => router.back() }]);
      } catch (e) {
        setBusy(null);
        Alert.alert('Couldn’t check in', 'The photo couldn’t be taken or saved.');
        console.error(e);
      }
    }
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={L.main} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: C.bg }]}>
        <BigMessage icon="camera" hue="checkin" title="Camera needed" text="Check-in takes a quick photo and posts it to your channel.">
          <ChunkyButton label="Allow camera" icon="camera" hue="checkin" onPress={requestPermission} />
          <ChunkyButton label="Go back" icon="arrow-left" variant="soft" hue="checkin" onPress={() => router.back()} />
        </BigMessage>
      </SafeAreaView>
    );
  }

  const zoomLabel = Platform.OS === 'ios' && lenses.length > 1 ? `L${lens ? lenses.indexOf(lens) + 1 : 1}` : zoom === 0 ? '1x' : zoom === 0.15 ? '2x' : '3x';

  return (
    <View style={styles.camera}>
      <CameraView
        ref={cameraRef}
        facing={facing}
        zoom={zoom}
        selectedLens={lens}
        onAvailableLensesChanged={(e) => e?.lenses && setLenses(e.lenses)}
        enableTorch={torch}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <ScanFrame size={260} color={L.main} />
      </View>

      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three }]} pointerEvents="box-none">
        {/* Top: back · live clock */}
        <View style={styles.top}>
          <ChunkyButton icon="arrow-left" variant="soft" hue="checkin" size="md" haptic="light" onPress={() => router.back()} accessibilityLabel="Back" />
          <View style={[styles.clock, styles.glass]}>
            <LiveDot color={webhookUrl ? L.main : C.alert} size={8} />
            <Text style={[Type.dotSmall, { color: '#FFFFFF' }]}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </View>
          <View style={styles.status} />
        </View>

        {offlineCount > 0 && (
          <AnimatedPressable onPress={syncNow} haptic="light" style={styles.banner} accessibilityRole="button" accessibilityLabel={`${offlineCount} check-ins waiting. Send now.`}>
            <Chip icon="cloud-upload" label={`${offlineCount} waiting · tap to send`} hue="spend" solid />
          </AnimatedPressable>
        )}

        <View style={styles.flexSpacer} />

        {/* Bottom dock */}
        <View style={[styles.dock, styles.glass]}>
          <ChunkyButton icon={torch ? 'flashlight' : 'flashlight-off'} variant={torch ? 'solid' : 'soft'} hue="spend" size="md" haptic="light" onPress={() => setTorch((t) => !t)} accessibilityLabel="Torch" />
          {facing === 'back' ? (
            <AnimatedPressable onPress={cycleZoom} haptic="selection" style={[styles.zoom, { backgroundColor: C.surface2 }]} accessibilityRole="button" accessibilityLabel={`Zoom ${zoomLabel}`}>
              <Text style={[Type.dotSmall, { color: C.textHi, fontSize: 16 }]}>{zoomLabel}</Text>
            </AnimatedPressable>
          ) : (
            <View style={styles.zoom} />
          )}
          <AnimatedPressable onPress={capture} disabled={!!busy} haptic="medium" pressScale={0.88} style={[styles.shutter, { borderColor: L.main }]} accessibilityRole="button" accessibilityLabel="Check in now">
            <View style={[styles.shutterInner, { backgroundColor: L.main }]}>
              <MaterialCommunityIcons name="map-marker-check" size={30} color={L.on} />
            </View>
          </AnimatedPressable>
          <ChunkyButton icon="camera-flip" variant="soft" hue="checkin" size="md" haptic="light" onPress={flip} accessibilityLabel="Flip camera" />
          <View style={[styles.zoom, { backgroundColor: C.surface2 }]} accessible accessibilityLabel={webhookUrl ? 'Channel connected' : 'No channel connected'}>
            <MaterialCommunityIcons name={webhookUrl ? 'webhook' : 'link-variant-off'} size={20} color={webhookUrl ? L.main : C.alert} />
          </View>
        </View>
      </View>

      {busy && (
        <Animated.View entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} style={styles.busy}>
          <IconBlob name={busy.icon} hue="checkin" size={88} />
          <Text style={[Type.title, { color: '#FFFFFF' }]}>{busy.text}</Text>
          <ActivityIndicator color={L.main} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, backgroundColor: '#000' },
  glass: { backgroundColor: 'rgba(11,11,15,0.72)' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: Radius.pill },
  status: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  banner: { alignSelf: 'center', marginTop: Spacing.three },
  flexSpacer: { flex: 1 },
  dock: {
    marginHorizontal: Spacing.three,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  zoom: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,11,15,0.88)', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
});
