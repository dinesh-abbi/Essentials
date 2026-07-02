import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/contexts/AuthContext';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/animated-pressable';

// ── Instruction Steps ─────────────────────────────────────────────────────────
const STEPS = [
  {
    number: '1',
    title: 'Open Discord & Pick a Server',
    detail: 'Open the Discord app (or discord.com) and navigate to the server where you want attendance logs to be posted.',
  },
  {
    number: '2',
    title: 'Open Channel Settings',
    detail:
      'Right-click (or long-press on mobile) the text channel you want to use → select "Edit Channel".',
  },
  {
    number: '3',
    title: 'Go to Integrations → Webhooks',
    detail:
      'In the channel settings sidebar, tap "Integrations", then tap "Webhooks".',
  },
  {
    number: '4',
    title: 'Create a New Webhook',
    detail:
      'Tap "New Webhook". You can optionally rename it (e.g. "Essentials Check-in"). Then tap "Copy Webhook URL".',
  },
  {
    number: '5',
    title: 'Paste the URL Below',
    detail:
      'Come back to this screen and paste the copied URL into the input field below, then tap "Save & Continue".',
  },
];

// ── Validation ────────────────────────────────────────────────────────────────
function isValidDiscordWebhook(url: string): boolean {
  return url.trim().startsWith('https://discord.com/api/webhooks/');
}

export default function DiscordSetupScreen() {
  const router = useRouter();
  const { updateDiscordWebhook } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = webhookUrl.trim();

    if (!trimmed) {
      Alert.alert('URL Required', 'Please paste your Discord Webhook URL to continue.');
      return;
    }

    if (!isValidDiscordWebhook(trimmed)) {
      Alert.alert(
        'Invalid URL',
        'The URL must start with https://discord.com/api/webhooks/\n\nPlease follow the steps above to get a valid webhook URL.'
      );
      return;
    }

    setSaving(true);
    try {
      await updateDiscordWebhook(trimmed);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not save your webhook URL. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Header ──────────────────────────────────────────── */}
            <Animated.View entering={FadeIn.duration(500)} style={styles.headerBlock}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#7C3AED' : '#8B5CF6' }]}>
                <Feather name="link" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Connect Discord
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                To use the Check-in feature, you need to provide a Discord Webhook URL so your attendance logs can be sent to your server.
              </Text>
            </Animated.View>

            {/* ── Steps ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.stepsContainer}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                HOW TO GET YOUR WEBHOOK URL
              </Text>

              {STEPS.map((step, idx) => (
                <View
                  key={step.number}
                  style={[
                    styles.stepRow,
                    {
                      borderBottomWidth: idx < STEPS.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.stepBadge, { backgroundColor: isDark ? '#7C3AED' : '#8B5CF6' }]}>
                    <Text style={styles.stepBadgeText}>{step.number}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                    <Text style={[styles.stepDetail, { color: colors.textSecondary }]}>
                      {step.detail}
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>

            {/* ── Input ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.inputSection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                YOUR WEBHOOK URL
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundElement,
                  },
                ]}
              >
                <Feather name="link-2" size={16} color={colors.textSecondary} />
                <TextInput
                  id="webhook-url-input"
                  style={[styles.input, { color: colors.text }]}
                  placeholder="https://discord.com/api/webhooks/..."
                  placeholderTextColor={colors.textSecondary}
                  value={webhookUrl}
                  onChangeText={setWebhookUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>

              {/* Save Button */}
              <AnimatedPressable
                id="save-webhook-btn"
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.saveBtn,
                  { backgroundColor: isDark ? '#7C3AED' : '#8B5CF6' },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.saveBtnInner}>
                    <Feather name="check-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save & Continue</Text>
                  </View>
                )}
              </AnimatedPressable>
            </Animated.View>

            {/* ── Footer hint ─────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.footer}>
              <Feather name="info" size={14} color={colors.textSecondary} />
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                This URL is stored securely in your profile. You can update it later from Settings.
              </Text>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
    gap: 28,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerBlock: {
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // ── Steps ───────────────────────────────────────────────────────────────────
  stepsContainer: {
    gap: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stepDetail: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },

  // ── Input ───────────────────────────────────────────────────────────────────
  inputSection: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  saveBtn: {
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
