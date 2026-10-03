import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';

import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { useAuth } from '@/contexts/AuthContext';
import { RoutineSettings } from '@/components/profile/RoutineSettings';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { EntranceView } from '@/components/ui/entrance-view';
import { Sheet } from '@/components/ui/sheet';
import { BottomTabInset, Colors, HitTarget, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';
import { registerBlurTarget } from '@/utils/blurTarget';
import * as SyncManager from '@/utils/SyncManager';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import { checkForUpdate } from '@/utils/updates';

type Palette = typeof Colors.dark;

const DISCORD_STEPS = [
  'Open Discord and go to the private channel that should receive check-ins.',
  'Long-press the channel → Edit Channel → Integrations → Webhooks.',
  'New Webhook → name it “Essentials” → Copy Webhook URL.',
  'Paste it below and save.',
];

const formatAlarmTime = (h: number, m: number) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m < 10 ? '0' + m : m} ${ampm}`;
};

/**
 * Profile, rebuilt in the house language: the person's name as the
 * headline, then a column of instrument rows — one bracket label, one
 * value, one affordance each — instead of a grid of coloured tiles. Real
 * state only: the sync row counts writes actually waiting in the queue.
 */
export default function ProfileScreen() {
  const { user, signOut, updateDisplayName, discordWebhookUrl, updateDiscordWebhook } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;
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
  const providerLabel = provider === 'google.com' ? 'Google' : 'email';
  const photoUrl = user?.photoURL ?? null;
  const initials = displayName.slice(0, 2).toUpperCase();
  const isLinked = !!discordWebhookUrl;
  const canEditName = provider === 'password';

  return (
    <BlurTargetView ref={blurTargetRef} style={[styles.root, { backgroundColor: colors.bg }]}>
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
            <Text style={[Type.bracketLabel, { color: colors.textMid }]}>
              <Text style={{ color: colors.water }}>[ PROFILE ]</Text>
              {`  ·  v${currentVersion}`}
            </Text>
            <View style={styles.identityRow}>
              <View style={styles.identityText}>
                {isEditingName ? (
                  <View style={styles.nameEditRow}>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      onSubmitEditing={handleSaveName}
                      autoFocus
                      returnKeyType="done"
                      style={[Type.headline, styles.nameInput, { color: colors.textHi, borderBottomColor: colors.water }]}
                    />
                    <RoundIcon icon="check" onPress={handleSaveName} colors={colors} filled label="Save name" />
                    <RoundIcon icon="x" onPress={() => setIsEditingName(false)} colors={colors} label="Cancel" />
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
                    <Text style={[Type.headline, styles.name, { color: colors.textHi }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {canEditName && <Feather name="edit-2" size={15} color={colors.textMid} />}
                  </AnimatedPressable>
                )}
                <Text style={[Type.subline, { color: colors.textMid }]} numberOfLines={1}>
                  {email} · via {providerLabel}
                </Text>
              </View>
              <View style={[styles.avatar, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={[Type.bracketLabel, styles.initials, { color: colors.textMid }]}>{initials}</Text>
                )}
              </View>
            </View>
          </EntranceView>

          {/* ── Services ─────────────────────────────────────────────── */}
          <EntranceView index={1} style={[styles.rows, { borderTopColor: colors.hairline }]}>
            <Row
              bracket="[ CHECK-IN ]"
              title="Discord webhook"
              value={isLinked ? 'Connected' : 'Not linked'}
              accent={isLinked}
              colors={colors}
              onPress={() => {
                setNewWebhookUrl(discordWebhookUrl ?? '');
                setDiscordOpen(true);
              }}
            />
            <Row
              bracket="[ ALARM ]"
              title={alarmConfig?.enabled ? `Barcode alarm · ${formatAlarmTime(alarmConfig.hour, alarmConfig.minute)}` : 'Barcode alarm'}
              value={alarmConfig?.enabled ? 'On' : 'Off'}
              accent={!!alarmConfig?.enabled}
              colors={colors}
              onPress={() => router.push('/alarm/setup' as any)}
              trailing={
                <Switch
                  value={alarmConfig?.enabled ?? false}
                  onValueChange={handleToggleAlarm}
                  trackColor={{ false: colors.surface2, true: colors.signalLine }}
                  thumbColor={alarmConfig?.enabled ? colors.water : colors.textMid}
                  accessibilityLabel="Barcode alarm"
                />
              }
            />
            <Row
              bracket="[ VERSION ]"
              title={`v${currentVersion} · what’s new`}
              value={availableUpdate ? `v${availableUpdate} ready` : 'Up to date'}
              accent={!!availableUpdate}
              colors={colors}
              onPress={() => router.push((availableUpdate ? '/update' : '/whats-new') as any)}
            />
            <Row
              bracket="[ SYNC ]"
              title={pending === 0 ? 'Everything is in the cloud' : `${pending} change${pending === 1 ? '' : 's'} waiting to upload`}
              value={pending === 0 ? 'Synced' : 'Sync now'}
              accent={pending > 0}
              colors={colors}
              onPress={pending > 0 ? syncNow : undefined}
              trailing={syncing ? <ActivityIndicator size="small" color={colors.water} /> : undefined}
              last
            />
          </EntranceView>

          {/* ── Training & fuel settings (Catalyst merge) ─────────────── */}
          <EntranceView index={2} style={styles.block}>
            <RoutineSettings />
          </EntranceView>

          <EntranceView index={3}>
            <AnimatedPressable
              onPress={handleSignOut}
              haptic="light"
              pressOpacity={0.7}
              style={[styles.signOut, { borderColor: colors.hairline }]}
              accessibilityRole="button"
            >
              <Feather name="log-out" size={16} color={colors.alert} />
              <Text style={[Type.controlLabel, { color: colors.alert }]}>Sign out</Text>
            </AnimatedPressable>
          </EntranceView>
        </Animated.ScrollView>

        {/* ── Discord webhook sheet ──────────────────────────────────── */}
        <Sheet
          visible={discordOpen}
          onClose={() => setDiscordOpen(false)}
          dismissable={!savingWebhook}
          bracket="[ CHECK-IN · DISCORD ]"
          title={isLinked ? 'Update the webhook' : 'Connect a channel'}
          heightRatio={0.72}
        >
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[Type.body, { color: colors.textMid }]}>
              Check-in photos are posted to this channel. The URL is stored on your account only.
            </Text>
            <TextInput
              value={newWebhookUrl}
              onChangeText={setNewWebhookUrl}
              placeholder="https://discord.com/api/webhooks/…"
              placeholderTextColor={colors.textLow}
              autoCapitalize="none"
              autoCorrect={false}
              style={[Type.body, styles.urlInput, { color: colors.textHi, borderColor: colors.hairline, backgroundColor: colors.surface }]}
            />
            <View style={styles.steps}>
              {DISCORD_STEPS.map((s, i) => (
                <View key={i} style={styles.step}>
                  <Text style={[Type.badge, styles.stepNum, { color: colors.water }]}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={[Type.subline, styles.stepText, { color: colors.textMid }]}>{s}</Text>
                </View>
              ))}
            </View>
            <AnimatedPressable
              onPress={handleSaveWebhook}
              disabled={savingWebhook}
              haptic="medium"
              style={[styles.savePill, { backgroundColor: colors.water }]}
              accessibilityRole="button"
            >
              {savingWebhook ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={[Type.controlLabel, { color: colors.onAccent }]}>Save</Text>
              )}
            </AnimatedPressable>
          </ScrollView>
        </Sheet>
      </SafeAreaView>
    </BlurTargetView>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Row({
  bracket,
  title,
  value,
  accent,
  colors,
  onPress,
  trailing,
  last,
}: {
  bracket: string;
  title: string;
  value: string;
  accent: boolean;
  colors: Palette;
  onPress?: () => void;
  trailing?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={!onPress}
      haptic="light"
      pressScale={0.985}
      style={[styles.row, !last && { borderBottomColor: colors.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${title}. ${value}`}
    >
      <View style={styles.rowText}>
        <Text style={[Type.bracketLabel, { color: colors.textMid }]}>{bracket}</Text>
        <Text style={[Type.body, { color: colors.textHi }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {trailing ?? (
        <View style={styles.rowValue}>
          <Text style={[Type.subline, { color: accent ? colors.water : colors.textMid }]}>{value}</Text>
          {onPress ? <Feather name="chevron-right" size={16} color={colors.textLow} /> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

function RoundIcon({
  icon,
  onPress,
  colors,
  filled,
  label,
}: {
  icon: 'check' | 'x';
  onPress: () => void;
  colors: Palette;
  filled?: boolean;
  label: string;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      style={[
        styles.roundIcon,
        filled ? { backgroundColor: colors.water } : { borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={16} color={filled ? colors.onAccent : colors.textHi} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.four + Spacing.one, paddingTop: Spacing.three },

  identity: { gap: Spacing.three, marginBottom: Spacing.five },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  identityText: { flex: 1, gap: Spacing.one },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nameInput: { flex: 1, borderBottomWidth: 1.5, paddingVertical: 0 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  initials: { letterSpacing: 0 },
  roundIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  rows: { borderTopWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, minHeight: HitTarget + 20 },
  rowText: { flex: 1, gap: 2 },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },

  block: { marginBottom: Spacing.five },

  signOut: {
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  urlInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  steps: { gap: Spacing.two },
  step: { flexDirection: 'row', gap: Spacing.two },
  stepNum: { width: 22 },
  stepText: { flex: 1 },
  savePill: { height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
});
