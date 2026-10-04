import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { LiveDot } from '@/components/ui/dots';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

const C = Colors.dark;
const L = Hue.checkin;

const STEPS: { icon: IconName; title: string; detail: string }[] = [
  { icon: 'message-text', title: 'Open Discord', detail: 'Go to the server where check-ins should be posted.' },
  { icon: 'cog', title: 'Edit the channel', detail: 'Long-press the text channel → Edit Channel.' },
  { icon: 'puzzle', title: 'Integrations → Webhooks', detail: 'Tap Integrations, then Webhooks.' },
  { icon: 'plus-circle', title: 'New webhook', detail: 'Name it “Essentials”, then Copy Webhook URL.' },
  { icon: 'content-paste', title: 'Paste & save', detail: 'Come back here, paste it and tap Save.' },
];

const mask = (url: string) => (url.length <= 45 ? url : `${url.substring(0, 35)}…••••${url.substring(url.length - 8)}`);

/** Connect the Discord channel that receives check-in photos — a status tile, the URL, and five picture steps. */
export default function DiscordScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { discordWebhookUrl, updateDiscordWebhook } = useAuth();
  const linked = !!discordWebhookUrl;

  const [url, setUrl] = useState(discordWebhookUrl ?? '');
  const [editing, setEditing] = useState(!discordWebhookUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showHelp, setShowHelp] = useState(!discordWebhookUrl);

  async function save() {
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://discord.com/api/webhooks/')) {
      Alert.alert('Check the URL', 'It should start with https://discord.com/api/webhooks/');
      return;
    }
    setSaving(true);
    try {
      await updateDiscordWebhook(trimmed);
      setEditing(false);
      Alert.alert('Connected', 'Check-ins will post to this channel.');
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not update the webhook URL.');
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!discordWebhookUrl) return;
    setTesting(true);
    try {
      const res = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '🔔 **Essentials test**\nYour check-in channel is connected! 🚀' }),
      });
      if (!res.ok) throw new Error(`Discord said ${res.status}`);
      Alert.alert('Sent!', 'Look in your Discord channel for the test message.');
    } catch (err: any) {
      Alert.alert('Test failed', `Couldn’t reach Discord: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  const enter = (d: number) => (reduceMotion ? undefined : FadeInDown.delay(d).springify().damping(18));

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket="Check-in channel" />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)} style={styles.hero}>
            <IconBlob name="forum" hue="checkin" size={88} />
            <Text style={[Type.largeTitle, { color: C.textHi }]}>Discord</Text>
            <Text style={[Type.body, styles.center, { color: C.textMid }]}>Every check-in photo is posted to your own channel.</Text>
          </Animated.View>

          <Animated.View entering={enter(80)}>
            <Tile hue={linked ? 'checkin' : null} style={styles.status}>
              {linked ? <LiveDot color={L.main} size={12} /> : <View style={[styles.offDot, { backgroundColor: C.textLow }]} />}
              <View style={styles.flex}>
                <Text style={[Type.controlLabel, { color: C.textHi }]}>{linked ? 'Connected' : 'Not connected yet'}</Text>
                {linked ? (
                  <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
                    {mask(discordWebhookUrl!)}
                  </Text>
                ) : null}
              </View>
              {linked ? <Chip icon="check-bold" label="Live" hue="checkin" solid /> : null}
            </Tile>
          </Animated.View>

          <Animated.View entering={enter(160)} layout={reduceMotion ? undefined : LinearTransition}>
            {editing ? (
              <Tile style={styles.card}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>Webhook URL</Text>
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  style={[Type.body, styles.input, { color: C.textHi, backgroundColor: C.bg }]}
                  placeholder="https://discord.com/api/webhooks/…"
                  placeholderTextColor={C.textLow}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  multiline
                />
                <View style={styles.row}>
                  {linked && (
                    <ChunkyButton
                      label="Cancel"
                      variant="soft"
                      hue="checkin"
                      size="md"
                      style={styles.flex}
                      onPress={() => {
                        setUrl(discordWebhookUrl ?? '');
                        setEditing(false);
                      }}
                    />
                  )}
                  <ChunkyButton label="Save" icon="check-bold" hue="checkin" size="md" style={styles.flex} onPress={save} loading={saving} />
                </View>
              </Tile>
            ) : (
              <View style={styles.row}>
                <ChunkyButton label="Send a test" icon="bell-ring" hue="checkin" style={styles.flex} onPress={test} loading={testing} />
                <ChunkyButton label="Change" icon="pencil" variant="soft" hue="checkin" style={styles.flex} onPress={() => setEditing(true)} />
              </View>
            )}
          </Animated.View>

          <Animated.View entering={enter(240)} layout={reduceMotion ? undefined : LinearTransition}>
            <AnimatedPressable onPress={() => setShowHelp((s) => !s)} haptic="light" style={styles.helpHead} accessibilityRole="button" accessibilityState={{ expanded: showHelp }}>
              <Text style={[Type.headline, { color: C.textHi }]}>How to get one</Text>
              <MaterialCommunityIcons name={showHelp ? 'chevron-up' : 'chevron-down'} size={26} color={C.textMid} />
            </AnimatedPressable>
            {showHelp &&
              STEPS.map((s, i) => (
                <Tile key={s.title} style={styles.step} containerStyle={styles.stepBox}>
                  <View style={[styles.num, { backgroundColor: L.main }]}>
                    <Text style={[Type.dotSmall, { color: L.on, fontSize: 16 }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[Type.controlLabel, { color: C.textHi }]}>{s.title}</Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>{s.detail}</Text>
                  </View>
                  <MaterialCommunityIcons name={s.icon} size={24} color={L.main} />
                </Tile>
              ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, gap: 12 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: 6, paddingVertical: Spacing.three },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offDot: { width: 12, height: 12, borderRadius: 6 },
  card: { gap: 12 },
  input: { borderRadius: Radius.lg, padding: 14, minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  helpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three, marginBottom: 10 },
  stepBox: { marginBottom: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
