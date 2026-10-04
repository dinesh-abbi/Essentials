import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';

import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { useAuth } from '@/contexts/AuthContext';
import { RoutineSettings } from '@/components/profile/RoutineSettings';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { SettingRow } from '@/components/ui/setting-row';
import { Sheet } from '@/components/ui/sheet';
import { BottomTabInset, Colors, Hue, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';
import { registerBlurTarget } from '@/utils/blurTarget';
import * as SyncManager from '@/utils/SyncManager';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import { checkForUpdate } from '@/utils/updates';

const C = Colors.dark;

const DISCORD_STEPS = [
  'Open Discord and go to the private channel that should receive check-ins.',
  'Long-press the channel → Edit Channel → Integrations → Webhooks.',
  'New Webhook → name it “Essentials” → Copy Webhook URL.',
  'Paste it below and save.',
];

const formatAlarmTime = (h: number, m: number) => `${h % 12 || 12}:${m < 10 ? '0' + m : m} ${h >= 12 ? 'PM' : 'AM'}`;

/**
 * "You" — One UI-style: a big centred identity block, then grouped rounded
 * cards whose rows each lead with a coloured squircle icon, so every setting
 * is found by colour and picture before its words are read. Real state only:
 * the sync row counts writes actually waiting in the queue.
 */
export default function ProfileScreen() {
  const { user, signOut, updateDisplayName, discordWebhookUrl, updateDiscordWebhook } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';

  const blurTargetRef = useRef<View>(null);
  const tabBarScrollHandler = useTabBarScrollHandler();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [discordOpen, setDiscordOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [alarmConfig, setAlarmConfig] = useState<BarcodeAlarmStorage.BarcodeAlarmConfig | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadPending = useCallback(() => {
    SyncManager.pendingCount().then(setPending);
  }, []);
  useDataRefresh(['all', 'water', 'purchases', 'upi', 'docs'], loadPending);

  useFocusEffect(
    useCallback(() => {
      registerBlurTarget(blurTargetRef);
      showTabBar();
      let cancelled = false;
      BarcodeAlarmStorage.getAlarmConfig().then((c) => !cancelled && setAlarmConfig(c));
      checkForUpdate().then((release) => !cancelled && setAvailableUpdate(release?.version ?? null));
      SyncManager.pendingCount().then((n) => !cancelled && setPending(n));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleToggleAlarm(value: boolean) {
    if (!alarmConfig) {
      router.push('/alarm/setup' as any);
      return;
    }
    if (value && !alarmConfig.barcodePayload) {
      Alert.alert('Barcode required', 'Register a barcode before turning the alarm on.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set up now', onPress: () => router.push('/alarm/setup' as any) },
      ]);
      return;
    }
    const updated = { ...alarmConfig, enabled: value };
    setAlarmConfig(updated);
    try {
      await BarcodeAlarmStorage.saveAlarmConfig(updated);
    } catch {
      Alert.alert('Error', 'Failed to update the alarm.');
      setAlarmConfig(alarmConfig);
    }
  }

  async function handleSaveWebhook() {
    const trimmed = newWebhookUrl.trim();
    if (!trimmed.startsWith('https://discord.com/api/webhooks/')) {
      Alert.alert('Check the URL', 'It should start with https://discord.com/api/webhooks/');
      return;
    }
    setSavingWebhook(true);
    try {
      await updateDiscordWebhook(trimmed);
      setDiscordOpen(false);
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not update the webhook URL.');
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleSaveName() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await updateDisplayName(trimmed);
      setIsEditingName(false);
    } catch (err: any) {
      Alert.alert('Update failed', err.message ?? 'Could not update name.');
    }
  }

  function handleSignOut() {
    Alert.alert(
      'Sign out?',
      pending > 0 ? `${pending} change(s) haven’t synced yet — they’ll upload next time you sign in on this phone.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ],
    );
  }

  async function syncNow() {
    setSyncing(true);
    await SyncManager.syncOfflineData();
    setPending(await SyncManager.pendingCount());
    setSyncing(false);
  }

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'You';
  const email = user?.email ?? '—';
  const provider = user?.providerData?.[0]?.providerId ?? 'password';
  const providerLabel = provider === 'google.com' ? 'Google' : 'Email';
  const photoUrl = user?.photoURL ?? null;
  const isLinked = !!discordWebhookUrl;
  const canEditName = provider === 'password';
  const me = Hue.profile;

  return (
    <BlurTargetView ref={blurTargetRef} style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + Spacing.five }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={tabBarScrollHandler}
          scrollEventThrottle={16}
        >
          {/* ── Identity ─────────────────────────────────────────────── */}
          <EntranceView index={0} style={styles.identity}>
            <View style={[styles.avatarRing, { borderColor: me.main }]}>
              <View style={[styles.avatar, { backgroundColor: me.soft }]}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={[Type.headline, { color: me.main }]}>{displayName.slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
            </View>

            {isEditingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  onSubmitEditing={handleSaveName}
                  autoFocus
                  returnKeyType="done"
                  style={[Type.headline, styles.nameInput, { color: C.textHi, borderBottomColor: me.main }]}
                />
                <ChunkyButton icon="check-bold" hue="profile" size="sm" onPress={handleSaveName} accessibilityLabel="Save name" />
                <ChunkyButton icon="close" variant="soft" hue="profile" size="sm" onPress={() => setIsEditingName(false)} accessibilityLabel="Cancel" />
              </View>
            ) : (
              <AnimatedPressable
                onPress={() => {
                  setNewName(displayName);
                  setIsEditingName(true);
                }}
                disabled={!canEditName}
                pressOpacity={0.7}
                style={styles.nameRow}
                accessibilityRole={canEditName ? 'button' : 'text'}
                accessibilityLabel={canEditName ? `${displayName}. Edit name` : displayName}
              >
                <Text style={[Type.largeTitle, styles.name, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
                  {displayName}
                </Text>
                {canEditName && <MaterialCommunityIcons name="pencil" size={18} color={C.textMid} />}
              </AnimatedPressable>
            )}
            <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
              {email}
            </Text>
            <View style={styles.chips}>
              <Chip icon={provider === 'google.com' ? 'google' : 'email'} label={providerLabel} hue="profile" />
              <Chip icon="tag" label={`v${currentVersion}`} />
            </View>
          </EntranceView>

          {/* ── Connected ─────────────────────────────────────────────── */}
          <EntranceView index={1}>
            <Text style={[Type.dotLabel, styles.groupLabel, { color: C.textMid }]}>Connected</Text>
            <Tile style={styles.group}>
              <SettingRow
                icon="webhook"
                hue="checkin"
                title="Check-in channel"
                value={isLinked ? 'Discord connected' : 'Not linked yet'}
                onPress={() => {
                  setNewWebhookUrl(discordWebhookUrl ?? '');
                  setDiscordOpen(true);
                }}
              />
              <SettingRow
                icon="alarm"
                hue="alarm"
                title="Barcode alarm"
                value={alarmConfig?.enabled ? formatAlarmTime(alarmConfig.hour, alarmConfig.minute) : 'Off'}
                onPress={() => router.push('/alarm/setup' as any)}
                trailing={
                  <Switch
                    value={alarmConfig?.enabled ?? false}
                    onValueChange={handleToggleAlarm}
                    trackColor={{ false: C.surface2, true: Hue.alarm.main }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Barcode alarm"
                  />
                }
              />
              <SettingRow
                icon={availableUpdate ? 'rocket-launch' : 'star-four-points'}
                hue="water"
                title={availableUpdate ? `Update to v${availableUpdate}` : 'What’s new'}
                value={availableUpdate ? 'Ready to install' : `You’re on v${currentVersion}`}
                badge={!!availableUpdate}
                onPress={() => router.push((availableUpdate ? '/update' : '/whats-new') as any)}
              />
              <SettingRow
                icon={pending === 0 ? 'cloud-check' : 'cloud-upload'}
                hue={pending === 0 ? 'fuel' : 'spend'}
                title={pending === 0 ? 'All synced' : `${pending} waiting to upload`}
                value={pending === 0 ? 'Everything is in the cloud' : 'Tap to sync now'}
                onPress={pending > 0 ? syncNow : undefined}
                trailing={syncing ? <ActivityIndicator size="small" color={Hue.spend.main} /> : undefined}
                last
              />
            </Tile>
          </EntranceView>

          {/* ── Body + routine ────────────────────────────────────────── */}
          <EntranceView index={2}>
            <RoutineSettings />
          </EntranceView>

          <EntranceView index={3} style={styles.signOut}>
            <ChunkyButton label="Sign out" icon="logout" variant="soft" hue="alarm" textColor={C.alert} onPress={handleSignOut} haptic="light" />
          </EntranceView>
        </Animated.ScrollView>

        {/* ── Discord webhook sheet ──────────────────────────────────── */}
        <Sheet
          visible={discordOpen}
          onClose={() => setDiscordOpen(false)}
          dismissable={!savingWebhook}
          bracket="Check-in · Discord"
          title={isLinked ? 'Update the webhook' : 'Connect a channel'}
          heightRatio={0.74}
        >
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[Type.body, { color: C.textMid }]}>
              Check-in photos are posted to this channel. The URL is stored on your account only.
            </Text>
            <TextInput
              value={newWebhookUrl}
              onChangeText={setNewWebhookUrl}
              placeholder="https://discord.com/api/webhooks/…"
              placeholderTextColor={C.textLow}
              autoCapitalize="none"
              autoCorrect={false}
              style={[Type.body, styles.urlInput, { color: C.textHi, backgroundColor: C.bg }]}
            />
            <View style={styles.steps}>
              {DISCORD_STEPS.map((s, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepNum, { backgroundColor: Hue.checkin.soft }]}>
                    <Text style={[Type.dotSmall, { color: Hue.checkin.main, fontSize: 15 }]}>{i + 1}</Text>
                  </View>
                  <Text style={[Type.subline, styles.flex, { color: C.textMid }]}>{s}</Text>
                </View>
              ))}
            </View>
            <ChunkyButton label="Save" icon="check-bold" hue="checkin" onPress={handleSaveWebhook} loading={savingWebhook} />
          </ScrollView>
        </Sheet>
      </SafeAreaView>
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.three, gap: 12 },
  flex: { flex: 1 },

  identity: { alignItems: 'center', gap: 6, paddingTop: Spacing.five, paddingBottom: Spacing.four },
  avatarRing: { padding: 4, borderRadius: 60, borderWidth: 3, marginBottom: 10 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', paddingHorizontal: Spacing.three },
  name: { flexShrink: 1, textAlign: 'center' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  nameInput: { flex: 1, borderBottomWidth: 2, paddingVertical: 0 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 6 },

  groupLabel: { marginLeft: 6, marginBottom: 8, marginTop: Spacing.two },
  group: { paddingVertical: 4, paddingHorizontal: 14 },
  signOut: { marginTop: Spacing.three },

  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  urlInput: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  steps: { gap: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
