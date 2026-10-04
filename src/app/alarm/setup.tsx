import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, NativeModules, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { DateTimeSheet } from '@/components/ui/date-time-sheet';
import { ScanFrame } from '@/components/ui/scan-frame';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hue, mix, Radius, Spacing, Type } from '@/constants/theme';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';

const { AlarmScheduler, QrCodeScanner } = NativeModules;
const C = Colors.dark;
const P = Hue.alarm;

/**
 * Barcode alarm setup as a three-step checklist — time, sound, barcode —
 * each a big tile that turns pink and ticks when it's done. The time is a
 * giant dot-matrix clock you tap to change.
 */
export default function AlarmSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState(() => new Date());
  const [soundUri, setSoundUri] = useState<string | null>(null);
  const [soundName, setSoundName] = useState<string | null>(null);
  const [barcodePayload, setBarcodePayload] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [exactOk, setExactOk] = useState(true);

  useEffect(() => {
    (async () => {
      const config = await BarcodeAlarmStorage.getAlarmConfig();
      if (config) {
        setEnabled(config.enabled);
        setSoundUri(config.soundUri);
        setSoundName(config.soundName);
        setBarcodePayload(config.barcodePayload);
        const d = new Date();
        d.setHours(config.hour, config.minute, 0, 0);
        setTime(d);
      }
      if (AlarmScheduler) setExactOk(await AlarmScheduler.canScheduleExactAlarms());
    })();
  }, []);

  const pickSound = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length) {
        setSoundUri(res.assets[0].uri);
        setSoundName(res.assets[0].name || 'Custom sound');
      }
    } catch (err) {
      console.error('Error selecting sound:', err);
      Alert.alert('Error', 'Couldn’t pick that audio file.');
    }
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const status = await requestCameraPermission();
      if (!status.granted) {
        Alert.alert('Camera needed', 'Allow the camera to scan your barcode.');
        return;
      }
    }
    setScannerOpen(true);
  };

  const registered = (payload: string) => {
    setBarcodePayload(payload);
    setScannerOpen(false);
    Alert.alert('Barcode saved', `This code will stop your alarm:\n${payload}`);
  };

  const fromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photos needed', 'Allow photo access to read a barcode from a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      if (!QrCodeScanner) {
        Alert.alert('Not available', 'The barcode reader is missing from this build.');
        return;
      }
      const payload = await QrCodeScanner.scanQrCodeFromImage(result.assets[0].uri);
      if (payload) registered(payload);
      else Alert.alert('No barcode', 'Couldn’t find a barcode in that picture.');
    } catch (error) {
      console.error('Gallery decode error:', error);
      Alert.alert('Error', 'Couldn’t read a barcode from that picture.');
    }
  };

  const openExactSettings = async () => {
    if (!AlarmScheduler) return;
    await AlarmScheduler.openExactAlarmSettings();
    setExactOk(await AlarmScheduler.canScheduleExactAlarms());
  };

  const save = async () => {
    if (enabled) {
      if (!barcodePayload) {
        Alert.alert('Scan a barcode first', 'Pick something across the room — that code will be the only way to stop the alarm.');
        return;
      }
      if (AlarmScheduler && !(await AlarmScheduler.canScheduleExactAlarms())) {
        Alert.alert('Allow exact alarms', 'So the alarm rings on time even when the phone is asleep.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: openExactSettings },
        ]);
        return;
      }
    }
    try {
      await BarcodeAlarmStorage.saveAlarmConfig({
        enabled,
        hour: time.getHours(),
        minute: time.getMinutes(),
        barcodePayload,
        soundUri,
        soundName,
      });
      Alert.alert(enabled ? 'Alarm set' : 'Alarm off', enabled ? `Rings every day at ${fmt(time)}.` : undefined, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Something went wrong.');
    }
  };

  const [hm, ampm] = fmt(time).split(' ');

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket="Barcode alarm" />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
          {/* ── Clock ─────────────────────────────────────────────────── */}
          <Tile hue={enabled ? 'alarm' : null} style={styles.hero}>
            <View style={styles.heroTop}>
              <IconBlob name={enabled ? 'alarm' : 'alarm-off'} hue="alarm" size={48} variant={enabled ? 'solid' : 'muted'} />
              <View style={styles.flex}>
                <Text style={[Type.title, { color: C.textHi }]}>{enabled ? 'Alarm on' : 'Alarm off'}</Text>
                <Text style={[Type.subline, { color: C.textMid }]}>Only your barcode can stop it</Text>
              </View>
              <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: C.surface2, true: P.main }} thumbColor="#FFFFFF" accessibilityLabel="Alarm on" />
            </View>
            <AnimatedPressable onPress={() => setTimeOpen(true)} haptic="light" pressScale={0.96} style={styles.clock} accessibilityRole="button" accessibilityLabel={`Alarm time ${fmt(time)}. Change.`}>
              <Text style={[Type.dotHero, styles.clockText, { color: enabled ? C.textHi : C.textMid }]}>{hm}</Text>
              <Text style={[Type.dotSmall, { color: enabled ? P.main : C.textMid }]}>{ampm}</Text>
            </AnimatedPressable>
            <Chip icon="gesture-tap" label="Tap the time to change it" hue="alarm" style={styles.center} />
          </Tile>

          {/* ── Checklist ─────────────────────────────────────────────── */}
          <Text style={[Type.dotLabel, styles.label, { color: C.textMid }]}>Setup</Text>
          <Step n={1} icon="clock-outline" title="Time" value={`Every day · ${fmt(time)}`} done onPress={() => setTimeOpen(true)} />
          <Step n={2} icon="music-note" title="Sound" value={soundName || 'Default alarm sound'} done={!!soundName} optional onPress={pickSound} />
          <Step
            n={3}
            icon="barcode-scan"
            title="Barcode to stop it"
            value={barcodePayload ? barcodePayload : 'Scan something across the room'}
            done={!!barcodePayload}
            onPress={openScanner}
          />

          {!exactOk && enabled && (
            <Tile tint={{ face: mix(C.alert, C.surface, 0.14), edge: mix(C.alert, C.bg, 0.3) }} style={styles.warn}>
              <MaterialCommunityIcons name="alert-circle" size={28} color={C.alert} />
              <View style={styles.flex}>
                <Text style={[Type.controlLabel, { color: C.textHi }]}>Exact alarms are off</Text>
                <Text style={[Type.subline, { color: C.textMid }]}>The alarm could ring late while the phone sleeps.</Text>
              </View>
              <ChunkyButton label="Fix" hue="alarm" size="sm" onPress={openExactSettings} />
            </Tile>
          )}
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.three, backgroundColor: C.bg }]}>
          <ChunkyButton label="Save alarm" icon="check-bold" hue="alarm" onPress={save} />
        </View>
      </SafeAreaView>

      <DateTimeSheet mode="time" hue="alarm" minuteStep={1} visible={timeOpen} value={time} onClose={() => setTimeOpen(false)} onChange={setTime} />

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => data && registered(data)}
          />
          <View style={[StyleSheet.absoluteFill, styles.centerFill]} pointerEvents="none">
            <ScanFrame color={P.main} />
            <View style={styles.hint}>
              <Text style={[Type.dotLabel, { color: '#FFFFFF' }]}>Fit the barcode in the frame</Text>
            </View>
          </View>
          <View style={[styles.scanTop, { paddingTop: insets.top + Spacing.two }]}>
            <ChunkyButton icon="close" variant="soft" hue="alarm" size="md" onPress={() => setScannerOpen(false)} accessibilityLabel="Close scanner" />
            <ChunkyButton label="Photos" icon="image" variant="soft" hue="alarm" size="md" onPress={fromGallery} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Step({
  n,
  icon,
  title,
  value,
  done,
  optional,
  onPress,
}: {
  n: number;
  icon: IconName;
  title: string;
  value: string;
  done: boolean;
  optional?: boolean;
  onPress: () => void;
}) {
  return (
    <Tile hue={done ? 'alarm' : null} onPress={onPress} style={styles.step} accessibilityLabel={`Step ${n}: ${title}. ${value}`}>
      <IconBlob name={icon} hue="alarm" size={44} variant={done ? 'solid' : 'soft'} />
      <View style={styles.flex}>
        <Text style={[Type.controlLabel, { color: C.textHi }]}>
          {n}. {title}
          {optional ? <Text style={[Type.subline, { color: C.textMid }]}>  optional</Text> : null}
        </Text>
        <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={[styles.tick, { backgroundColor: done ? P.main : C.surface2 }]}>
        <MaterialCommunityIcons name={done ? 'check-bold' : 'chevron-right'} size={18} color={done ? P.on : C.textMid} />
      </View>
    </Tile>
  );
}

const fmt = (d: Date) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  flex: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 10 },
  hero: { gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  clockText: { fontSize: 76, lineHeight: 84 },
  center: { alignSelf: 'center' },
  label: { marginTop: Spacing.three, marginLeft: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Spacing.two },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, paddingTop: 10 },
  scanner: { flex: 1, backgroundColor: '#000' },
  centerFill: { alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: 'rgba(11,11,15,0.7)' },
  scanTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
});
