import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import ChangelogView from '@/components/ChangelogView';
import { BigMessage } from '@/components/ui/big-message';
import { ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { DotMeter } from '@/components/ui/dots';
import { Colors, Hue, MaxContentWidth, Spacing, Type } from '@/constants/theme';
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

const C = Colors.dark;
const W = Hue.water;

/**
 * The update screen: old version → new version as two tiles, the release
 * notes, and one big button. If the APK is already cached it installs
 * straight away; otherwise a dot-matrix progress meter fills while it
 * downloads. Old APKs are cleaned up in the background.
 */
export default function UpdateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cached, setCached] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      cleanOldApks();
      const latest = await fetchLatestRelease();
      if (cancelled) return;
      setRelease(latest);
      if (latest) {
        markUpdateSeen(latest.version);
        if ((await isApkDownloaded(latest.version)) && !cancelled) {
          setCached(true);
          setProgress(1);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!release) return;
    try {
      if (!(await isApkDownloaded(release.version))) {
        setDownloading(true);
        setProgress(0);
        await downloadApk(release, (p) => setProgress(p));
        setCached(true);
        setDownloading(false);
      }
      if (await installApk(release.version)) router.back();
    } catch (error: any) {
      console.error('[update] Install failed:', error);
      setDownloading(false);
      setCached(false);
      Alert.alert('Update error', error?.message ?? 'Something went wrong. Please try again.');
    }
  }, [release, router]);

  const pad = width >= 700 ? Spacing.five : Spacing.three;
  const hasUpdate = !!release && isNewerVersion(release.version, currentVersion);

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {loading ? (
          <View style={styles.centered}>
            <IconBlob name="rocket-launch" hue="water" size={80} />
            <ActivityIndicator color={W.main} />
            <Text style={[Type.body, { color: C.textMid }]}>Checking for updates…</Text>
          </View>
        ) : !release ? (
          <BigMessage icon="cloud-off-outline" hue="water" title="Couldn’t reach GitHub" text="Check your connection and try again later.">
            <ChunkyButton label="Close" icon="close" variant="soft" hue="water" onPress={() => router.back()} />
          </BigMessage>
        ) : (
          <>
            <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: pad }]} showsVerticalScrollIndicator={false}>
              <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)} style={styles.compare}>
                <Tile containerStyle={styles.flex} style={styles.version}>
                  <Text style={[Type.dotLabel, { color: C.textMid }]}>Now</Text>
                  <Text style={[Type.dotNumber, { color: C.textMid, fontSize: 26 }]}>{currentVersion}</Text>
                </Tile>
                <MaterialCommunityIcons name="arrow-right-bold" size={26} color={W.main} />
                <Tile hue="water" containerStyle={styles.flex} style={styles.version}>
                  <Text style={[Type.dotLabel, { color: W.main }]}>{cached ? 'Downloaded' : 'New'}</Text>
                  <Text style={[Type.dotNumber, { color: C.textHi, fontSize: 26 }]}>{release.version}</Text>
                </Tile>
              </Animated.View>

              <ChangelogView
                markdown={release.notes}
                version={release.version}
                eyebrow={hasUpdate ? (cached ? 'Ready to install' : 'Update available') : 'Latest release'}
              />
            </ScrollView>

            <View style={[styles.bar, { backgroundColor: C.bg, paddingBottom: insets.bottom + Spacing.three, paddingHorizontal: pad }]}>
              {downloading ? (
                <Tile hue="water" style={styles.progress}>
                  <View style={styles.progressTop}>
                    <Text style={[Type.controlLabel, { color: C.textHi }]}>Downloading…</Text>
                    <Text style={[Type.dotSmall, { color: W.main }]}>{Math.round(progress * 100)}%</Text>
                  </View>
                  <DotMeter total={20} lit={Math.round(progress * 20)} color={W.main} size={10} stretch />
                </Tile>
              ) : hasUpdate ? (
                <View style={styles.row}>
                  <ChunkyButton label="Later" variant="soft" hue="water" onPress={() => router.back()} style={styles.flex} />
                  <ChunkyButton label={cached ? 'Install now' : 'Update'} icon={cached ? 'check-bold' : 'download'} hue="water" onPress={install} style={styles.flex2} />
                </View>
              ) : (
                <ChunkyButton label="You’re up to date" icon="check-bold" variant="soft" hue="fuel" onPress={() => router.back()} />
              )}
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { paddingTop: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  version: { alignItems: 'center', gap: 4 },
  bar: { paddingTop: 10 },
  row: { flexDirection: 'row', gap: 10 },
  progress: { gap: 12 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
