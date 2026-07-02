import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/contexts/AuthContext';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';
import {
  // isTestModeEnabled,     // COMMENTED OUT — test mode disabled
  // setTestModeEnabled,    // COMMENTED OUT — test mode disabled
  // setupWaterReminders,   // COMMENTED OUT — test mode disabled
  getNotificationHealthStatus,
  openBatteryOptimizationSettings,
  markBatteryOptimizationDismissed,
  openExactAlarmSettings,
  ensureNotificationsScheduled,
} from '@/utils/notifications';

function Row({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: typeof Colors.light | typeof Colors.dark;
}) {
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
        <Feather name={icon as any} size={15} color={colors.textSecondary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut, updateDisplayName, discordWebhookUrl, updateDiscordWebhook } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  // const [testMode, setTestMode] = useState(false); // COMMENTED OUT — test mode disabled
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [notifHealth, setNotifHealth] = useState<{
    notificationPermission: boolean;
    batteryOptimizationDismissed: boolean;
    scheduledCount: number;
    expectedCount: number;
    isHealthy: boolean;
  } | null>(null);
  const [fixingNotifs, setFixingNotifs] = useState(false);

  useEffect(() => {
    // isTestModeEnabled().then(setTestMode); // COMMENTED OUT — test mode disabled
    refreshNotificationHealth();
  }, []);

  async function refreshNotificationHealth() {
    try {
      const health = await getNotificationHealthStatus();
      setNotifHealth(health);
    } catch (e) {
      console.error('Failed to get notification health:', e);
    }
  }

  async function handleFixNotifications() {
    setFixingNotifs(true);
    try {
      // Step 1: Ensure notifications are scheduled
      await ensureNotificationsScheduled();

      // Step 2: Open battery optimization settings on Android
      if (Platform.OS === 'android') {
        Alert.alert(
          'Optimize Notification Delivery ⚡',
          'To ensure notifications arrive exactly on time:\n\n'
          + '1. Tap "Allow" on the next screen to exempt Essentials from battery optimization.\n\n'
          + '2. This prevents Android from delaying your water reminders during Doze mode.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: async () => {
                await openBatteryOptimizationSettings();
                await markBatteryOptimizationDismissed();
                await refreshNotificationHealth();
              },
            },
          ]
        );
      }
    } catch (e) {
      console.error('Fix notifications failed:', e);
      Alert.alert('Error', 'Failed to configure notifications. Please try again.');
    } finally {
      setFixingNotifs(false);
      await refreshNotificationHealth();
    }
  }

  // COMMENTED OUT — test mode disabled
  // async function handleToggleTestMode(value: boolean) {
  //   setTestMode(value);
  //   await setTestModeEnabled(value);
  //   await setupWaterReminders();
  //   if (value) {
  //     Alert.alert(
  //       'Test Mode Enabled 💧',
  //       'Water reminders are now scheduled to fire every 1 minute with custom sound for testing purposes.'
  //     );
  //   } else {
  //     Alert.alert(
  //       'Test Mode Disabled',
  //       'Normal hourly water reminders (8:00 AM to 10:00 PM) have been restored.'
  //     );
  //   }
  // }

  function maskWebhookUrl(url: string): string {
    // Show first 40 chars + ...masked
    if (url.length <= 45) return url;
    return url.substring(0, 40) + '...••••';
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
      setIsEditingWebhook(false);
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
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Update failed', err.message ?? 'Could not update name.');
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
            <Text style={[styles.screenLabel, { color: colors.textSecondary }]}>PROFILE</Text>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Account</Text>
          </Animated.View>

          {/* ── Avatar Card ─────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={[styles.avatarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.avatarRow}>
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.avatarInfo}>
                  <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
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

          {/* ── Details ─────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <View style={[styles.section, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT DETAILS</Text>
              <Row icon="mail" label="Email" value={email} colors={colors} />
              
              {/* Dynamic Name and edit row */}
              {isEditing ? (
                <View style={[styles.editRow, { borderColor: colors.border }]}>
                  <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                    <Feather name="user" size={15} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      style={[styles.editInput, { color: colors.text, borderBottomColor: colors.primary }]}
                      placeholder="Username"
                      placeholderTextColor={colors.textSecondary}
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleSaveName} style={[styles.editBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.editBtn, { backgroundColor: colors.backgroundSelected }]} activeOpacity={0.8}>
                      <Feather name="x" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.row, { borderColor: colors.border }]}>
                  <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                    <Feather name="user" size={15} color={colors.textSecondary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Name</Text>
                    <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                  </View>
                  {provider === 'password' && (
                    <TouchableOpacity onPress={() => { setIsEditing(true); setNewName(displayName); }} style={{ padding: 6 }} activeOpacity={0.7}>
                      <Feather name="edit-2" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Notification Settings ──────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={[styles.section, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATION SETTINGS</Text>
              
              {/* COMMENTED OUT — test mode disabled
              <View style={[styles.row, { borderColor: colors.border, paddingRight: 8, borderTopWidth: 0 }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name="bell" size={15} color={colors.textSecondary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>1-Minute Reminders</Text>
                  <Text style={[styles.rowValue, { color: colors.text }]}>
                    {testMode ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                <Switch
                  value={testMode}
                  onValueChange={handleToggleTestMode}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={Platform.OS === 'android' ? (testMode ? '#FFFFFF' : '#F4F3F4') : undefined}
                />
              </View>
              */}

              {/* ── Notification Health Status ─────────────────────────────── */}
              {Platform.OS === 'android' && notifHealth && (
                <>
                  <View style={[styles.row, { borderColor: colors.border }]}>
                    <View style={[styles.rowIcon, { backgroundColor: notifHealth.isHealthy ? '#10B98120' : '#F59E0B20' }]}>
                      <Feather
                        name={notifHealth.isHealthy ? 'check-circle' : 'alert-triangle'}
                        size={15}
                        color={notifHealth.isHealthy ? '#10B981' : '#F59E0B'}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Delivery Status</Text>
                      <Text style={[styles.rowValue, { color: notifHealth.isHealthy ? '#10B981' : '#F59E0B' }]}>
                        {notifHealth.isHealthy ? 'Optimized ✓' : 'Action Needed'}
                      </Text>
                    </View>
                  </View>

                  {/* Scheduled count */}
                  <View style={[styles.row, { borderColor: colors.border }]}>
                    <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                      <Feather name="clock" size={15} color={colors.textSecondary} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Scheduled Alarms</Text>
                      <Text style={[styles.rowValue, { color: colors.text }]}>
                        {notifHealth.scheduledCount} / {notifHealth.expectedCount} active
                      </Text>
                    </View>
                  </View>

                  {/* Battery optimization status */}
                  <View style={[styles.row, { borderColor: colors.border }]}>
                    <View style={[styles.rowIcon, { backgroundColor: notifHealth.batteryOptimizationDismissed ? '#10B98120' : '#EF444420' }]}>
                      <Feather
                        name={notifHealth.batteryOptimizationDismissed ? 'battery-charging' : 'battery'}
                        size={15}
                        color={notifHealth.batteryOptimizationDismissed ? '#10B981' : '#EF4444'}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Battery Optimization</Text>
                      <Text style={[styles.rowValue, { color: notifHealth.batteryOptimizationDismissed ? '#10B981' : '#EF4444' }]}>
                        {notifHealth.batteryOptimizationDismissed ? 'Unrestricted ✓' : 'Restricted — may delay notifications'}
                      </Text>
                    </View>
                  </View>

                  {/* Fix Notifications Button */}
                  {!notifHealth.isHealthy && (
                    <TouchableOpacity
                      id="fix-notifications-button"
                      onPress={handleFixNotifications}
                      disabled={fixingNotifs}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: '#F59E0B',
                        borderRadius: Radius.md,
                        paddingVertical: 12,
                        marginTop: 8,
                        marginBottom: 8,
                        opacity: fixingNotifs ? 0.6 : 1,
                      }}
                    >
                      <Feather name="zap" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                        {fixingNotifs ? 'Fixing...' : 'Fix Notifications'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {/* ── Integrations ──────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
            <View style={[styles.section, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>INTEGRATIONS</Text>

              {isEditingWebhook ? (
                <View style={[styles.editRow, { borderColor: colors.border }]}>
                  <View style={[styles.rowIcon, { backgroundColor: '#5865F2' + '20' }]}>
                    <Feather name="link" size={15} color="#5865F2" />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Discord Webhook URL</Text>
                    <TextInput
                      value={newWebhookUrl}
                      onChangeText={setNewWebhookUrl}
                      style={[styles.editInput, { color: colors.text, borderBottomColor: '#5865F2' }]}
                      placeholder="https://discord.com/api/webhooks/..."
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      autoFocus
                    />
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={handleSaveWebhook}
                        disabled={savingWebhook}
                        style={[styles.editBtn, { backgroundColor: '#5865F2', width: 'auto' as any, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', gap: 4 }]}
                        activeOpacity={0.8}
                      >
                        <Feather name="check" size={13} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setIsEditingWebhook(false)} style={[styles.editBtn, { backgroundColor: colors.backgroundSelected }]} activeOpacity={0.8}>
                        <Feather name="x" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.row, { borderColor: colors.border, borderTopWidth: 0 }]}>
                  <View style={[styles.rowIcon, { backgroundColor: '#5865F2' + '20' }]}>
                    <Feather name="link" size={15} color="#5865F2" />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Discord Webhook</Text>
                    <Text style={[styles.rowValue, { color: discordWebhookUrl ? colors.text : colors.alert }]} numberOfLines={1}>
                      {discordWebhookUrl ? maskWebhookUrl(discordWebhookUrl) : 'Not configured'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setNewWebhookUrl(discordWebhookUrl ?? '');
                      setIsEditingWebhook(true);
                    }}
                    style={{ padding: 6 }}
                    activeOpacity={0.7}
                  >
                    <Feather name={discordWebhookUrl ? 'edit-2' : 'plus-circle'} size={14} color="#5865F2" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Link to full instructions page */}
              <TouchableOpacity
                onPress={() => router.push('/discord-setup')}
                style={[styles.row, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name="help-circle" size={15} color={colors.textSecondary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Need Help?</Text>
                  <Text style={[styles.rowValue, { color: colors.primary }]}>How to get a Webhook URL</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Sign Out ────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity
              id="signout-button"
              style={[styles.signOutBtn, { borderColor: colors.alert }]}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Feather name="log-out" size={16} color={colors.alert} />
              <Text style={[styles.signOutText, { color: colors.alert }]}>Sign Out</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    gap: 12,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingVertical: Spacing.three,
    gap: 2,
  },
  screenLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  screenTitle: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 44,
  },

  // ── Avatar card ─────────────────────────────────────────────────────────────
  avatarCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarInfo: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emailText: {
    fontSize: 13,
    fontWeight: '400',
  },
  providerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  providerText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Sections ────────────────────────────────────────────────────────────────
  section: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 0,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Dynamic Editing styles ──────────────────────────────────────────────────
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    borderBottomWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Sign out ────────────────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 15,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
