import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { BlurTargetView } from 'expo-blur';

import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { BottomTabInset, Colors, FontFace, MaxContentWidth, Motion, Radius, Spacing, Type } from '@/constants/theme';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';
import { registerBlurTarget } from '@/utils/blurTarget';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import { checkForUpdate } from '@/utils/updates';

const DISCORD_STEPS = [
  {
    number: '1',
    title: 'Open Discord & Pick a Server',
    detail: 'Open the Discord app (or discord.com) and navigate to your private server or channel.',
  },
  {
    number: '2',
    title: 'Open Channel Settings',
    detail: 'Right-click or long-press the target text channel → select "Edit Channel".',
  },
  {
    number: '3',
    title: 'Go to Integrations → Webhooks',
    detail: 'Tap "Integrations", then "Webhooks".',
  },
  {
    number: '4',
    title: 'Create a New Webhook',
    detail: 'Tap "New Webhook", name it "Essentials", then tap "Copy Webhook URL".',
  },
  {
    number: '5',
    title: 'Paste Below & Save',
    detail: 'Paste the URL into the field below and tap "Save".',
  },
];

const formatAlarmTime = (h: number, m: number) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? '0' + m : m;
  return `${hour12}:${minStr} ${ampm}`;
};

export default function ProfileScreen() {
  const { user, signOut, updateDisplayName, discordWebhookUrl, updateDiscordWebhook } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const currentVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';

  const blurTargetRef = useRef<View>(null);
  useFocusEffect(
    useCallback(() => {
      registerBlurTarget(blurTargetRef);
      showTabBar();
    }, [])
  );

  const tabBarScrollHandler = useTabBarScrollHandler();

  // Name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // Discord modal state
  const [discordModalVisible, setDiscordModalVisible] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Barcode alarm state
  const [alarmConfig, setAlarmConfig] = useState<BarcodeAlarmStorage.BarcodeAlarmConfig | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const config = await BarcodeAlarmStorage.getAlarmConfig();
        setAlarmConfig(config);
      }
      load();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      checkForUpdate().then((release) => {
        if (!cancelled) setAvailableUpdate(release?.version ?? null);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleToggleAlarm(value: boolean) {
    if (!alarmConfig) return;

    if (value && !alarmConfig.barcodePayload) {
      Alert.alert(
        'Barcode Required',
        'You need to register a barcode before enabling the alarm.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Up Now', onPress: () => router.push('/alarm/setup' as any) },
        ]
      );
      return;
    }

    const updated = { ...alarmConfig, enabled: value };
    setAlarmConfig(updated);
    try {
      await BarcodeAlarmStorage.saveAlarmConfig(updated);
    } catch (e) {
      Alert.alert('Error', 'Failed to update alarm status.');
      setAlarmConfig(alarmConfig);
    }
  }

  function maskWebhookUrl(url: string): string {
    if (url.length <= 35) return url;
    return url.substring(0, 30) + '...••••';
  }

  async function handleSaveWebhook() {
    const trimmed = newWebhookUrl.trim();
    if (!trimmed) {
      Alert.alert('URL Required', 'Please enter your Discord Webhook URL.');
      return;
    }
    if (!trimmed.startsWith('https://discord.com/api/webhooks/')) {
      Alert.alert('Invalid URL', 'The URL must start with https://discord.com/api/webhooks/');
      return;
    }
    setSavingWebhook(true);
    try {
      await updateDiscordWebhook(trimmed);
      setDiscordModalVisible(false);
      Alert.alert('Saved', 'Discord Webhook URL updated successfully.');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not update webhook URL.');
    } finally {
      setSavingWebhook(false);
    }
  }

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'User';
  const email = user?.email ?? '—';
  const provider = user?.providerData?.[0]?.providerId ?? 'password';
  const providerLabel = provider === 'google.com' ? 'Google' : 'Email / Password';
  const photoUrl = user?.photoURL ?? null;
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  async function handleSaveName() {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Empty name', 'Please enter a valid display name.');
      return;
    }
    try {
      await updateDisplayName(trimmed);
      setIsEditingName(false);
    } catch (err: any) {
      Alert.alert('Update failed', err.message ?? 'Could not update name.');
    }
  }

  const isLinked = !!discordWebhookUrl;
  const enteringAnim = reduceMotion ? undefined : FadeInDown.duration(Motion.duration.screen);

  return (
    <BlurTargetView ref={blurTargetRef} style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + insets.bottom + Spacing.five },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={tabBarScrollHandler}
          scrollEventThrottle={16}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <Animated.View entering={enteringAnim} style={styles.header}>
            <Text style={[styles.screenLabel, { color: colors.textSecondary }]}>PROFILE</Text>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Account</Text>
          </Animated.View>

          {/* ── User Hero Card (Avatar, Name, Email, Edit) ─────────────────── */}
          <Animated.View entering={enteringAnim}>
            <View style={[styles.avatarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.avatarRow}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}

                <View style={styles.avatarInfo}>
                  {isEditingName ? (
                    <View style={styles.nameEditRow}>
                      <TextInput
                        value={newName}
                        onChangeText={setNewName}
                        style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.primary }]}
                        placeholder="Enter name"
                        placeholderTextColor={colors.textSecondary}
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveName} style={[styles.inlineBtn, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={14} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setIsEditingName(false)} style={[styles.inlineBtn, { backgroundColor: colors.backgroundSelected }]}>
                        <Feather name="x" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.nameRow}>
                      <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {provider === 'password' && (
                        <TouchableOpacity
                          onPress={() => {
                            setNewName(displayName);
                            setIsEditingName(true);
                          }}
                          style={styles.editPencil}
                          activeOpacity={0.7}
                        >
                          <Feather name="edit-2" size={13} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <Text style={[styles.emailText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {email}
                  </Text>

                  <View style={[styles.providerPill, { backgroundColor: colors.backgroundSelected }]}>
                    <Text style={[styles.providerText, { color: colors.textSecondary }]}>
                      via {providerLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── 2x2 Bento Grid Layout ───────────────────────────────────────── */}
          <Animated.View entering={enteringAnim} style={styles.bentoSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APP & SERVICES</Text>

            <View style={styles.bentoGrid}>
              {/* Row 1: Discord & Barcode Alarm */}
              <View style={styles.bentoRow}>
                {/* 1. Discord Card */}
                <AnimatedPressable
                  onPress={() => {
                    setNewWebhookUrl(discordWebhookUrl ?? '');
                    setDiscordModalVisible(true);
                  }}
                  style={[
                    styles.bentoCard,
                    { backgroundColor: colors.backgroundElement, borderColor: isLinked ? '#5865F2' + '50' : colors.border },
                  ]}
                >
                  <View style={styles.bentoCardHeader}>
                    <View style={[styles.bentoIcon, { backgroundColor: '#5865F2' + '20' }]}>
                      <Feather name="message-circle" size={16} color="#5865F2" />
                    </View>
                    <View style={[styles.statusIndicator, { backgroundColor: isLinked ? colors.success : colors.textSecondary }]} />
                  </View>
                  <View style={styles.bentoCardBody}>
                    <Text style={[styles.bentoTitle, { color: colors.text }]}>Discord</Text>
                    <Text style={[styles.bentoSubtitle, { color: isLinked ? colors.success : colors.textSecondary }]} numberOfLines={1}>
                      {isLinked ? 'Connected ✓' : 'Not linked'}
                    </Text>
                  </View>
                </AnimatedPressable>

                {/* 2. Barcode Alarm Card */}
                <AnimatedPressable
                  onPress={() => router.push('/alarm/setup' as any)}
                  style={[
                    styles.bentoCard,
                    { backgroundColor: colors.backgroundElement, borderColor: alarmConfig?.enabled ? colors.primary + '50' : colors.border },
                  ]}
                >
                  <View style={styles.bentoCardHeader}>
                    <View style={[styles.bentoIcon, { backgroundColor: colors.primary + '20' }]}>
                      <Feather name="bell" size={16} color={colors.primary} />
                    </View>
                    <Switch
                      value={alarmConfig?.enabled ?? false}
                      onValueChange={handleToggleAlarm}
                      trackColor={{ false: colors.backgroundSelected, true: colors.primary + '40' }}
                      thumbColor={alarmConfig?.enabled ? colors.primary : colors.textSecondary}
                      style={{ transform: [{ scale: 0.8 }] }}
                    />
                  </View>
                  <View style={styles.bentoCardBody}>
                    <Text style={[styles.bentoTitle, { color: colors.text }]}>Alarm</Text>
                    <Text style={[styles.bentoSubtitle, { color: alarmConfig?.enabled ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
                      {alarmConfig?.enabled ? formatAlarmTime(alarmConfig.hour, alarmConfig.minute) : 'Disabled'}
                    </Text>
                  </View>
                </AnimatedPressable>
              </View>

              {/* Row 2: App Version & Cloud Sync */}
              <View style={styles.bentoRow}>
                {/* 3. App Version / What's New */}
                <AnimatedPressable
                  onPress={() => router.push('/whats-new' as any)}
                  style={[styles.bentoCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                >
                  <View style={styles.bentoCardHeader}>
                    <View style={[styles.bentoIcon, { backgroundColor: colors.signalWeak }]}>
                      <Feather name="info" size={16} color={colors.signal} />
                    </View>
                    {availableUpdate && (
                      <View style={[styles.updateDotBadge, { backgroundColor: colors.signal }]}>
                        <Text style={styles.updateDotText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.bentoCardBody}>
                    <Text style={[styles.bentoTitle, { color: colors.text }]}>Version</Text>
                    <Text style={[styles.bentoSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      v{currentVersion} • What's new
                    </Text>
                  </View>
                </AnimatedPressable>

                {/* 4. Cloud Sync Status */}
                <AnimatedPressable
                  onPress={() => {
                    Alert.alert('Cloud Sync', 'Essentials uses Firebase Auth and Firestore cloud persistence with offline caching.');
                  }}
                  style={[styles.bentoCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                >
                  <View style={styles.bentoCardHeader}>
                    <View style={[styles.bentoIcon, { backgroundColor: colors.success + '20' }]}>
                      <Feather name="cloud" size={16} color={colors.success} />
                    </View>
                    <Feather name="check-circle" size={14} color={colors.success} />
                  </View>
                  <View style={styles.bentoCardBody}>
                    <Text style={[styles.bentoTitle, { color: colors.text }]}>Cloud Sync</Text>
                    <Text style={[styles.bentoSubtitle, { color: colors.success }]} numberOfLines={1}>
                      Active & Synced
                    </Text>
                  </View>
                </AnimatedPressable>
              </View>
            </View>
          </Animated.View>

          {/* ── Sign Out Button ──────────────────────────────────────────────── */}
          <Animated.View entering={enteringAnim} style={{ marginTop: Spacing.two }}>
            <Button
              id="signout-button"
              variant="destructive"
              size="lg"
              fullWidth
              icon="log-out"
              title="Sign Out"
              onPress={handleSignOut}
            />
          </Animated.View>
        </Animated.ScrollView>

        {/* ── Discord Webhook Setup Modal ────────────────────────────────────── */}
        <Modal
          visible={discordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDiscordModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.bentoIcon, { backgroundColor: '#5865F2' + '20' }]}>
                  <Feather name="message-circle" size={18} color="#5865F2" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Discord Integration</Text>
                <TouchableOpacity onPress={() => setDiscordModalVisible(false)} style={styles.modalCloseBtn}>
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {isLinked && (
                  <View style={[styles.currentWebhookBanner, { backgroundColor: colors.backgroundSelected }]}>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>CURRENT WEBHOOK</Text>
                    <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                      {maskWebhookUrl(discordWebhookUrl!)}
                    </Text>
                  </View>
                )}

                <Text style={[styles.metaLabel, { color: colors.textSecondary, marginTop: Spacing.three }]}>
                  {isLinked ? 'UPDATE WEBHOOK URL' : 'ENTER DISCORD WEBHOOK URL'}
                </Text>
                <TextInput
                  value={newWebhookUrl}
                  onChangeText={setNewWebhookUrl}
                  style={[
                    styles.webhookInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: isDark ? '#181824' : '#F4F4FA',
                    },
                  ]}
                  placeholder="https://discord.com/api/webhooks/..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Instructions toggle */}
                <TouchableOpacity onPress={() => setShowHelp(!showHelp)} style={styles.helpToggleRow} activeOpacity={0.7}>
                  <Feather name={showHelp ? 'chevron-up' : 'help-circle'} size={14} color="#5865F2" />
                  <Text style={[styles.helpToggleLabel, { color: '#5865F2' }]}>
                    {showHelp ? 'Hide guide' : 'How to get a Webhook URL'}
                  </Text>
                </TouchableOpacity>

                {showHelp && (
                  <View style={styles.helpGuide}>
                    {DISCORD_STEPS.map((step) => (
                      <View key={step.number} style={styles.helpStepItem}>
                        <View style={[styles.helpBadge, { backgroundColor: '#5865F2' }]}>
                          <Text style={styles.helpBadgeText}>{step.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.helpStepTitle, { color: colors.text }]}>{step.title}</Text>
                          <Text style={[styles.helpStepDesc, { color: colors.textSecondary }]}>{step.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setDiscordModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={savingWebhook ? 'Saving…' : 'Save'}
                  variant="primary"
                  icon="check"
                  disabled={savingWebhook}
                  onPress={handleSaveWebhook}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    gap: 16,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingVertical: Spacing.two,
    gap: 2,
  },
  screenLabel: {
    ...Type.label,
    fontSize: 10,
    fontFamily: FontFace.regular,
    letterSpacing: 1.2,
  },
  screenTitle: {
    ...Type.display,
    fontSize: 34,
    fontFamily: FontFace.regular,
    lineHeight: 40,
  },

  // ── Avatar / User Hero Card ─────────────────────────────────────────────────
  avatarCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: 18,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontFamily: FontFace.bold,
    color: '#FFFFFF',
  },
  avatarInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    ...Type.title,
    fontSize: 19,
    fontFamily: FontFace.regular,
  },
  editPencil: {
    padding: 4,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFace.semibold,
    borderBottomWidth: 1.5,
    paddingVertical: 2,
  },
  inlineBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emailText: {
    ...Type.body,
    fontSize: 13,
    fontFamily: FontFace.regular,
  },
  providerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  providerText: {
    ...Type.label,
    fontSize: 10,
    fontFamily: FontFace.regular,
  },

  // ── Bento Grid ──────────────────────────────────────────────────────────────
  bentoSection: {
    gap: 10,
  },
  sectionTitle: {
    ...Type.label,
    fontSize: 10,
    fontFamily: FontFace.regular,
    letterSpacing: 1.2,
    paddingLeft: 2,
  },
  bentoGrid: {
    gap: 12,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 14,
    minHeight: 108,
    justifyContent: 'space-between',
  },
  bentoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  updateDotBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  updateDotText: {
    fontSize: 9,
    fontFamily: FontFace.bold,
    color: '#FFF',
  },
  bentoCardBody: {
    gap: 2,
    marginTop: 8,
  },
  bentoTitle: {
    ...Type.title,
    fontSize: 15,
    fontFamily: FontFace.regular,
  },
  bentoSubtitle: {
    ...Type.body,
    fontSize: 11,
    fontFamily: FontFace.regular,
  },

  // ── Modal Styles ────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...Type.title,
    fontSize: 17,
    fontFamily: FontFace.regular,
    flex: 1,
    marginLeft: 10,
  },
  modalCloseBtn: {
    padding: 6,
  },
  currentWebhookBanner: {
    padding: 10,
    borderRadius: Radius.md,
    gap: 2,
    marginTop: 6,
  },
  metaLabel: {
    ...Type.label,
    fontSize: 10,
    fontFamily: FontFace.regular,
  },
  metaValue: {
    ...Type.body,
    fontSize: 12,
    fontFamily: FontFace.regular,
  },
  webhookInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: FontFace.regular,
    marginTop: 6,
  },
  helpToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 4,
  },
  helpToggleLabel: {
    fontSize: 12,
    fontFamily: FontFace.bold,
  },
  helpGuide: {
    marginTop: 8,
    gap: 10,
  },
  helpStepItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  helpBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  helpBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: FontFace.bold,
  },
  helpStepTitle: {
    fontSize: 12,
    fontFamily: FontFace.bold,
  },
  helpStepDesc: {
    fontSize: 11,
    fontFamily: FontFace.regular,
    lineHeight: 15,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
});
