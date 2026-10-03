import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { Colors, FontFace, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import * as Body from '@/utils/BodyStorage';
import * as Coach from '@/utils/Coach';
import * as Fuel from '@/utils/FuelStorage';
import * as Training from '@/utils/TrainingStorage';
import { localDateKey } from '@/utils/userDocs';
import * as WaterStorage from '@/utils/WaterStorage';

type Palette = typeof Colors.dark;

const PROMPTS = [
  'How should I warm up for today?',
  'I only have 30 minutes — trim today’s session',
  'High-protein swap for tonight’s dinner',
  'Why does tempo matter for growth?',
];

/**
 * The coach. Not a chat-app skin: the coach's words are set like an
 * editorial column — full width, no bubble, one accent rule down the side —
 * while the user's own lines sit in quiet right-aligned capsules. It knows
 * today's session, meals, water and body metrics, so answers can be specific.
 */
export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;

  const [messages, setMessages] = useState<Coach.ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [model, setModelState] = useState<Coach.CoachModel>(Coach.DEFAULT_MODEL);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [context, setContext] = useState<{ text: string; summary: string }>({ text: '', summary: '' });
  const listRef = useRef<FlatList<Coach.ChatMessage>>(null);

  useEffect(() => {
    (async () => {
      const [history, m, u, ctx] = await Promise.all([Coach.getChat(), Coach.getModel(), Coach.getUsageToday(), buildContext()]);
      setMessages(history);
      setModelState(m);
      setUsage(u);
      setContext(ctx);
    })();
  }, []);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length, thinking]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    const userMsg = makeMessage('user', text);
    const next = [...messages, userMsg];
    setMessages(next);
    setThinking(true);
    const res = await Coach.chat(next, context.text);
    const reply = makeMessage('model', res.ok ? res.text : `⚠ ${res.message}`);
    const withReply = [...next, reply];
    setMessages(withReply);
    setThinking(false);
    setUsage(await Coach.getUsageToday());
    // Failed replies aren't persisted — they'd poison the next request's history.
    Coach.saveChat(res.ok ? withReply : next);
  };

  const clear = () =>
    Alert.alert('Clear the conversation?', 'This removes the chat history on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await Coach.clearChat();
          setMessages([]);
        },
      },
    ]);

  const pickModel = async (m: Coach.CoachModel) => {
    setModelState(m);
    await Coach.setModel(m.id);
  };

  const configured = Coach.isConfigured();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.pad}>
            <ScreenHeader
              bracket="[ COACH ]"
              icon="chevron-down"
              right={messages.length > 0 ? <HeaderIconButton icon="trash-2" accessibilityLabel="Clear conversation" onPress={clear} /> : null}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.models} style={styles.modelsWrap}>
            {Coach.MODELS.map((m) => {
              const on = m.id === model.id;
              const used = usage[m.id] ?? 0;
              return (
                <AnimatedPressable
                  key={m.id}
                  onPress={() => pickModel(m)}
                  haptic="selection"
                  style={[styles.modelChip, on ? { backgroundColor: colors.surface2, borderColor: colors.water } : { borderColor: colors.hairline }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${m.name}. ${m.description} ${used} of ${m.dailyBudget} used today.`}
                >
                  <Text style={[Type.controlLabel, { fontSize: 14, color: on ? colors.textHi : colors.textMid }]}>{m.name}</Text>
                  <Text style={[Type.badge, { fontSize: 11, color: colors.textMid }]}>
                    {used}/{m.dailyBudget}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.flex}
            contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
                <Text style={[styles.emptyHeadline, { color: colors.textHi }]}>Ask anything.</Text>
                <Text style={[Type.body, { color: colors.textMid }]}>
                  {configured
                    ? context.summary || 'Training, food, recovery, habits.'
                    : 'Add EXPO_PUBLIC_GEMINI_API_KEY to .env and rebuild to switch the coach on.'}
                </Text>
                {configured && (
                  <View style={styles.prompts}>
                    {PROMPTS.map((p, i) => (
                      <Animated.View key={p} entering={FadeInDown.delay(80 + i * 60).duration(300)}>
                        <AnimatedPressable
                          onPress={() => send(p)}
                          haptic="light"
                          style={[styles.prompt, { borderColor: colors.hairline }]}
                          accessibilityRole="button"
                        >
                          <Text style={[Type.body, { color: colors.textHi, flex: 1 }]}>{p}</Text>
                          <Feather name="arrow-up-right" size={15} color={colors.water} />
                        </AnimatedPressable>
                      </Animated.View>
                    ))}
                  </View>
                )}
              </Animated.View>
            }
            renderItem={({ item }) => <Message msg={item} colors={colors} />}
            ListFooterComponent={thinking ? <Thinking colors={colors} /> : null}
          />

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.three), borderTopColor: colors.hairline }]}>
            <View style={[styles.inputWrap, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={configured ? 'Message the coach' : 'Coach not configured'}
                placeholderTextColor={colors.textLow}
                editable={configured}
                multiline
                style={[styles.input, { color: colors.textHi }]}
              />
              <AnimatedPressable
                onPress={() => send()}
                disabled={!input.trim() || thinking || !configured}
                haptic="medium"
                style={[styles.send, { backgroundColor: input.trim() && !thinking ? colors.water : colors.surface2 }]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <Feather name="arrow-up" size={18} color={input.trim() && !thinking ? colors.onAccent : colors.textMid} />
              </AnimatedPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function makeMessage(role: Coach.ChatMessage['role'], text: string): Coach.ChatMessage {
  const at = Date.now();
  return { id: `${role[0]}_${at}_${Math.random().toString(36).slice(2, 6)}`, role, text, at };
}

// ─── Message rendering ────────────────────────────────────────────────────────

function Message({ msg, colors }: { msg: Coach.ChatMessage; colors: Palette }) {
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion ? undefined : FadeInDown.duration(260);
  const time = new Date(msg.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (msg.role === 'user') {
    return (
      <Animated.View entering={entering} style={styles.userWrap}>
        <View style={[styles.userBubble, { backgroundColor: colors.surface2 }]}>
          <Text style={[Type.body, { color: colors.textHi }]}>{msg.text}</Text>
        </View>
        <Text style={[Type.subline, styles.time, { color: colors.textMid }]}>{time}</Text>
      </Animated.View>
    );
  }

  const failed = msg.text.startsWith('⚠');
  return (
    <Animated.View entering={entering} style={[styles.coachWrap, { borderLeftColor: failed ? colors.alert : colors.water }]}>
      <RichText text={failed ? msg.text.slice(2) : msg.text} colors={colors} muted={failed} />
      <View style={styles.coachMeta}>
        <Text style={[Type.subline, { color: colors.textMid }]}>{time}</Text>
        {!failed && (
          <AnimatedPressable
            onPress={() => Share.share({ message: msg.text })}
            haptic="light"
            pressOpacity={0.6}
            style={styles.shareBtn}
            accessibilityLabel="Share this answer"
          >
            <Feather name="share" size={13} color={colors.textMid} />
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

/** Just enough markdown: paragraphs, "- " / "* " / "1. " bullets and **bold**. */
function RichText({ text, colors, muted }: { text: string; colors: Palette; muted?: boolean }) {
  const blocks = useMemo(() => text.replace(/\r/g, '').split('\n'), [text]);
  const base = [Type.body, styles.richBody, { color: muted ? colors.textMid : colors.textHi }];
  return (
    <View style={styles.rich}>
      {blocks.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={i} style={{ height: 6 }} />;
        const bullet = /^([-*•]|\d+\.)\s+/.exec(trimmed);
        const content = bullet ? trimmed.slice(bullet[0].length) : trimmed.replace(/^#+\s*/, '');
        const parts = content.split('**');
        const inline = parts.map((p, j) =>
          j % 2 === 1 ? (
            <Text key={j} style={{ fontFamily: FontFace.displayBold, color: colors.textHi }}>
              {p}
            </Text>
          ) : (
            p
          ),
        );
        return bullet ? (
          <View key={i} style={styles.bulletRow}>
            <Text style={[...base, { color: colors.water, width: 18 }]}>{/^\d/.test(bullet[1]) ? bullet[1] : '–'}</Text>
            <Text style={[...base, { flex: 1 }]}>{inline}</Text>
          </View>
        ) : (
          <Text key={i} style={base}>
            {inline}
          </Text>
        );
      })}
    </View>
  );
}

function Thinking({ colors }: { colors: Palette }) {
  return (
    <View style={[styles.coachWrap, styles.thinking, { borderLeftColor: colors.water }]}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} color={colors.water} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(reduceMotion ? 0.8 : 0.25);
  useEffect(() => {
    if (reduceMotion) return;
    o.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }), withTiming(0.25, { duration: 380 })), -1),
    );
  }, [delay, reduceMotion, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

// ─── Context ──────────────────────────────────────────────────────────────────

async function buildContext(): Promise<{ text: string; summary: string }> {
  const lines: string[] = [];
  const summary: string[] = [];
  try {
    const [split, offset, state, body, waterMl, goal, start] = await Promise.all([
      Training.getCachedSplit(),
      Training.getScheduleOffset(),
      Training.getDayState(),
      Body.getBody(),
      WaterStorage.getTodayTotalMl().catch(() => 0),
      WaterStorage.getUserWaterGoal().catch(() => 0),
      Fuel.getCycleStart(),
    ]);
    const now = new Date();
    const day = Training.dayForSlot(split.days, Training.splitSlotFor(now, offset));
    const done = day.exercises.filter((e) => state.completed[e.id]).length;
    lines.push(`Date: ${now.toDateString()}, ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    lines.push(
      day.exercises.length
        ? `Today's training: ${day.focus} — ${day.exercises.map((e) => `${e.name} ${Training.prescription(e)}`).join('; ')}. Done ${done}/${day.exercises.length}.`
        : `Today is a recovery day (${day.focus}).`,
    );
    summary.push(day.exercises.length ? day.focus : 'recovery day');

    const pos = Fuel.positionFor(start);
    const plan = Fuel.planFor(pos.day);
    const logs = await Fuel.getMealLogs();
    const today = logs[localDateKey(now)];
    if (plan) {
      lines.push(
        `Meal plan (day ${pos.day}/28, vegetarian-leaning Indian home food): ` +
          Fuel.MEALS.map((m) => `${m.label}: ${plan[m.type]}${today?.meals[m.type] ? ` [${today.meals[m.type]!.status}${today.meals[m.type]!.note ? `: ${today.meals[m.type]!.note}` : ''}]` : ''}`).join('; '),
      );
      summary.push(`${Fuel.eatenCount(today)}/4 meals`);
    }
    lines.push(`Water today: ${waterMl} ml of a ${goal} ml goal.`);
    summary.push(`${waterMl.toLocaleString('en-IN')} ml water`);

    const b = [
      body.weightKg ? `weight ${body.weightKg} kg` : '',
      body.heightCm ? `height ${body.heightCm} cm` : '',
      body.age ? `age ${body.age}` : '',
      body.targetWeightKg ? `target ${body.targetWeightKg} kg` : '',
    ].filter(Boolean);
    if (b.length) lines.push(`Body: ${b.join(', ')}.`);
  } catch (e) {
    console.warn('[Coach] context build failed', e);
  }
  return {
    text: lines.join('\n'),
    summary: summary.length ? `It can see today: ${summary.join(' · ')}.` : '',
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  pad: { paddingHorizontal: Spacing.four },

  modelsWrap: { flexGrow: 0 },
  models: { paddingHorizontal: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.three },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  list: { paddingHorizontal: Spacing.four + Spacing.one, paddingTop: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.four },
  listEmpty: { flexGrow: 1, justifyContent: 'flex-end' },
  empty: { gap: Spacing.three, paddingBottom: Spacing.three },
  emptyHeadline: { fontFamily: FontFace.displayBold, fontSize: 44, lineHeight: 50, letterSpacing: -1.4 },
  prompts: { gap: Spacing.two, marginTop: Spacing.two },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  userWrap: { alignItems: 'flex-end', gap: 4 },
  userBubble: {
    maxWidth: '84%',
    borderRadius: Radius.lg,
    borderBottomRightRadius: Radius.sm - 2,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two + 4,
  },
  time: { fontSize: 11 },

  coachWrap: { borderLeftWidth: 2, paddingLeft: Spacing.three + 2, gap: Spacing.two },
  coachMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  shareBtn: { padding: 4 },
  rich: { gap: 4 },
  richBody: { fontSize: 15, lineHeight: 23 },
  bulletRow: { flexDirection: 'row' },
  thinking: { flexDirection: 'row', gap: 6, paddingVertical: Spacing.two },
  dot: { width: 7, height: 7, borderRadius: 4 },

  composer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    paddingLeft: Spacing.three + 2,
    paddingRight: 6,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  input: { ...Type.body, fontSize: 15, flex: 1, maxHeight: 130, paddingTop: 10, paddingBottom: 10 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
