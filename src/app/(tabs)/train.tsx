import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Plant from '@/components/illustrations/Plant';
import Skeleton from '@/components/SkeletonLoader';
import { AnatomySheet } from '@/components/training/AnatomySheet';
import { ExerciseRow } from '@/components/training/ExerciseRow';
import { WeekStrip } from '@/components/training/WeekStrip';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { EntranceView } from '@/components/ui/entrance-view';
import { HeaderIconButton } from '@/components/ui/screen-header';
import {
  BottomTabInset,
  Colors,
  FontFace,
  MaxContentWidth,
  Radius,
  Spacing,
  Type,
} from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as Coach from '@/utils/Coach';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import * as Training from '@/utils/TrainingStorage';

type Palette = typeof Colors.dark;

const TEMPO_DISMISSED = '@essentials_tempo_note_dismissed';

export default function TrainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;
  const scrollHandler = useTabBarScrollHandler();

  const [loading, setLoading] = useState(true);
  const [split, setSplit] = useState<{ days: Training.TrainingDay[]; isCustom: boolean }>({
    days: Training.DEFAULT_SPLIT,
    isCustom: false,
  });
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<Training.DayState | null>(null);
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState<Training.WorkoutSession[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tempoHidden, setTempoHidden] = useState(true);
  const [anatomyOpen, setAnatomyOpen] = useState(false);
  const [insight, setInsight] = useState<{ loading: boolean; text: string | null }>({ loading: false, text: null });
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [reloadTick, setReloadTick] = useState(0);
  useDataRefresh(['docs'], () => setReloadTick((n) => n + 1));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      showTabBar();
      let cancelled = false;
      (async () => {
        // Cached data paints immediately; Firestore reconciles behind it.
        const [cached, off, day, weights, tempo] = await Promise.all([
          Training.getCachedSplit(),
          Training.getScheduleOffset(),
          Training.getDayState(),
          Training.getLastWeights(),
          AsyncStorage.getItem(TEMPO_DISMISSED).catch(() => null),
        ]);
        if (cancelled) return;
        setSplit(cached);
        setOffset(off);
        setState(day);
        setLastWeights(weights);
        setTempoHidden(tempo === 'true');
        setNow(new Date());
        setLoading(false);

        const [fresh, recent] = await Promise.all([Training.getSplit(), Training.getRecentSessions()]);
        if (cancelled) return;
        setSplit(fresh);
        setSessions(recent);
      })();
      return () => {
        cancelled = true;
      };
    }, [reloadTick]),
  );

  // ── Derived ────────────────────────────────────────────────────────────────
  const slot = Training.splitSlotFor(now, offset);
  const day = Training.dayForSlot(split.days, slot);
  const exercises = day.exercises;
  const completed = state?.completed ?? {};
  const weights = state?.weights ?? {};
  const doneCount = exercises.filter((e) => completed[e.id]).length;
  const total = exercises.length;
  const loadKg = exercises.reduce((sum, e) => (!e.isCardio ? sum + (weights[e.id] || 0) : sum), 0);
  const doneDates = useMemo(() => Training.sessionDatesThisWeek(sessions, now), [sessions, now]);
  const streak = useMemo(() => Training.currentStreak(sessions, split.days, offset), [sessions, split.days, offset]);
  const isRestDay = day.isRecovery && total === 0;
  const finished = !!state?.finishedAt;

  // ── Persistence ────────────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = useCallback((mutate: (s: Training.DayState) => Training.DayState, debounce = false) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = mutate(prev);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (debounce) saveTimer.current = setTimeout(() => Training.saveDayState(next), 400);
      else Training.saveDayState(next);
      return next;
    });
  }, []);

  const toggleDone = useCallback(
    (id: string) => update((s) => ({ ...s, completed: { ...s.completed, [id]: !s.completed[id] } })),
    [update],
  );

  const setWeight = useCallback(
    (id: string, value: number) => update((s) => ({ ...s, weights: { ...s.weights, [id]: value } }), true),
    [update],
  );

  const shift = async (delta: number) => {
    const next = offset + delta;
    await Training.setScheduleOffset(next);
    setOffset(await Training.getScheduleOffset());
    rescheduleRoutineReminders().catch(() => {});
  };

  const answerCheckIn = async (when: 'morning' | 'evening', trained: boolean) => {
    update((s) => ({ ...s, [when]: trained ? 'yes' : 'no' }));
    // Not training today slides the plan back a day, so nothing gets skipped.
    if (!trained) await shift(-1);
  };

  const dismissTempo = () => {
    setTempoHidden(true);
    AsyncStorage.setItem(TEMPO_DISMISSED, 'true').catch(() => {});
  };

  const askCoach = async () => {
    setInsight({ loading: true, text: null });
    const res = await Coach.sessionInsight({
      title: day.focus,
      exercises: exercises.map((e) => ({
        name: e.name,
        isCompleted: !!completed[e.id],
        weight: weights[e.id] || 0,
        lastWeight: lastWeights[e.id],
      })),
    });
    setInsight({ loading: false, text: res.ok ? res.text : res.message });
  };

  const finish = () => {
    if (doneCount === 0) {
      Alert.alert('Nothing ticked yet', 'Mark the movements you did, then finish the session.');
      return;
    }
    const skipped = total - doneCount;
    Alert.alert(
      'Finish session?',
      skipped > 0 ? `${doneCount} of ${total} done — ${skipped} will be logged as skipped.` : `All ${total} movements done.`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            setFinishing(true);
            try {
              const log = await Training.logSession({
                title: day.focus,
                dayNumber: day.dayNumber,
                totalLoadKg: loadKg,
                exercises: exercises.map((e) => ({
                  id: e.id,
                  name: e.name,
                  isCompleted: !!completed[e.id],
                  weight: weights[e.id] || 0,
                  isCardio: e.isCardio,
                })),
              });
              await Promise.all(
                exercises.filter((e) => (weights[e.id] || 0) > 0).map((e) => Training.rememberWeight(e.id, weights[e.id])),
              );
              setLastWeights(await Training.getLastWeights());
              setSessions((prev) => [log, ...prev]);
              update((s) => ({ ...s, finishedAt: log.completedAt, evening: 'yes' }));
              router.push('/train/brief?kind=complete' as any);
            } catch (e) {
              console.error('Finish session failed', e);
              Alert.alert('Couldn’t save', 'The session wasn’t saved. Try again.');
            } finally {
              setFinishing(false);
            }
          },
        },
      ],
    );
  };

  // Morning / evening check-in, only on training days and only once each.
  const hour = now.getHours();
  const checkIn: 'morning' | 'evening' | null =
    isRestDay || finished || !state
      ? null
      : hour >= 5 && hour < 12 && state.morning === 'none'
        ? 'morning'
        : hour >= 17 && state.evening === 'none' && doneCount === 0
          ? 'evening'
          : null;

  const dayLabel = Training.WEEKDAY_SHORT[(now.getDay() + 6) % 7];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + Spacing.five }]}
        >
          {/* ── Top line ───────────────────────────────────────────────── */}
          <EntranceView index={0} style={styles.topRow}>
            <Text style={[Type.bracketLabel, { color: colors.textMid, flex: 1 }]}>
              <Text style={{ color: colors.water }}>[ TRAINING ]</Text>
              {`  ·  ${dayLabel}  ·  day ${slot} of 7`}
              {offset !== 0 ? `  ·  shifted ${offset > 0 ? '+' : ''}${offset}` : ''}
            </Text>
            <HeaderIconButton icon="calendar" accessibilityLabel="Week plan" onPress={() => router.push('/train/week' as any)} />
            <HeaderIconButton icon="message-circle" accessibilityLabel="Ask the coach" onPress={() => router.push('/coach' as any)} />
          </EntranceView>

          {/* ── Headline + hero ────────────────────────────────────────── */}
          <EntranceView index={1} style={styles.heroBlock}>
            {loading ? (
              <View style={{ gap: Spacing.three }}>
                <Skeleton width={220} height={34} />
                <Skeleton width={160} height={88} />
              </View>
            ) : isRestDay ? (
              <RestHero colors={colors} focus={day.focus} onPlan={() => router.push('/train/week' as any)} />
            ) : (
              <>
                <Text style={[styles.focus, { color: colors.textHi }]} numberOfLines={2}>
                  {day.focus}
                </Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroNumber}>
                    <AnimatedNumber value={doneCount} style={Type.hero} color={colors.textHi} height={92} />
                    <Text style={[Type.heroUnit, styles.heroUnit, { color: colors.textMid }]}>/ {total}</Text>
                  </View>
                  <View style={styles.readouts}>
                    <Readout label="LOAD" value={loadKg ? `${Math.round(loadKg).toLocaleString('en-IN')}` : '—'} unit={loadKg ? 'kg' : ''} colors={colors} />
                    <Readout label="STREAK" value={`${streak}`} unit={streak === 1 ? 'day' : 'days'} colors={colors} />
                  </View>
                </View>
                <Text style={[Type.subline, { color: colors.textMid }]}>
                  {finished
                    ? `Session logged at ${formatClock(new Date(state!.finishedAt!))}`
                    : doneCount === total
                      ? 'Every movement done — finish to log it.'
                      : `movements done today`}
                </Text>
                <SetRail total={total} done={exercises.map((e) => !!completed[e.id])} colors={colors} />
              </>
            )}
          </EntranceView>

          {/* ── Check-in ───────────────────────────────────────────────── */}
          {checkIn && (
            <EntranceView index={2} style={[styles.checkIn, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
              <Text style={[Type.bracketLabel, { color: colors.water }]}>[ CHECK-IN ]</Text>
              <Text style={[Type.body, { color: colors.textHi }]}>
                {checkIn === 'morning' ? 'Training today?' : 'Didn’t get to it today?'}
              </Text>
              <Text style={[Type.subline, { color: colors.textMid }]}>
                {checkIn === 'morning'
                  ? '“Not today” slides the whole week back a day — nothing gets skipped.'
                  : '“Missed it” moves today’s session to tomorrow.'}
              </Text>
              <View style={styles.checkInRow}>
                <PillButton
                  label={checkIn === 'morning' ? 'Not today' : 'Missed it'}
                  variant="ghost"
                  colors={colors}
                  onPress={() => answerCheckIn(checkIn, false)}
                />
                <PillButton
                  label={checkIn === 'morning' ? 'Yes, training' : 'I trained'}
                  colors={colors}
                  onPress={() => answerCheckIn(checkIn, true)}
                />
              </View>
            </EntranceView>
          )}

          {/* ── Week ──────────────────────────────────────────────────── */}
          <EntranceView index={3} style={[styles.section, { borderTopColor: colors.hairline }]}>
            <WeekStrip
              days={split.days}
              offset={offset}
              doneDates={doneDates}
              colors={colors}
              now={now}
              onPress={() => router.push('/train/week' as any)}
            />
          </EntranceView>

          {/* ── Session ───────────────────────────────────────────────── */}
          {!isRestDay && !loading && (
            <EntranceView index={4} style={[styles.section, { borderTopColor: colors.hairline }]}>
              <View style={styles.sessionHead}>
                <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ SESSION ]</Text>
                {!!day.anatomyFocus?.length && (
                  <AnimatedPressable
                    onPress={() => setAnatomyOpen(true)}
                    haptic="light"
                    pressOpacity={0.7}
                    style={styles.inlineLink}
                    accessibilityRole="button"
                    accessibilityLabel="View the muscles this session targets"
                  >
                    <Feather name="layers" size={14} color={colors.water} />
                    <Text style={[Type.controlLabel, { color: colors.water, fontSize: 14 }]}>Muscles</Text>
                  </AnimatedPressable>
                )}
              </View>

              {!tempoHidden && (
                <View style={[styles.tempo, { borderColor: colors.hairline }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ TEMPO  3 · 1 · 2 · 1 ]</Text>
                    <Text style={[Type.subline, { color: colors.textMid }]}>
                      3 s down, 1 s pause, 2 s up, 1 s squeeze — every rep.
                    </Text>
                  </View>
                  <AnimatedPressable onPress={dismissTempo} haptic="light" style={styles.tempoClose} accessibilityLabel="Hide tempo note">
                    <Feather name="x" size={16} color={colors.textMid} />
                  </AnimatedPressable>
                </View>
              )}

              {exercises.map((ex, i) => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  index={i}
                  done={!!completed[ex.id]}
                  weight={weights[ex.id] || undefined}
                  lastWeight={lastWeights[ex.id]}
                  expanded={expanded === ex.id}
                  colors={colors}
                  onToggleExpand={() => setExpanded((cur) => (cur === ex.id ? null : ex.id))}
                  onToggleDone={() => toggleDone(ex.id)}
                  onWeight={(v) => setWeight(ex.id, v)}
                />
              ))}

              {/* Coach read-out — on demand, never automatic (each call costs quota). */}
              <View style={[styles.coachNote, { borderTopColor: colors.hairline }]}>
                <View style={styles.coachHead}>
                  <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ COACH ]</Text>
                  {Coach.isConfigured() && (
                    <AnimatedPressable
                      onPress={askCoach}
                      disabled={insight.loading || doneCount === 0}
                      haptic="light"
                      pressOpacity={0.7}
                      style={[styles.inlineLink, { opacity: doneCount === 0 ? 0.45 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Get the coach's read-out on this session"
                    >
                      {insight.loading ? (
                        <ActivityIndicator size="small" color={colors.water} />
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={13} color={colors.water} />
                          <Text style={[Type.controlLabel, { color: colors.water, fontSize: 14 }]}>
                            {insight.text ? 'Again' : 'Read-out'}
                          </Text>
                        </>
                      )}
                    </AnimatedPressable>
                  )}
                </View>
                <Text style={[Type.body, { color: insight.text ? colors.textHi : colors.textMid }]}>
                  {!Coach.isConfigured()
                    ? 'Add a Gemini key to .env to get a read-out of each session.'
                    : insight.text ?? (doneCount === 0 ? 'Tick a movement or two, then ask for a read-out.' : 'Ask for a quick read-out of today’s session.')}
                </Text>
              </View>

              {!finished && (
                <AnimatedPressable
                  onPress={finish}
                  disabled={finishing}
                  haptic="medium"
                  pressOpacity={0.85}
                  style={[styles.finish, { backgroundColor: doneCount > 0 ? colors.water : colors.surface2 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Finish and log this session"
                >
                  {finishing ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <>
                      <Feather name="flag" size={17} color={doneCount > 0 ? colors.onAccent : colors.textMid} />
                      <Text style={[Type.controlLabel, { color: doneCount > 0 ? colors.onAccent : colors.textMid }]}>
                        Finish session
                      </Text>
                    </>
                  )}
                </AnimatedPressable>
              )}
            </EntranceView>
          )}

          {!loading && split.isCustom && (
            <Text style={[Type.subline, styles.footnote, { color: colors.textMid }]}>
              Running your imported split · change it in the week plan
            </Text>
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      <AnatomySheet visible={anatomyOpen} onClose={() => setAnatomyOpen(false)} focus={day.anatomyFocus ?? []} />
    </View>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

/** One segment per movement — the session as a charging bar. */
function SetRail({ total, done, colors }: { total: number; done: boolean[]; colors: Palette }) {
  if (total === 0) return null;
  return (
    <View style={styles.rail} accessible={false}>
      {done.map((d, i) => (
        <View key={i} style={[styles.railSeg, { backgroundColor: d ? colors.water : colors.surface2 }]} />
      ))}
    </View>
  );
}

function Readout({ label, value, unit, colors }: { label: string; value: string; unit: string; colors: Palette }) {
  return (
    <View style={styles.readout}>
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ {label} ]</Text>
      <Text style={[styles.readoutValue, { color: colors.textHi }]}>
        {value}
        {unit ? <Text style={[Type.subline, { color: colors.textMid }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function RestHero({ colors, focus, onPlan }: { colors: Palette; focus: string; onPlan: () => void }) {
  return (
    <View style={styles.rest}>
      <View style={{ flex: 1, gap: Spacing.two }}>
        <Text style={[styles.focus, { color: colors.textHi }]}>{focus || 'Recovery'}</Text>
        <Text style={[Type.body, { color: colors.textMid }]}>
          Muscle is built on the days you rest. Walk, stretch, eat well and drink your water.
        </Text>
        <AnimatedPressable onPress={onPlan} haptic="light" pressOpacity={0.7} style={styles.inlineLink} accessibilityRole="button">
          <Text style={[Type.controlLabel, { color: colors.water }]}>Train anyway — pick a day</Text>
          <Feather name="arrow-right" size={15} color={colors.water} />
        </AnimatedPressable>
      </View>
      <Plant size={56} color={colors.water} />
    </View>
  );
}

function PillButton({
  label,
  onPress,
  colors,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  colors: Palette;
  variant?: 'primary' | 'ghost';
}) {
  const primary = variant === 'primary';
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.85}
      style={[
        styles.pill,
        primary ? { backgroundColor: colors.water } : { borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth },
      ]}
      accessibilityRole="button"
    >
      <Text style={[Type.controlLabel, { color: primary ? colors.onAccent : colors.textHi }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const formatClock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.four + Spacing.one, paddingTop: Spacing.three },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.five },

  heroBlock: { marginBottom: Spacing.five, gap: Spacing.two },
  focus: { fontFamily: FontFace.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: Spacing.two },
  heroNumber: { flexDirection: 'row', alignItems: 'flex-end' },
  heroUnit: { marginLeft: Spacing.two, marginBottom: 14 },
  readouts: { gap: Spacing.three, alignItems: 'flex-end', marginBottom: Spacing.two },
  readout: { alignItems: 'flex-end', gap: 2 },
  readoutValue: { ...Type.readout, fontSize: 24, lineHeight: 28 },
  rail: { flexDirection: 'row', gap: 4, marginTop: Spacing.three },
  railSeg: { flex: 1, height: 6, borderRadius: 3 },

  rest: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },

  checkIn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.three + 2,
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  checkInRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.four, marginBottom: Spacing.five },
  sessionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.three },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },

  tempo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  tempoClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  coachNote: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  coachHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  finish: {
    marginTop: Spacing.five,
    height: 56,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  footnote: { textAlign: 'center' },
});

