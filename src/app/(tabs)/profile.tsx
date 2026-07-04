import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { useAuth } from '@/contexts/AuthContext';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';

// ── Instruction Steps (inline for Discord setup) ──────────────────────────────
const DISCORD_STEPS = [
  {
    number: '1',
    title: 'Open Discord & Pick a Server',
    detail: 'Open the Discord app (or discord.com) and navigate to the server where you want logs posted.',
  },
  {
    number: '2',
    title: 'Open Channel Settings',
    detail: 'Right-click (or long-press on mobile) the text channel → select "Edit Channel".',
  },
  {
    number: '3',
    title: 'Go to Integrations → Webhooks',
    detail: 'In the channel settings sidebar, tap "Integrations", then "Webhooks".',
  },
  {
    number: '4',
    title: 'Create a New Webhook',
    detail: 'Tap "New Webhook". Optionally rename it (e.g. "Essentials"). Then tap "Copy Webhook URL".',
  },
  {
    number: '5',
    title: 'Paste Below & Save',
    detail: 'Come back here, paste the URL in the field above, and tap "Save".',
  },
];

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
  const isDark = scheme === 'dark';
  const router = useRouter();
  const currentVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');

  // Discord panel state
  const [discordExpanded, setDiscordExpanded] = useState(false);
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  function maskWebhookUrl(url: string): string {
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

  function toggleDiscordPanel() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDiscordExpanded(!discordExpanded);
    if (!discordExpanded) {
      setNewWebhookUrl(discordWebhookUrl ?? '');
    }
  }

  function toggleHelp() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowHelp(!showHelp);
  }

  const isLinked = !!discordWebhookUrl;

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
              <Row icon="info" label="App Version" value={currentVersion} colors={colors} />
            </View>
          </Animated.View>

          {/* ── Discord Integration (Single Expandable Row) ─────────────────── */}
          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
            <View style={[styles.section, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>INTEGRATIONS</Text>

              {/* Main Discord Row — tappable to expand */}
              <TouchableOpacity
                onPress={toggleDiscordPanel}
                activeOpacity={0.7}
                style={[styles.row, { borderColor: colors.border, borderTopWidth: 0 }]}
              >
                <View style={[styles.rowIcon, { backgroundColor: '#5865F2' + '18' }]}>
                  <Feather name="message-circle" size={15} color="#5865F2" />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Discord</Text>
                  <Text
                    style={[
                      styles.rowValue,
                      { color: isLinked ? '#10B981' : isDark ? '#F59E0B' : '#D97706' },
                    ]}
                    numberOfLines={1}
                  >
                    {isLinked ? 'Connected ✓' : 'Not linked'}
                  </Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: isLinked ? '#10B981' : '#F59E0B' }]} />
                <Feather
                  name={discordExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {/* Expanded Discord Panel */}
              {discordExpanded && (
                <View style={[styles.discordPanel, { borderColor: colors.border }]}>
                  {/* Current status */}
                  {isLinked && !isEditingWebhook && (
                    <View style={styles.discordStatusRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.discordLabel, { color: colors.textSecondary }]}>WEBHOOK URL</Text>
                        <Text style={[styles.discordValue, { color: colors.text }]} numberOfLines={1}>
                          {maskWebhookUrl(discordWebhookUrl!)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setNewWebhookUrl(discordWebhookUrl ?? '');
                          setIsEditingWebhook(true);
                        }}
                        style={[styles.discordActionBtn, { backgroundColor: '#5865F2' + '18' }]}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={13} color="#5865F2" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Edit / Add mode */}
                  {(isEditingWebhook || !isLinked) && (
                    <View style={styles.discordEditBlock}>
                      <Text style={[styles.discordLabel, { color: colors.textSecondary }]}>
                        {isLinked ? 'UPDATE WEBHOOK URL' : 'ENTER YOUR WEBHOOK URL'}
                      </Text>
                      <TextInput
                        value={newWebhookUrl}
                        onChangeText={setNewWebhookUrl}
                        style={[
                          styles.discordInput,
                          {
                            color: colors.text,
                            borderColor: '#5865F2' + '50',
                            backgroundColor: isDark ? '#1C1C2E' : '#F0F0FF',
                          },
                        ]}
                        placeholder="https://discord.com/api/webhooks/..."
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                      <View style={styles.discordBtnRow}>
                        <TouchableOpacity
                          onPress={handleSaveWebhook}
                          disabled={savingWebhook}
                          style={[styles.discordSaveBtn, { backgroundColor: '#5865F2', opacity: savingWebhook ? 0.6 : 1 }]}
                          activeOpacity={0.8}
                        >
                          <Feather name="check" size={14} color="#FFFFFF" />
                          <Text style={styles.discordSaveBtnText}>
                            {savingWebhook ? 'Saving...' : 'Save'}
                          </Text>
                        </TouchableOpacity>
                        {isLinked && isEditingWebhook && (
                          <TouchableOpacity
                            onPress={() => setIsEditingWebhook(false)}
                            style={[styles.discordCancelBtn, { backgroundColor: colors.backgroundSelected }]}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.discordCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Help toggle */}
                  <TouchableOpacity onPress={toggleHelp} activeOpacity={0.7} style={styles.helpToggle}>
                    <Feather name={showHelp ? 'chevron-up' : 'help-circle'} size={14} color={colors.textSecondary} />
                    <Text style={[styles.helpToggleText, { color: colors.primary }]}>
                      {showHelp ? 'Hide instructions' : 'How to get a Webhook URL'}
                    </Text>
                  </TouchableOpacity>

                  {/* Inline help steps */}
                  {showHelp && (
                    <View style={styles.helpSteps}>
                      {DISCORD_STEPS.map((step, idx) => (
                        <View
                          key={step.number}
                          style={[
                            styles.helpStepRow,
                            {
                              borderBottomWidth: idx < DISCORD_STEPS.length - 1 ? StyleSheet.hairlineWidth : 0,
                              borderBottomColor: colors.border,
                            },
                          ]}
                        >
                          <View style={[styles.helpStepBadge, { backgroundColor: '#5865F2' }]}>
                            <Text style={styles.helpStepBadgeText}>{step.number}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[styles.helpStepTitle, { color: colors.text }]}>{step.title}</Text>
                            <Text style={[styles.helpStepDetail, { color: colors.textSecondary }]}>
                              {step.detail}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
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

  // ── Discord Panel ───────────────────────────────────────────────────────────
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  discordPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 14,
  },
  discordStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discordLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  discordValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  discordActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discordEditBlock: {
    gap: 8,
  },
  discordInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: '400',
  },
  discordBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  discordSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  discordSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  discordCancelBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discordCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helpToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  helpToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helpSteps: {
    gap: 0,
    marginTop: 4,
  },
  helpStepRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  helpStepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  helpStepBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  helpStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  helpStepDetail: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
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
