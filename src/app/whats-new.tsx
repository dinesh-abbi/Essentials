import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import ChangelogView from '@/components/ChangelogView';
import { BigMessage } from '@/components/ui/big-message';
import { ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hue, MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { currentVersion, fetchLatestRelease, fetchReleaseForVersion, isNewerVersion, type ReleaseInfo } from '@/utils/updates';

const C = Colors.dark;

/**
 * Release-notes reader, opened from Profile → "What's new". Shows the notes
 * for the installed version and, when GitHub has something newer, a banner
 * that hands off to the update prompt.
 */
export default function WhatsNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ version?: string }>();
  const requestedVersion = params.version || currentVersion;

  const [loading, setLoading] = useState(true);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [newer, setNewer] = useState<ReleaseInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (spinner = true) => {
    if (spinner) {
      setLoading(true);
      setFailed(false);
    }
    const [exact, latest] = await Promise.all([fetchReleaseForVersion(requestedVersion), fetchLatestRelease()]);
    // A locally built APK may have no GitHub release — fall back to latest.
    const resolved = exact ?? latest;
    setRelease(resolved);
    setNewer(latest && isNewerVersion(latest.version, currentVersion) ? latest : null);
    setFailed(!resolved);
    setLoading(false);
  }, [requestedVersion]);

  useEffect(() => {
    Promise.resolve(false).then(load);
  }, [load]);

  const pad = width >= 700 ? Spacing.five : Spacing.three;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ paddingHorizontal: pad }}>
          <ScreenHeader bracket="What’s new" />
        </View>
        {loading ? (
          <View style={styles.centered}>
            <IconBlob name="star-four-points" hue="water" size={72} />
            <ActivityIndicator color={C.water} />
            <Text style={[Type.body, { color: C.textMid }]}>Fetching release notes…</Text>
          </View>
        ) : failed ? (
          <BigMessage icon="cloud-off-outline" hue="water" title="Couldn’t load notes" text="Check your connection and try again.">
            <ChunkyButton label="Try again" icon="refresh" hue="water" onPress={() => load()} />
          </BigMessage>
        ) : (
          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: pad, paddingBottom: insets.bottom + Spacing.five }]} showsVerticalScrollIndicator={false}>
            {newer ? (
              <Tile hue="water" onPress={() => router.push(`/update?version=${newer.version}` as any)} style={styles.banner} accessibilityLabel={`Version ${newer.version} is available. Review and install.`}>
                <IconBlob name="rocket-launch" hue="water" size={44} />
                <View style={styles.flex}>
                  <Text style={[Type.controlLabel, { color: C.textHi }]}>v{newer.version} is ready</Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>You’re on v{currentVersion} — tap to update</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Hue.water.main} />
              </Tile>
            ) : null}
            <ChangelogView
              markdown={release?.notes ?? ''}
              version={release?.version}
              eyebrow={
                release && release.version === currentVersion
                  ? 'Installed'
                  : release && isNewerVersion(release.version, currentVersion)
                    ? 'Latest release'
                    : 'Release notes'
              }
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  content: { paddingTop: Spacing.three, gap: Spacing.three },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
