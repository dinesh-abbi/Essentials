import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, NativeModules, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigMessage } from '@/components/ui/big-message';
import { ChunkyButton, Tile } from '@/components/ui/chunky';
import { ScanFrame } from '@/components/ui/scan-frame';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';

const C = Colors.dark;

// Pull `pa` out of a upi://pay URI, or accept a raw VPA like name@bank.
const parseUpiId = (data: string) => {
  if (data.startsWith('upi://pay')) {
    try {
      return new URLSearchParams(data.split('?')[1]).get('pa') || null;
    } catch {
      return null;
    }
  }
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(data) ? data : null;
};

/** Point the camera at a UPI QR, pick one from your photos, or type an ID. */
export default function UpiScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualUpi, setManualUpi] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  const go = (upiId: string, data?: string) =>
    router.push({ pathname: '/upi/amount' as any, params: data?.startsWith('upi://pay') ? { upiId, qrData: data } : { upiId } });

  const fromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photos needed', 'Allow photo access to read a QR from your gallery.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const { QrCodeScanner } = NativeModules;
      if (!QrCodeScanner) {
        Alert.alert('Scanner error', 'The QR reader is not available in this build.');
        return;
      }
      setIsScanning(false);
      const decoded: string = await QrCodeScanner.scanQrCodeFromImage(result.assets[0].uri);
      const upiId = parseUpiId(decoded);
      if (upiId) go(upiId, decoded);
      else {
        Alert.alert('No UPI code', 'That picture doesn’t have a UPI QR code in it.');
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Gallery scan error:', error);
      Alert.alert('Couldn’t read it', 'Try another picture.');
      setIsScanning(true);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    const upiId = parseUpiId(data);
    if (upiId) {
      setIsScanning(false);
      go(upiId, data);
    }
  };

  const submitManual = () => {
    const upiId = parseUpiId(manualUpi.trim());
    if (upiId) go(upiId);
    else Alert.alert('Check the UPI ID', 'It looks like name@bank.');
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={Hue.spend.main} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: C.bg }]}>
        <BigMessage icon="qrcode-scan" hue="spend" title="Camera needed" text="To scan a UPI QR code, Essentials needs your camera.">
          <ChunkyButton label="Allow camera" icon="camera" hue="spend" onPress={requestPermission} />
          <ChunkyButton label="Pick from photos" icon="image" variant="soft" hue="spend" onPress={fromGallery} />
        </BigMessage>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={isScanning ? onScanned : undefined}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ScanFrame color={Hue.spend.main} />
          <View style={[styles.hint, { backgroundColor: 'rgba(11,11,15,0.7)' }]}>
            <Text style={[Type.dotLabel, { color: '#FFFFFF' }]}>Point at a UPI QR</Text>
          </View>
        </View>

        <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]}>
          <ChunkyButton icon="arrow-left" variant="soft" hue="spend" size="md" haptic="light" onPress={() => router.back()} accessibilityLabel="Back" />
          <ChunkyButton label="Photos" icon="image" variant="soft" hue="spend" size="md" haptic="light" onPress={fromGallery} />
        </View>

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <Tile style={styles.manual}>
            <Text style={[Type.dotLabel, { color: C.textMid }]}>Or type a UPI ID</Text>
            <View style={styles.row}>
              <TextInput
                style={[Type.controlLabel, styles.input, { color: C.textHi, backgroundColor: C.bg }]}
                placeholder="name@bank"
                placeholderTextColor={C.textLow}
                value={manualUpi}
                onChangeText={setManualUpi}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submitManual}
              />
              <ChunkyButton icon="arrow-right" hue="spend" size="md" onPress={submitManual} disabled={!manualUpi.trim()} accessibilityLabel="Continue" />
            </View>
          </Tile>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, backgroundColor: '#000' },
  hint: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three },
  manual: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  input: { flex: 1, height: 51, borderRadius: Radius.lg, paddingHorizontal: 16 },
});
