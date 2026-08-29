import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import ChangelogView from '@/components/ChangelogView';
import { Button } from '@/components/ui/button';
import { FontFace, MaxContentWidth, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cleanOldApks,
  currentVersion,
  downloadApk,
  fetchLatestRelease,
  installApk,
  isApkDownloaded,
  isNewerVersion,
  markUpdateSeen,
  type ReleaseInfo,
} from '@/utils/updates';

/**
 * Full-screen update screen — replaces the old cramped modal.
 *
 * Checks if the update is already cached in local storage:
 * - If already downloaded: instantly offers "Install Now" without re-downloading.
 * - If not downloaded: shows download progress and smoothly triggers install.
 * - Cleans up old APKs to free Android storage automatically.
 */
export default function UpdateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Clean old leftover APKs in the background
      cleanOldApks();

      const latest = await fetchLatestRelease();
      if (cancelled) return;
      setRelease(latest);

      if (latest) {
        markUpdateSeen(latest.version);
        // Check if the APK is already downloaded in local cache
        const alreadyDownloaded = await isApkDownloaded(latest.version);
        if (!cancelled && alreadyDownloaded) {
          setIsCached(true);
          setProgress(1);
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!release) return;

    try {
      const alreadyDownloaded = await isApkDownloaded(release.version);

      if (!alreadyDownloaded) {
        setIsDownloading(true);
        setProgress(0);
        await downloadApk(release, (p) => setProgress(p));
        setIsCached(true);
        setIsDownloading(false);
      }

      // Hand off to Android package installer
      const launched = await installApk(release.version);
      if (launched) {
        router.back();
      }
    } catch (error: any) {
      console.error('[update] Install failed:', error);
      setIsDownloading(false);
      setIsCached(false);
      Alert.alert(
        'Update Error',
        error?.message ?? 'An error occurred during update installation. Please try again.'
      );
    }
  }, [release, router]);

  const horizontalPadding = width >= 700 ? Spacing.five : Spacing.four;
  const hasUpdate = !!release && isNewerVersion(release.version, currentVersion);
  const entering = reduceMotion ? undefined : FadeInDown.duration(Motion.duration.base);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.signal} />
            <Text style={[styles.centeredText, { color: theme.textSecondary }]}>
              Checking for updates…
            </Text>
          </View>
        ) : !release ? (
          <View style={styles.centered}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
              <Feather name="cloud-off" size={22} color={theme.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn't reach GitHub</Text>
            <Text style={[styles.centeredText, { color: theme.textSecondary }]}>
              Check your connection and try again later.
            </Text>
            <Button title="Close" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.three }} />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[
                styles.content,
                { paddingHorizontal: horizontalPadding },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Version transition ────────────────────────────────────── */}
              <Animated.View entering={entering} style={styles.versionCompare}>
                <View style={[styles.versionBlock, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <Text style={[styles.versionCaption, { color: theme.textFaint }]}>INSTALLED</Text>
                  <Text style={[styles.versionValue, { color: theme.textSecondary }]}>v{currentVersion}</Text>
                </View>
                <Feather name="arrow-right" size={18} color={theme.textFaint} />
                <View style={[styles.versionBlock, { backgroundColor: theme.signalWeak, borderColor: theme.signalLine }]}>
                  <Text style={[styles.versionCaption, { color: theme.signal }]}>
                    {isCached ? 'DOWNLOADED' : 'NEW'}
                  </Text>
                  <Text style={[styles.versionValue, { color: theme.signal }]}>v{release.version}</Text>
                </View>
              </Animated.View>

              <ChangelogView
                markdown={release.notes}
                version={release.version}
                eyebrow={hasUpdate ? (isCached ? 'Update ready to install' : 'Update available') : 'Latest release'}
              />
            </ScrollView>

            {/* ── Sticky action bar ──────────────────────────────────────── */}
            <View
              style={[
                styles.actionBar,
                {
                  backgroundColor: theme.backgroundElement,
                  borderTopColor: theme.hairline,
                  paddingBottom: insets.bottom + Spacing.three,
                  paddingHorizontal: horizontalPadding,
                },
              ]}
            >
              {isDownloading ? (
                <View style={styles.progressWrap}>
                  <View style={styles.progressLabelRow}>
                    <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                      Downloading update…
                    </Text>
                    <Text style={[styles.progressValue, { color: theme.text }]}>
                      {Math.round(progress * 100)}%
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSunken }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: theme.signal, width: `${Math.max(4, Math.round(progress * 100))}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : hasUpdate ? (
                <View style={styles.actionRow}>
                  <Button
                    title="Later"
                    variant="ghost"
                    size="lg"
                    onPress={() => router.back()}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={isCached ? 'Install Now' : 'Install Update'}
                    variant="primary"
                    size="lg"
                    icon={isCached ? 'check-circle' : 'download'}
                    onPress={handleInstall}
                    style={{ flex: 2 }}
                  />
                </View>
              ) : (
                <Button
                  title="You're up to date"
                  variant="secondary"
                  size="lg"
                  icon="check"
                  fullWidth
                  onPress={() => router.back()}
                />
              )}
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centeredText: {
    ...Type.body,
    fontSize: 13,
    fontFamily: FontFace.regular,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    ...Type.title,
    fontSize: 17,
    fontFamily: FontFace.regular,
    textAlign: 'center',
  },

  // ── Version compare ─────────────────────────────────────────────────────────
  versionCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  versionBlock: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    gap: 2,
  },
  versionCaption: {
    ...Type.label,
    fontSize: 10,
    fontFamily: FontFace.regular,
  },
  versionValue: {
    ...Type.readout,
    fontSize: 17,
    fontFamily: FontFace.regular,
  },

  // ── Action bar ──────────────────────────────────────────────────────────────
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  progressWrap: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...Type.body,
    fontSize: 13,
    fontFamily: FontFace.regular,
  },
  progressValue: {
    ...Type.readout,
    fontSize: 14,
    fontFamily: FontFace.regular,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
