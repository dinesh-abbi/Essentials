import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Feather } from '@expo/vector-icons';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function OTAUpdateChecker() {
  // Only execute this logic on Android devices
  if (Platform.OS !== 'android') {
    return null;
  }

  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const currentVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    // GitHub Releases API — no auth token needed for public repos
    const apiUrl = 'https://api.github.com/repos/dinesh-abbi/Essentials/releases/latest';

    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (!response.ok) {
        // No release published yet or repo is unreachable — silently ignore
        return;
      }

      const data = await response.json();

      // tag_name is typically "v1.0.5" — strip the leading "v" for semver comparison
      const latest = data.tag_name?.replace(/^v/i, '');
      // APK is always the first (and only) asset attached to the release
      const downloadLink: string | undefined = data.assets?.[0]?.browser_download_url;

      if (latest && downloadLink && isNewerVersion(latest, currentVersion)) {
        setLatestVersion(latest);
        setApkUrl(downloadLink);
        setModalVisible(true);
      }
    } catch (e) {
      console.warn('OTA update check failed:', e);
    }
  }

  // Simple helper to check if latest is newer than current
  function isNewerVersion(latest: string, current: string): boolean {
    const lParts = latest.split('.').map(Number);
    const cParts = current.split('.').map(Number);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const lVal = lParts[i] || 0;
      const cVal = cParts[i] || 0;
      if (lVal > cVal) return true;
      if (lVal < cVal) return false;
    }
    return false;
  }

  async function handleDownloadAndInstall() {
    if (!apkUrl) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const downloadDest = `${FileSystem.cacheDirectory}update-${latestVersion}.apk`;

    try {
      // 1. Setup download resumable with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        apkUrl,
        downloadDest,
        {},
        (downloadProgressEvent) => {
          const progress =
            downloadProgressEvent.totalBytesWritten /
            downloadProgressEvent.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      console.log('Downloading APK from:', apkUrl);
      const downloadResult = await downloadResumable.downloadAsync();

      if (!downloadResult || !downloadResult.uri) {
        throw new Error('Downloaded file URI not returned.');
      }

      console.log('Download completed. Local URI:', downloadResult.uri);

      // 2. Convert file:// URI to content:// URI (Android 7.0+ compatibility)
      const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
      console.log('Content URI generated:', contentUri);

      // Close modal before opening installer
      setModalVisible(false);
      setIsDownloading(false);

      // 3. Trigger Android native package installer intent
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } catch (err: any) {
      console.error('OTA Install Error:', err);
      setIsDownloading(false);
      Alert.alert(
        'Update Failed',
        'An error occurred during the update process: ' + (err.message || err)
      );
    }
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={modalVisible}
      onRequestClose={() => {
        if (!isDownloading) {
          setModalVisible(false);
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.header}>
            <View style={[styles.iconBg, { backgroundColor: theme.primary + '15' }]}>
              <Feather name="download-cloud" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Update Available</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              A new version (v{latestVersion}) is available. Please update to get the latest features and fixes.
            </Text>
          </View>

          {/* Version details info */}
          <View style={[styles.infoBox, { backgroundColor: theme.backgroundSelected }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Current Version:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>v{currentVersion}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>New Version:</Text>
              <Text style={[styles.infoValue, { color: theme.primary, fontWeight: '800' }]}>v{latestVersion}</Text>
            </View>
          </View>

          {isDownloading ? (
            <View style={styles.downloadContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        backgroundColor: theme.primary,
                        width: `${Math.round(downloadProgress * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.text }]}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
              <Text style={[styles.downloadingLabel, { color: theme.textSecondary }]}>
                Downloading update package...
              </Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.cancelBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.cancelText, { color: theme.text }]}>Later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadAndInstall}
                style={[styles.installBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.installText}>Install Update</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  infoBox: {
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  downloadContainer: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    width: 32,
    textAlign: 'right',
  },
  downloadingLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  installBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
