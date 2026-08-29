import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFace, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AnimatedPressable } from '@/components/ui/animated-pressable';

export default function UpiScannerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualUpi, setManualUpi] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  const { width, height } = useWindowDimensions();
  const frameSize = 250;

  const handleSelectFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access your photos is required to upload a QR code.');
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
      
      const { QrCodeScanner } = NativeModules;
      if (!QrCodeScanner) {
        Alert.alert('Scanner Error', 'Native QR scanner module is not available.');
        return;
      }

      setIsScanning(false);
      const decodedCode = await QrCodeScanner.scanQrCodeFromImage(pickedUri);
      
      const upiId = parseUpiId(decodedCode);
      if (upiId) {
        if (decodedCode.startsWith('upi://pay')) {
          router.push({ pathname: '/upi/amount' as any, params: { upiId, qrData: decodedCode } });
        } else {
          router.push({ pathname: '/upi/amount' as any, params: { upiId } });
        }
      } else {
        Alert.alert('Invalid QR Code', 'No valid UPI QR code detected in the selected image.');
        setIsScanning(true);
      }
    } catch (error: any) {
      console.error('Gallery scan error:', error);
      Alert.alert('Scan Failed', 'Could not detect a QR code. Please try another image.');
      setIsScanning(true);
    }
  };

  // Extract pa parameter from upi://pay URI or assume it's a raw VPA
  const parseUpiId = (data: string) => {
    if (data.startsWith('upi://pay')) {
      try {
        const urlParams = new URLSearchParams(data.split('?')[1]);
        const pa = urlParams.get('pa');
        return pa || null;
      } catch (e) {
        return null;
      }
    }
    // Simple basic regex check for UPI ID format (e.g., name@bank)
    if (/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(data)) {
      return data;
    }
    return null;
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    
    const upiId = parseUpiId(data);
    if (upiId) {
      setIsScanning(false);
      if (data.startsWith('upi://pay')) {
        router.push({ pathname: '/upi/amount' as any, params: { upiId, qrData: data } });
      } else {
        router.push({ pathname: '/upi/amount' as any, params: { upiId } });
      }
    } else {
      // Optional: show a small toast or ignore invalid QR codes
    }
  };

  const handleManualSubmit = () => {
    const upiId = parseUpiId(manualUpi.trim());
    if (upiId) {
      router.push({ pathname: '/upi/amount' as any, params: { upiId } });
    } else {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g., user@bank).');
    }
  };

  if (!permission) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.permissionContainer}>
        <Feather name="camera" size={48} color={theme.primary} style={{ marginBottom: Spacing.four }} />
        <ThemedText type="subtitle" style={styles.permissionTitle}>
          Camera Required
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.permissionSubtitle}>
          Camera permission is required to scan UPI QR codes.
        </ThemedText>
        <AnimatedPressable
          onPress={requestPermission}
          style={[
            styles.primaryButton,
            { backgroundColor: theme.primary },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Enable Camera
          </ThemedText>
        </AnimatedPressable>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Camera View */}
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />

        {/* HUD Overlay */}
        <View style={styles.hudOverlay} pointerEvents="none">
          <View
            style={[
              styles.focusFrame,
              {
                position: 'absolute',
                left: (width - frameSize) / 2,
                top: (height - frameSize) / 2,
              },
            ]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        {/* Top Controls */}
        <View style={[styles.topRow, { paddingTop: insets.top + Spacing.four }]}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[styles.roundBtn, { backgroundColor: 'rgba(15, 23, 42, 0.6)' }]}>
            <Feather name="arrow-left" size={20} color="#FFF" />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={handleSelectFromGallery}
            style={[styles.roundBtn, { backgroundColor: 'rgba(15, 23, 42, 0.6)', marginLeft: 'auto' }]}>
            <Feather name="image" size={20} color="#FFF" />
          </AnimatedPressable>
        </View>

        {/* Bottom Fallback Input */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
          <View style={styles.inputCard}>
            <ThemedText style={styles.inputLabel}>Or enter UPI ID manually:</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., name@bank"
                placeholderTextColor={theme.textSecondary}
                value={manualUpi}
                onChangeText={setManualUpi}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <AnimatedPressable
                onPress={handleManualSubmit}
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}>
                <Feather name="arrow-right" size={20} color="#FFF" />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  permissionTitle: {
    fontSize: 20,
    fontFamily: FontFace.bold,
    marginBottom: Spacing.two,
  },
  permissionSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FontFace.regular,
    marginBottom: Spacing.five,
  },
  primaryButton: {
    borderRadius: 12,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    zIndex: 10,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: 250,
    height: 250,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderLeftWidth: 3,
    borderTopWidth: 3,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderRightWidth: 3,
    borderTopWidth: 3,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.four,
  },
  inputCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    padding: Spacing.four,
    borderRadius: 24,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: FontFace.regular,
    marginBottom: Spacing.three,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontFamily: FontFace.regular,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  submitBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
