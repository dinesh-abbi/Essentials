import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import ChangelogView from '@/components/ChangelogView';
import { Button } from '@/components/ui/button';
import { FontFace, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  currentVersion,
  fetchLatestRelease,
  fetchReleaseForVersion,
  isNewerVersion,
  type ReleaseInfo,
} from '@/utils/updates';

/**
 * Release-notes reader, opened from Profile → "What's New".
 *
 * Shows the notes for the *installed* version by default and, when GitHub has
 * something newer, an inline banner that hands off to the update prompt rather
 * than duplicating the download/install flow here.
 */
export default function WhatsNewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ version?: string }>();

  const requestedVersion = params.version || currentVersion;

  const [loading, setLoading] = useState(true);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [newerRelease, setNewerRelease] = useState<ReleaseInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    const [exact, latest] = await Promise.all([
      fetchReleaseForVersion(requestedVersion),
      fetchLatestRelease(),
    ]);

    // Fall back to the latest release when this exact version has no GitHub
    // release — e.g. a locally-built APK whose version was never published.
    const resolved = exact ?? latest;
    setRelease(resolved);
    setNewerRelease(
      latest && isNewerVersion(latest.version, currentVersion) ? latest : null
    );
    setFailed(!resolved);
    setLoading(false);
  }, [requestedVersion]);

  useEffect(() => {
    load();
  }, [load]);

  const horizontalPadding = width >= 700 ? Spacing.five : Spacing.four;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingHorizontal: horizontalPadding, borderBottomColor: theme.hairline }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>What's New</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.signal} />
            <Text style={[styles.centeredText, { color: theme.textSecondary }]}>
              Fetching release notes…
            </Text>
          </View>
        ) : failed ? (
          <View style={styles.centered}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
              <Feather name="cloud-off" size={22} color={theme.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn't load release notes</Text>
            <Text style={[styles.centeredText, { color: theme.textSecondary }]}>
              Check your connection and try again.
            </Text>
            <Button title="Retry" variant="secondary" icon="refresh-cw" onPress={load} style={{ marginTop: Spacing.three }} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingHorizontal: horizontalPadding,
                paddingBottom: insets.bottom + Spacing.five,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Newer-version banner — routes to the prompt that owns installing. */}
            {newerRelease ? (
              <TouchableOpacity
                onPress={() => router.push(`/update?version=${newerRelease.version}` as any)}
                activeOpacity={0.85}
                style={[styles.banner, { backgroundColor: theme.signalWeak, borderColor: theme.signalLine }]}
              >
                <Feather name="download-cloud" size={18} color={theme.signal} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerTitle, { color: theme.text }]}>
                    Version {newerRelease.version} is available
                  </Text>
                  <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
                    You're on v{currentVersion} — tap to review and install.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={theme.signal} />
              </TouchableOpacity>
            ) : null}

            <ChangelogView
              markdown={release?.notes ?? ''}
              version={release?.version}
              eyebrow={
                release && release.version === currentVersion
                  ? 'Currently installed'
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
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Type.title,
  },
  content: {
    paddingTop: Spacing.four,
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.four,
  },
  bannerTitle: {
    fontSize: 14,
    fontFamily: FontFace.bold,
    letterSpacing: -0.2,
  },
  bannerSub: {
    ...Type.body,
    fontSize: 12,
    fontFamily: FontFace.regular,
    marginTop: 1,
  },
});
