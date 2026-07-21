import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';

const { AlarmScheduler, QrCodeScanner } = NativeModules;

export default function AlarmSetupScreen() {
  const router = useRouter();
  const theme = useTheme();

  // ── States ─────────────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState(new Date());
  const [soundUri, setSoundUri] = useState<string | null>(null);
  const [soundName, setSoundName] = useState<string | null>(null);
  const [barcodePayload, setBarcodePayload] = useState<string | null>(null);

  // Modals & UI states
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasExactAlarmPermission, setHasExactAlarmPermission] = useState(true);

  // Load existing config
  useEffect(() => {
    async function loadConfig() {
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
      
      // Check exact alarm permission state
      if (AlarmScheduler) {
        const hasPerm = await AlarmScheduler.canScheduleExactAlarms();
        setHasExactAlarmPermission(hasPerm);
      }
    }
    loadConfig();
  }, []);

  // Format date to HH:MM AM/PM
  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minStr} ${ampm}`;
  };

  // ── Sound Selection ────────────────────────────────────────────────────────
  const handleSelectSound = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setSoundUri(file.uri);
        setSoundName(file.name || 'Custom Sound');
      }
    } catch (err) {
      console.error('Error selecting sound:', err);
      Alert.alert('Error', 'Failed to pick audio file from storage.');
    }
  };

  // ── Barcode Scanning ───────────────────────────────────────────────────────
  const startScanningFlow = async () => {
    if (!cameraPermission) {
      const status = await requestCameraPermission();
      if (!status.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan a barcode.');
        return;
      }
    } else if (!cameraPermission.granted) {
      const status = await requestCameraPermission();
      if (!status.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan a barcode.');
        return;
      }
    }
    setIsScannerVisible(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (data) {
      setBarcodePayload(data);
      setIsScannerVisible(false);
      Alert.alert('Success', `Barcode registered: ${data}`);
    }
  };

  const handleSelectFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const pickedUri = result.assets[0].uri;

      if (!QrCodeScanner) {
        Alert.alert('Module Missing', 'Native Barcode Scanner module is not available.');
        return;
      }

      // Decode barcode from library image using MLKit native module
      const payload = await QrCodeScanner.scanQrCodeFromImage(pickedUri);
      if (payload) {
        setBarcodePayload(payload);
        setIsScannerVisible(false);
        Alert.alert('Success', `Barcode detected: ${payload}`);
      } else {
        Alert.alert('Error', 'No barcode found in this image.');
      }
    } catch (error) {
      console.error('Gallery decode error:', error);
      Alert.alert('Error', 'Could not scan barcode from this image.');
    }
  };

  // ── Request Exact Alarm Permission ─────────────────────────────────────────
  const requestExactAlarmPermission = async () => {
    if (AlarmScheduler) {
      await AlarmScheduler.openExactAlarmSettings();
      // Re-check after returning to app
      const hasPerm = await AlarmScheduler.canScheduleExactAlarms();
      setHasExactAlarmPermission(hasPerm);
    }
  };

  // ── Save Alarm Configuration ────────────────────────────────────────────────
  const handleSave = async () => {
    if (enabled) {
      if (!barcodePayload) {
        Alert.alert('Barcode Required', 'Please scan a barcode to use as your unlock key.');
        return;
      }

      if (AlarmScheduler) {
        const hasPerm = await AlarmScheduler.canScheduleExactAlarms();
        if (!hasPerm) {
          Alert.alert(
            'Exact Alarm Required',
            'To trigger alarms reliably while the device is in sleep/Doze mode, allow exact alarms in system settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: requestExactAlarmPermission }
            ]
          );
          return;
        }
      }
    }

    try {
      const config = {
        enabled,
        hour: time.getHours(),
        minute: time.getMinutes(),
        barcodePayload,
        soundUri,
        soundName,
      };

      await BarcodeAlarmStorage.saveAlarmConfig(config);
      Alert.alert('Saved', 'Barcode alarm configuration saved successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'An error occurred.');
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">Barcode Alarm</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold">Enable Barcode Alarm</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                Requires scanning a barcode to dismiss
              </ThemedText>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: theme.primary }}
              thumbColor={Platform.OS === 'android' ? '#FFF' : undefined}
            />
          </View>

          {/* Alarm Time Selection */}
          <TouchableOpacity
            style={[styles.row, styles.borderTop, { borderColor: theme.border }]}
            onPress={() => setIsTimePickerVisible(true)}
            disabled={!enabled}
          >
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold">Alarm Time</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                Time the alarm will ring daily
              </ThemedText>
            </View>
            <View style={styles.rightVal}>
              <ThemedText type="smallBold" style={!enabled && { color: theme.textSecondary }}>
                {formatTime(time)}
              </ThemedText>
              <Feather name="chevron-right" size={16} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Alarm Sound Selection */}
          <TouchableOpacity
            style={[styles.row, styles.borderTop, { borderColor: theme.border }]}
            onPress={handleSelectSound}
            disabled={!enabled}
          >
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold">Alarm Sound</ThemedText>
              <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                {soundName || 'Default System Alarm'}
              </ThemedText>
            </View>
            <View style={styles.rightVal}>
              <Feather name="music" size={16} color={enabled ? theme.primary : theme.textSecondary} />
              <Feather name="chevron-right" size={16} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Barcode Selection */}
          <TouchableOpacity
            style={[styles.row, styles.borderTop, { borderColor: theme.border }]}
            onPress={startScanningFlow}
            disabled={!enabled}
          >
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold">Unlock Barcode</ThemedText>
              <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                {barcodePayload ? `Registered: ${barcodePayload}` : 'Not configured'}
              </ThemedText>
            </View>
            <View style={styles.rightVal}>
              <Feather
                name={barcodePayload ? 'check-circle' : 'camera'}
                size={16}
                color={barcodePayload ? theme.success : theme.textSecondary}
              />
              <Feather name="chevron-right" size={16} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Exact Alarm Permission Banner */}
        {!hasExactAlarmPermission && enabled && (
          <View style={[styles.permissionBanner, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            <Feather name="alert-triangle" size={20} color={theme.alert} />
            <View style={{ flex: 1, marginLeft: Spacing.two }}>
              <ThemedText type="smallBold">Exact Alarms Disabled</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Alarms may trigger late or be blocked by Android power saving.
              </ThemedText>
              <TouchableOpacity onPress={requestExactAlarmPermission} style={{ marginTop: Spacing.one }}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>Configure Permission</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomBar}>
        <AnimatedPressable
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
        >
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Save Alarm Config
          </ThemedText>
        </AnimatedPressable>
      </View>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={isTimePickerVisible}
        onClose={() => setIsTimePickerVisible(false)}
        selectedDate={time}
        onSelectTime={(newDate: Date) => setTime(newDate)}
        theme={theme}
      />

      {/* Barcode Scanner Overlay Modal */}
      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setIsScannerVisible(false)}>
        <SafeAreaView style={[styles.scannerRoot, { backgroundColor: '#000' }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          {/* HUD Target Overlay */}
          <View style={styles.hudOverlay} pointerEvents="none">
            <View style={styles.focusFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setIsScannerVisible(false)} style={styles.scannerClose}>
              <Feather name="x" size={24} color="#FFF" />
            </TouchableOpacity>
            <ThemedText style={{ color: '#FFF', fontWeight: '800' }}>Align Barcode in Frame</ThemedText>
            <TouchableOpacity onPress={handleSelectFromGallery} style={styles.scannerClose}>
              <Feather name="image" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Wheel Picker Column Component for sliding and scrolling time selection ──
function WheelPickerColumn({ items, selectedValue, onValueChange, theme, visible }: any) {
  const ITEM_HEIGHT = 40;
  const listRef = useRef<FlatList>(null);
  const isMounted = useRef(false);

  // Sync scroll position with state changes (e.g. on open or value update)
  useEffect(() => {
    if (visible) {
      const idx = items.indexOf(selectedValue.toString());
      if (idx !== -1) {
        const timer = setTimeout(() => {
          listRef.current?.scrollToOffset({
            offset: idx * ITEM_HEIGHT,
            animated: isMounted.current,
          });
          isMounted.current = true;
        }, 80);
        return () => clearTimeout(timer);
      }
    } else {
      isMounted.current = false;
    }
  }, [visible, selectedValue]);

  const handleScrollEnd = (e: any) => {
    const yOffset = e.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT);
    const safeIndex = Math.max(0, Math.min(items.length - 1, index));
    const newVal = items[safeIndex];
    if (newVal !== selectedValue.toString()) {
      onValueChange(newVal);
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: 66, overflow: 'hidden' }}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        renderItem={({ item }) => {
          const isSelected = item === selectedValue.toString();
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const idx = items.indexOf(item);
                listRef.current?.scrollToOffset({
                  offset: idx * ITEM_HEIGHT,
                  animated: true,
                });
                onValueChange(item);
              }}
              style={{
                height: ITEM_HEIGHT,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: isSelected ? 22 : 16,
                  fontWeight: isSelected ? '800' : '400',
                  color: isSelected ? theme.primary : theme.textSecondary,
                  opacity: isSelected ? 1 : 0.4,
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ── Inner Time Picker Component ──────────────────────────────────────────────
function TimePickerModal({ visible, onClose, selectedDate, onSelectTime, theme }: any) {
  const date = new Date(selectedDate);
  let initialHours = date.getHours();
  const ampm = initialHours >= 12 ? 'PM' : 'AM';
  initialHours = initialHours % 12;
  if (initialHours === 0) initialHours = 12;
  const initialMinutes = date.getMinutes();

  const [hours, setHours] = useState(initialHours.toString());
  const [minutes, setMinutes] = useState(initialMinutes.toString().padStart(2, '0'));
  const [period, setPeriod] = useState(ampm);

  useEffect(() => {
    if (visible) {
      let h = selectedDate.getHours();
      const p = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      setHours(h.toString());
      setMinutes(selectedDate.getMinutes().toString().padStart(2, '0'));
      setPeriod(p);
    }
  }, [visible, selectedDate]);

  const handleSave = () => {
    const newDate = new Date(selectedDate);
    let h = parseInt(hours);
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    newDate.setHours(h, parseInt(minutes), 0, 0);
    onSelectTime(newDate);
    onClose();
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutesList = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periodList = ['AM', 'PM'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.timeCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="smallBold" style={{ textAlign: 'center', marginBottom: Spacing.three }}>
            Set Alarm Time
          </ThemedText>

          <View style={styles.pickerRow}>
            {/* Absolute highlight bar behind columns */}
            <View style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: 40,
              height: 40,
              backgroundColor: theme.primary + '10',
              borderRadius: Radius.sm,
              borderWidth: 1,
              borderColor: theme.primary + '25',
              pointerEvents: 'none'
            }} />

            {/* Hours Column */}
            <WheelPickerColumn
              items={hoursList}
              selectedValue={hours}
              onValueChange={setHours}
              theme={theme}
              visible={visible}
            />

            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textSecondary, marginTop: -4 }}>:</Text>

            {/* Minutes Column */}
            <WheelPickerColumn
              items={minutesList}
              selectedValue={minutes}
              onValueChange={setMinutes}
              theme={theme}
              visible={visible}
            />

            <Text style={{ width: 10 }} />

            {/* Period Column */}
            <WheelPickerColumn
              items={periodList}
              selectedValue={period}
              onValueChange={setPeriod}
              theme={theme}
              visible={visible}
            />
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onClose} style={[styles.dialogBtn, { borderColor: theme.border }]}>
              <ThemedText type="small">Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.dialogBtn, { backgroundColor: theme.primary, borderWidth: 0 }]}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  backBtn: {
    marginRight: Spacing.three,
  },
  container: {
    padding: Spacing.four,
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  rowInfo: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  borderTop: {
    borderTopWidth: 1,
  },
  rightVal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  bottomBar: {
    padding: Spacing.four,
  },
  saveBtn: {
    height: 50,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBanner: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.four,
    alignItems: 'flex-start',
  },
  // Modal layout
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeCard: {
    width: 280,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.four,
  },
  col: {
    alignItems: 'center',
  },
  digitText: {
    fontSize: 28,
    marginVertical: Spacing.one,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  dialogBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  // Scanner styles
  scannerRoot: {
    flex: 1,
  },
  scannerHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  scannerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: 250,
    height: 250,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
});
