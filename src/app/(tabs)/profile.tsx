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
  triggerHourlyWaterReminderTest,
  triggerWaterGoalNotification,
  isOneMinuteReminderEnabled,
  setOneMinuteReminderEnabled,
  scheduleHourlyWaterReminder,
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
  const { user, signOut, updateDisplayName } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isOneMinuteEnabled, setIsOneMinuteEnabled] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const enabled = await isOneMinuteReminderEnabled();
      setIsOneMinuteEnabled(enabled);
    }
    loadSettings();
  }, []);

  const handleToggleOneMinute = async (value: boolean) => {
    try {
      await setOneMinuteReminderEnabled(value);
      await scheduleHourlyWaterReminder(true); // force reschedule to apply changes immediately
      setIsOneMinuteEnabled(value);
      Alert.alert(
        'Success',
        value
          ? '1-Minute Hydration Reminders enabled! You should receive them every minute now.'
          : 'Hourly Hydration Reminders restored.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update reminder settings.');
    }
  };

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

          {/* ── Notification Testing ─────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <View style={[styles.section, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATION TESTING</Text>
              
              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name="clock" size={15} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowValue, { color: colors.text }]}>1-Minute Reminders</Text>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Trigger notifications every 1 min (Test Mode)</Text>
                </View>
                <Switch
                  value={isOneMinuteEnabled}
                  onValueChange={handleToggleOneMinute}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={Platform.OS === 'android' ? (isOneMinuteEnabled ? colors.primary : '#f4f3f4') : undefined}
                />
              </View>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await triggerHourlyWaterReminderTest();
                    Alert.alert('Success', 'Hourly reminder notification triggered! You should receive it in a second.');
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to trigger notification.');
                  }
                }}
                style={[styles.row, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name="bell" size={15} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowValue, { color: colors.text }]}>Test Hydration Reminder</Text>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Trigger reminder popup immediately</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await triggerWaterGoalNotification();
                    Alert.alert('Success', 'Goal reached notification triggered! You should receive it in a second.');
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to trigger notification.');
                  }
                }}
                style={[styles.row, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name="award" size={15} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowValue, { color: colors.text }]}>Test Goal Reached</Text>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Trigger goal milestone popup immediately</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Sign Out ────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
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
