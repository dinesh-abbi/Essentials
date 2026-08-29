import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontFace, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';

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
    title: 'Paste & Save',
    detail: 'Come back here, paste the URL in the field, and tap "Save Changes".',
  },
];

export default function DiscordScreen() {
  const router = useRouter();
  const { discordWebhookUrl, updateDiscordWebhook } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const [webhookUrl, setWebhookUrl] = useState(discordWebhookUrl ?? '');
  const [isEditing, setIsEditing] = useState(!discordWebhookUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showHelp, setShowHelp] = useState(!discordWebhookUrl);

  const isLinked = !!discordWebhookUrl;

  function maskWebhookUrl(url: string): string {
    if (url.length <= 45) return url;
    return url.substring(0, 35) + '...••••' + url.substring(url.length - 8);
  }

  async function handleSave() {
    const trimmed = webhookUrl.trim();
    if (!trimmed) {
      Alert.alert('URL Required', 'Please enter your Discord Webhook URL.');
      return;
    }
    if (!trimmed.startsWith('https://discord.com/api/webhooks/')) {
      Alert.alert('Invalid URL', 'The URL must start with https://discord.com/api/webhooks/');
      return;
    }
    setSaving(true);
    try {
      await updateDiscordWebhook(trimmed);
      setIsEditing(false);
      Alert.alert('Success', 'Discord Webhook URL updated successfully.');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not update webhook URL.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWebhook() {
    if (!discordWebhookUrl) return;
    setTesting(true);
    try {
      const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '🔔 **Essentials App Test Connection**\nYour Discord Integration is working perfectly! 🚀',
        }),
      });
      if (response.ok) {
        Alert.alert('Test Successful', 'A test message was sent to your Discord channel.');
      } else {
        throw new Error(`Server returned status code: ${response.status}`);
      }
    } catch (err: any) {
      Alert.alert('Test Failed', `Could not reach Discord: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  function toggleHelp() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowHelp(!showHelp);
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </AnimatedPressable>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.headerTitle}>
            INTEGRATION
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <View style={[styles.discordLogoBg, { backgroundColor: '#5865F2' }]}>
              <Feather name="message-circle" size={40} color="#FFF" />
            </View>
            <ThemedText type="subtitle" style={styles.title}>Discord Webhook</ThemedText>
            <ThemedText type="code" themeColor="textSecondary" style={styles.subtitle}>
              Receive automated push summaries, hydration alerts, and offline check-ins right in your Discord channel.
            </ThemedText>
          </Animated.View>

          {/* Connected/Not-connected Status Banner */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View
              style={[
                styles.statusBanner,
                {
                  borderColor: isLinked ? '#10B981' : colors.border,
                  backgroundColor: isLinked
                    ? '#10B98115'
                    : colors.backgroundElement,
                },
              ]}
            >
              <View style={[styles.statusIndicatorCircle, { backgroundColor: isLinked ? '#10B981' : colors.textSecondary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusText, { color: isLinked ? '#10B981' : colors.textSecondary }]}>
                  {isLinked ? 'Connected & Configured' : 'No Webhook Linked'}
                </Text>
                {isLinked && (
                  <Text style={[styles.maskedUrl, { color: colors.textSecondary }]}>
                    {maskWebhookUrl(discordWebhookUrl!)}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Configuration Input Box */}
          <Animated.View entering={FadeInDown.delay(180).duration(400)}>
            {isEditing ? (
              <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.inputLabel}>
                  WEBHOOK URL
                </ThemedText>
                <TextInput
                  value={webhookUrl}
                  onChangeText={setWebhookUrl}
                  style={[
                    styles.inputField,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.backgroundSelected,
                    },
                  ]}
                  placeholder="https://discord.com/api/webhooks/..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  multiline
                  numberOfLines={2}
                />
                <View style={styles.actionRow}>
                  <AnimatedPressable
                    onPress={handleSave}
                    disabled={saving}
                    style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Feather name="check" size={16} color="#FFF" />
                        <Text style={styles.saveBtnText}>Save Webhook</Text>
                      </>
                    )}
                  </AnimatedPressable>
                  {isLinked && (
                    <AnimatedPressable
                      onPress={() => {
                        setWebhookUrl(discordWebhookUrl ?? '');
                        setIsEditing(false);
                      }}
                      style={[styles.cancelBtn, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                    </AnimatedPressable>
                  )}
                </View>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <View style={styles.buttonStack}>
                  <AnimatedPressable
                    onPress={handleTestWebhook}
                    disabled={testing}
                    style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                  >
                    {testing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Feather name="bell" size={16} color="#FFF" />
                        <Text style={styles.actionText}>Send Test Notification</Text>
                      </>
                    )}
                  </AnimatedPressable>

                  <AnimatedPressable
                    onPress={() => setIsEditing(true)}
                    style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                  >
                    <Feather name="edit-2" size={16} color={colors.text} />
                    <Text style={[styles.actionTextSecondary, { color: colors.text }]}>Change Webhook URL</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Step-by-Step Instructions */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <TouchableOpacity onPress={toggleHelp} activeOpacity={0.7} style={styles.helpHeaderRow}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                INSTRUCTIONS
              </ThemedText>
              <Feather name={showHelp ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {showHelp && (
              <View style={[styles.helpList, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                {DISCORD_STEPS.map((step, index) => (
                  <View key={step.number} style={[styles.stepItem, { borderBottomColor: colors.border, borderBottomWidth: index < DISCORD_STEPS.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                    <View style={[styles.stepBadge, { backgroundColor: '#5865F2' }]}>
                      <Text style={styles.stepBadgeText}>{step.number}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                      <Text style={[styles.stepDetail, { color: colors.textSecondary }]}>{step.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: FontFace.bold,
    letterSpacing: 1.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  heroSection: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  discordLogoBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: FontFace.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 16,
    fontSize: 13,
    fontFamily: FontFace.regular,
    lineHeight: 19,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
  },
  statusIndicatorCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    fontFamily: FontFace.bold,
  },
  maskedUrl: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
    gap: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: FontFace.bold,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: FontFace.regular,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 12,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: FontFace.bold,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: FontFace.semibold,
  },
  buttonStack: {
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    paddingVertical: 14,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 14,
  },
  actionText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: FontFace.bold,
  },
  actionTextSecondary: {
    fontSize: 14,
    fontFamily: FontFace.bold,
  },
  helpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  helpList: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: FontFace.bold,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: FontFace.bold,
  },
  stepDetail: {
    fontSize: 12,
    fontFamily: FontFace.regular,
    lineHeight: 18,
    marginTop: 2,
  },
});
