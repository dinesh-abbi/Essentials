import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import * as AttendanceStorage from '@/utils/AttendanceStorage';
import { File, UploadType } from 'expo-file-system';
import { AnimatedPressable } from '@/components/ui/animated-pressable';

export default function AttendanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const { discordWebhookUrl } = useAuth();

  // The webhook URL from Firestore (via AuthContext)
  const webhookUrl = discordWebhookUrl ?? '';

  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [zoom, setZoom] = useState(0);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);

  const toggleCameraFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
    setZoom(0);
    setSelectedLens(undefined);
  };

  const handleZoomLensCycle = () => {
    if (Platform.OS === 'ios' && availableLenses.length > 1) {
      const currentIndex = selectedLens ? availableLenses.indexOf(selectedLens) : 0;
      const nextIndex = (currentIndex + 1) % availableLenses.length;
      setSelectedLens(availableLenses[nextIndex]);
    } else {
      setZoom((prev) => {
        if (prev === 0) return 0.15;
        if (prev === 0.15) return 0.3;
        return 0;
      });
    }
  };

  // Load offline queue count
  useEffect(() => {
    async function init() {
      const queue = await AttendanceStorage.getOfflineQueue();
      setOfflineCount(queue.length);
    }
    init();
  }, []);

  // Auto-sync on mount if internet is available and queue has items
  useEffect(() => {
    if (offlineCount > 0 && webhookUrl) {
      handleAutoSync();
    }
  }, [offlineCount, webhookUrl]);

  const handleAutoSync = async () => {
    if (!webhookUrl) return;
    try {
      // Attempt background sync
      const result = await AttendanceStorage.syncQueue(webhookUrl);
      if (result.successCount > 0) {
        const queue = await AttendanceStorage.getOfflineQueue();
        setOfflineCount(queue.length);
      }
    } catch (e) {
      console.log('Auto-sync failed:', e);
    }
  };

  const handleManualSync = async () => {
    if (!webhookUrl) {
      Alert.alert('Webhook Required', 'Please set up your Discord Webhook URL from your profile settings.');
      return;
    }

    setLoading(true);
    setLoadingMessage('[ SYNCING_OFFLINE_LOGS ]');
    try {
      const result = await AttendanceStorage.syncQueue(webhookUrl);
      const queue = await AttendanceStorage.getOfflineQueue();
      setOfflineCount(queue.length);
      
      Alert.alert(
        'Sync Complete',
        `Synced: ${result.successCount} successful, ${result.failCount} failed.`
      );
    } catch (error) {
      Alert.alert('Sync Error', 'An error occurred during manual sync.');
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;

    if (!webhookUrl) {
      Alert.alert('Webhook Required', 'Please set up your Discord Webhook URL to use check-in.', [
        { text: 'Set Up', onPress: () => router.push('/discord-setup') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    setLoading(true);
    setLoadingMessage('[ CAPTURING_ATTENDANCE_LOG ]');
    const timestamp = Date.now();

    try {
      // 1. Take picture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Failed to capture photo URI');
      }

      // 2. Try upload
      setLoadingMessage('[ UPLOADING_TO_DISCORD ]');

      const formattedTime = new Date(timestamp).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      }) + ' IST';

      const payload = {
        content: `📸 **Attendance Log Captured**\n**Captured at**: ${formattedTime}\n**Status**: Online Upload`,
      };

      const file = new File(photo.uri);
      const result = await file.upload(webhookUrl, {
        uploadType: UploadType.MULTIPART,
        fieldName: 'files[0]',
        mimeType: 'image/jpeg',
        parameters: {
          payload_json: JSON.stringify(payload),
        },
      });

      if (result.status >= 200 && result.status < 300) {
        setLoading(false);
        Alert.alert('[ SUCCESS ]', 'Attendance logged successfully.');
        router.back();
      } else {
        throw new Error(`Upload returned status ${result.status}`);
      }
    } catch (error) {
      // Fallback: save offline
      setLoadingMessage('[ SAVING_LOCAL_COPY ]');
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo?.uri) {
          await AttendanceStorage.saveOfflineLog(photo.uri, timestamp);
          const queue = await AttendanceStorage.getOfflineQueue();
          setOfflineCount(queue.length);
          
          setLoading(false);
          Alert.alert(
            '[ OFFLINE_MODE ]',
            'Log saved locally. It will be uploaded automatically when connection is restored.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          throw new Error('Photo URI not available for offline save');
        }
      } catch (localError) {
        setLoading(false);
        Alert.alert('[ ERROR ]', 'Failed to capture or save attendance log.');
        console.error(localError);
      }
    }
  };



  // Check permissions state
  if (!permission) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#00FF66" />
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
          Camera permission is required to capture and upload attendance logs.
        </ThemedText>
        <AnimatedPressable
          onPress={requestPermission}
          style={[
            styles.primaryButton,
            {
              backgroundColor: theme.primary,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Enable Camera
          </ThemedText>
        </AnimatedPressable>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Absolute Fullscreen Camera */}
      <CameraView
        ref={cameraRef}
        facing={facing}
        zoom={zoom}
        selectedLens={selectedLens}
        onAvailableLensesChanged={(event) => {
          if (event?.lenses) {
            setAvailableLenses(event.lenses);
          }
        }}
        enableTorch={isTorchOn}
        style={StyleSheet.absoluteFill}
      />

      {/* Scanner HUD Overlay - Neat Minimalist Target Reticle */}
      <View style={styles.hudOverlay} pointerEvents="none">
        <View style={styles.focusFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* Camera UI Overlay Container */}
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}>
        
        {/* Top Controls Row */}
        <View style={styles.topRow}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[
              styles.roundBtn,
              { backgroundColor: 'rgba(15, 23, 42, 0.6)' },
            ]}>
            <Feather name="arrow-left" size={20} color="#FFF" />
          </AnimatedPressable>

        </View>

        {/* Offline Warning Banner */}
        {offlineCount > 0 && (
          <View style={styles.bannerContainer}>
            <AnimatedPressable
              onPress={handleManualSync}
              style={[
                styles.syncBanner,
                { backgroundColor: theme.alert },
              ]}>
              <Feather name="wifi-off" size={14} color="#FFF" />
              <ThemedText type="code" style={styles.bannerText}>
                {offlineCount} PENDING LOGS
              </ThemedText>
              <ThemedText type="code" style={styles.bannerButtonText}>
                Sync Now
              </ThemedText>
            </AnimatedPressable>
          </View>
        )}

        {/* Spacer to push controls to bottom */}
        <View style={{ flex: 1 }} />

        {/* Floating Glassmorphic Bottom Camera Controls */}
        <View style={styles.bottomDashboardContainer}>
          <View style={styles.bottomDashboard}>
            {/* Flashlight Toggle */}
            <AnimatedPressable
              onPress={() => setIsTorchOn(!isTorchOn)}
              style={[
                styles.dashboardSubBtn,
                { 
                  backgroundColor: isTorchOn ? theme.primary : 'rgba(255,255,255,0.08)',
                  borderColor: isTorchOn ? theme.primary : 'rgba(255,255,255,0.2)'
                },
              ]}>
              <Feather name="zap" size={18} color={isTorchOn ? '#FFF' : 'rgba(255,255,255,0.8)'} />
            </AnimatedPressable>

            {/* Camera Flip Toggle */}
            <AnimatedPressable
              onPress={toggleCameraFacing}
              style={[
                styles.dashboardSubBtn,
                { 
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.2)'
                },
              ]}>
              <Feather name="refresh-cw" size={18} color="rgba(255,255,255,0.8)" />
            </AnimatedPressable>

            {/* Large Capture Trigger Button */}
            <AnimatedPressable
              onPress={capturePhoto}
              disabled={loading}
              style={styles.captureOuter}>
              <View style={styles.captureInner} />
            </AnimatedPressable>

            {/* Zoom / Lens Switcher */}
            {facing === 'back' ? (
              <AnimatedPressable
                onPress={handleZoomLensCycle}
                style={[
                  styles.dashboardSubBtn,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.2)'
                  },
                ]}>
                <ThemedText type="code" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' }}>
                  {Platform.OS === 'ios' && availableLenses.length > 1
                    ? `L${selectedLens ? availableLenses.indexOf(selectedLens) + 1 : 1}`
                    : zoom === 0
                    ? '1x'
                    : zoom === 0.15
                    ? '2x'
                    : '3x'}
                </ThemedText>
              </AnimatedPressable>
            ) : (
              <View style={{ width: 44 }} />
            )}

            {/* Webhook Status Dot */}
            <View style={styles.dashboardStatusBlock}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: webhookUrl ? theme.success : theme.alert },
                ]}
              />
              <ThemedText type="code" style={styles.statusLabel}>
                {webhookUrl ? 'ONLINE' : 'LOCAL'}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Tech Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00FF66" />
          <ThemedText type="code" style={styles.loadingText}>
            {loadingMessage}
          </ThemedText>
        </View>
      )}


    </View>
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
    fontWeight: 'bold',
    marginBottom: Spacing.two,
  },
  permissionSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: Spacing.five,
  },
  primaryButton: {
    borderRadius: 12,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  bannerContainer: {
    alignItems: 'center',
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    gap: Spacing.two,
  },
  bannerText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  bannerButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  bottomDashboardContainer: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  bottomDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 28,
  },
  dashboardSubBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  captureOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  dashboardStatusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    gap: Spacing.two,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    gap: Spacing.three,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  hudOverlay: {
    ...StyleSheet.absoluteFill,
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
});
