import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Skeleton from '@/components/SkeletonLoader';
import { BodyMap } from '@/components/training/BodyMap';
import { ExerciseRow } from '@/components/training/ExerciseRow';
import { MusclesSheet } from '@/components/training/MusclesSheet';
import { WeekStrip } from '@/components/training/WeekStrip';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { DotMeter } from '@/components/ui/dots';
import { EntranceView } from '@/components/ui/entrance-view';
import { LargeHeader } from '@/components/ui/large-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import { BottomTabInset, Colors, Hue, MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import { catalogFor, musclesFor } from '@/utils/ExerciseCatalog';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import * as Training from '@/utils/TrainingStorage';
import { normalise, plannedLoad } from '@/utils/TrainingVolume';
import { localDateKey } from '@/utils/userDocs';

const C = Colors.dark;
const TEMPO_DISMISSED = '@essentials_tempo_note_dismissed';

/**
 * Train — today's session as a ring that fills as you tick moves off, the
 * week as seven circles, and each move as a chunky card with a big check.
 */
export default function TrainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [musclesOpen, setMusclesOpen] = useState(false);
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
  const finished = !!state?.finishedAt;
  const weights = useMemo(() => state?.weights ?? {}, [state?.weights]);
  const doneCount = exercises.filter((e) => completed[e.id]).length;
  const total = exercises.length;
  const storedSets = state?.sets;

  // Latest finished performance per move (matched by name across split
  // days). Before today's session is logged, today's own entry is skipped.
  const lastByMove = useMemo(() => {
    const out: Record<string, ReturnType<typeof Training.lastPerformance>> = {};
    for (const e of exercises) out[e.id] = Training.lastPerformance(sessions, e, finished ? undefined : localDateKey(now));
    return out;
  }, [sessions, exercises, finished, now]);

  /** Today's sets for a rep-based move: stored ticks, else last time / the plan. */
  const setsFor = useCallback(
    (e: Training.Exercise): Training.SetEntry[] | undefined => {
      if (!Training.isSetBased(e)) return undefined;
      const stored = storedSets?.[e.id];
      if (stored?.length) return stored;
      const last = lastByMove[e.id];
      return Training.planSets(e, last?.sets, weights[e.id] || lastWeights[e.id] || last?.weight || 0);
    },
    [storedSets, lastByMove, weights, lastWeights],
  );

  // Volume moved so far (Σ reps × kg over ticked sets).
  const loadKg = exercises.reduce((sum, e) => sum + Training.setVolume((storedSets?.[e.id] ?? []).filter((x) => x.done)), 0);
  const anySetDone = exercises.some((e) => storedSets?.[e.id]?.some((x) => x.done));
  const todayLoad = useMemo(() => plannedLoad(exercises), [exercises]);
  const todayHeat = useMemo(() => normalise(todayLoad), [todayLoad]);
  const doneDates = useMemo(() => Training.sessionDatesThisWeek(sessions, now), [sessions, now]);
  const streak = useMemo(() => Training.currentStreak(sessions, split.days, offset), [sessions, split.days, offset]);
  const isRestDay = day.isRecovery && total === 0;

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

  /** The big check: ticking a set-based move ticks (or clears) all its sets. */
  const toggleDone = useCallback(
    (id: string, sets?: Training.SetEntry[]) =>
      update((s) => {
        const on = !s.completed[id];
        return {
          ...s,
          startedAt: s.startedAt ?? (on ? Date.now() : undefined),
          completed: { ...s.completed, [id]: on },
          sets: sets ? { ...s.sets, [id]: sets.map((x) => ({ ...x, done: on })) } : s.sets,
        };
      }),
    [update],
  );

  /** Set edits and ticks; the move counts as done once every set is ticked. */
  const setSets = useCallback(
    (id: string, next: Training.SetEntry[]) =>
      update(
        (s) => ({
          ...s,
          startedAt: s.startedAt ?? (next.some((x) => x.done) ? Date.now() : undefined),
          sets: { ...s.sets, [id]: next },
          completed: { ...s.completed, [id]: next.length > 0 && next.every((x) => x.done) },
        }),
        true,
      ),
    [update],
  );

  const setWeight = useCallback(
    (id: string, value: number) => update((s) => ({ ...s, weights: { ...s.weights, [id]: value } }), true),
    [update],
  );

  const shift = async (delta: number) => {
    await Training.setScheduleOffset(offset + delta);
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

  const finish = () => {
    if (doneCount === 0 && !anySetDone) {
      Alert.alert('Nothing ticked yet', 'Tick the moves you did, then finish.');
      return;
    }
    const skipped = total - doneCount;
    Alert.alert(
      'Finish workout?',
      skipped > 0 ? `${doneCount} of ${total} done — ${skipped} will be logged as skipped.` : `All ${total} moves done. Nice!`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            setFinishing(true);
            try {
              const logged: Training.SessionExercise[] = exercises.map((e) => {
                const sets = Training.isSetBased(e)
                  ? (setsFor(e) ?? []).filter((x) => x.done).map(({ reps, weight }) => ({ reps, weight }))
                  : undefined;
                return {
                  id: e.id,
                  name: e.name,
                  isCompleted: !!completed[e.id] || !!sets?.length,
                  weight: sets?.length ? Math.max(...sets.map((x) => x.weight)) : weights[e.id] || 0,
                  isCardio: e.isCardio,
                  catalogId: e.catalogId,
                  muscles: musclesFor(e),
                  sets: sets?.length ? sets : undefined,
                };
              });
              const started = state?.startedAt;
              const log = await Training.logSession({
                title: day.focus,
                dayNumber: day.dayNumber,
                totalLoadKg: logged.reduce((sum, e) => sum + Training.setVolume(e.sets ?? []), 0),
                minutes: started ? Math.min(600, Math.max(1, Math.round((Date.now() - started) / 60_000))) : undefined,
                exercises: logged,
              });
              await Promise.all(logged.filter((e) => e.weight > 0).map((e) => Training.rememberWeight(e.id, e.weight)));
              setLastWeights(await Training.getLastWeights());
              setSessions((prev) => [log, ...prev]);
              update((s) => ({ ...s, finishedAt: log.completedAt, evening: 'yes' }));
              router.push('/train/brief?kind=complete' as any);
            } catch (e) {
              console.error('Finish session failed', e);
              Alert.alert('Couldn’t save', 'The workout wasn’t saved. Try again.');
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
  const train = Hue.train;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + Spacing.five }]}
        >
          <EntranceView index={0}>
            <LargeHeader
              eyebrow={`${dayLabel} · day ${slot}/7${offset !== 0 ? ` · moved ${offset > 0 ? '+' : ''}${offset}` : ''}`}
              title="Train"
              right={
                <ChunkyButton
                  icon="calendar-week"
                  variant="soft"
                  hue="train"
                  size="md"
                  haptic="light"
                  onPress={() => router.push('/train/week' as any)}
                  accessibilityLabel="Week plan"
                />
              }
            />
          </EntranceView>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <EntranceView index={1}>
            {loading ? (
              <Skeleton width="100%" height={180} borderRadius={28} />
            ) : isRestDay ? (
              <Tile hue="train" style={styles.restFace}>
                <IconBlob name="sleep" hue="train" size={64} />
                <Text style={[Type.headline, { color: C.textHi }]}>{day.focus || 'Rest day'}</Text>
                <View style={styles.chipRow}>
                  <Chip icon="walk" label="Walk" hue="train" />
                  <Chip icon="yoga" label="Stretch" hue="train" />
                  <Chip icon="water" label="Drink" hue="water" />
                </View>
                <ChunkyButton
                  label="Train anyway"
                  icon="arm-flex"
                  variant="soft"
                  hue="train"
                  size="md"
                  onPress={() => router.push('/train/week' as any)}
                />
              </Tile>
            ) : (
              <Tile hue="train" style={styles.heroFace}>
                <ProgressRing
                  size={132}
                  stroke={15}
                  progress={total ? (finished ? 1 : doneCount / total) : 0}
                  color={train.main}
                  track={train.soft}
                >
                  {finished ? (
                    <MaterialCommunityIcons name="trophy" size={44} color={train.main} />
                  ) : (
                    <View style={styles.ringCenter}>
                      <AnimatedNumber value={doneCount} style={Type.dotHero} color={C.textHi} height={62} />
                      <Text style={[Type.dotSmall, styles.ringOf, { color: C.textMid }]}>/{total}</Text>
                    </View>
                  )}
                </ProgressRing>
                <View style={styles.heroSide}>
                  <Text style={[Type.title, { color: C.textHi }]} numberOfLines={3}>
                    {day.focus}
                  </Text>
                  <View style={styles.chipRow}>
                    <Chip icon="fire" label={`${streak} day${streak === 1 ? '' : 's'}`} hue="train" solid={streak > 0} />
                    {loadKg > 0 ? <Chip icon="weight-kilogram" label={`${Math.round(loadKg)} kg moved`} /> : null}
                  </View>
                  {Object.keys(todayLoad).length > 0 && (
                    <ChunkyButton
                      label="Muscles"
                      icon="human"
                      variant="soft"
                      hue="train"
                      size="sm"
                      haptic="light"
                      onPress={() => setMusclesOpen(true)}
                      style={styles.selfStart}
                    />
                  )}
                </View>
              </Tile>
            )}
          </EntranceView>

          {/* ── Check-in ───────────────────────────────────────────────── */}
          {checkIn && (
            <EntranceView index={2}>
              <Tile style={styles.checkFace}>
                <View style={styles.checkHead}>
                  <IconBlob name={checkIn === 'morning' ? 'weather-sunset-up' : 'weather-sunset-down'} hue="spend" size={44} />
                  <View style={styles.flex}>
                    <Text style={[Type.title, { color: C.textHi }]}>
                      {checkIn === 'morning' ? 'Training today?' : 'Skipped today?'}
                    </Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>“No” moves your week back a day</Text>
                  </View>
                </View>
                <View style={styles.checkRow}>
                  <ChunkyButton
                    label={checkIn === 'morning' ? 'Not today' : 'Yes, missed'}
                    icon="sleep"
                    variant="soft"
                    hue="train"
                    size="md"
                    style={styles.flex}
                    onPress={() => answerCheckIn(checkIn, false)}
                  />
                  <ChunkyButton
                    label={checkIn === 'morning' ? 'Let’s go!' : 'I trained'}
                    icon="arm-flex"
                    hue="train"
                    size="md"
                    style={styles.flex}
                    onPress={() => answerCheckIn(checkIn, true)}
                  />
                </View>
              </Tile>
            </EntranceView>
          )}

          {/* ── Week ──────────────────────────────────────────────────── */}
          <EntranceView index={3}>
            <WeekStrip
              days={split.days}
              offset={offset}
              doneDates={doneDates}
              colors={C}
              now={now}
              onPress={() => router.push('/train/week' as any)}
            />
          </EntranceView>

          {/* ── Library · Progress ─────────────────────────────────────── */}
          <EntranceView index={3} style={styles.bento}>
            <Tile
              hue="train"
              containerStyle={styles.flex}
              style={styles.bentoFace}
              onPress={() => router.push('/train/explore' as any)}
              haptic="light"
              accessibilityLabel="Explore muscles and exercises"
            >
              <View style={styles.bentoArt}>
                <BodyMap side="front" heat={todayHeat} plain width={34} />
              </View>
              <Text style={[Type.controlLabel, { color: C.textHi }]}>Explore</Text>
              <Text style={[Type.subline, { color: C.textMid }]}>Muscles · moves</Text>
            </Tile>
            <Tile
              containerStyle={styles.flex}
              style={styles.bentoFace}
              onPress={() => router.push('/train/progress' as any)}
              haptic="light"
              accessibilityLabel="Training progress, records and goals"
            >
              <View style={styles.bentoArt}>
                <IconBlob name="chart-line" hue="train" size={44} />
              </View>
              <Text style={[Type.controlLabel, { color: C.textHi }]}>Progress</Text>
              <Text style={[Type.subline, { color: C.textMid }]}>Records · goals</Text>
            </Tile>
          </EntranceView>

          {/* ── Moves ─────────────────────────────────────────────────── */}
          {!isRestDay && !loading && (
            <EntranceView index={4} style={styles.moves}>
              <View style={styles.sectionHead}>
                <Text style={[Type.headline, { color: C.textHi }]}>Moves</Text>
                <DotMeter total={total} lit={doneCount} color={train.main} size={8} gap={4} />
              </View>

              {!tempoHidden && (
                <View style={[styles.tempo, { backgroundColor: C.surface }]}>
                  <IconBlob name="metronome" hue="train" size={36} variant="soft" />
                  <View style={styles.flex}>
                    <Text style={[Type.dotSmall, { color: C.textHi }]}>3 · 1 · 2 · 1</Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>down · hold · up · squeeze (seconds)</Text>
                  </View>
                  <AnimatedPressable onPress={dismissTempo} haptic="light" style={styles.tempoClose} accessibilityLabel="Hide tempo note">
                    <MaterialCommunityIcons name="close" size={18} color={C.textMid} />
                  </AnimatedPressable>
                </View>
              )}

              {exercises.map((ex, i) => {
                const sets = setsFor(ex);
                const info = catalogFor(ex);
                return (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    index={i}
                    done={!!completed[ex.id]}
                    weight={weights[ex.id] || undefined}
                    lastWeight={lastWeights[ex.id]}
                    sets={sets}
                    last={lastByMove[ex.id]}
                    muscles={musclesFor(ex)}
                    expanded={expanded === ex.id}
                    colors={C}
                    onToggleExpand={() => setExpanded((cur) => (cur === ex.id ? null : ex.id))}
                    onToggleDone={() => toggleDone(ex.id, sets)}
                    onWeight={(v) => setWeight(ex.id, v)}
                    onSets={(next) => setSets(ex.id, next)}
                    onInfo={info ? () => router.push(`/train/exercise/${info.id}` as any) : undefined}
                  />
                );
              })}

              {finished ? (
                <Tile hue="train" style={styles.doneFace}>
                  <MaterialCommunityIcons name="trophy" size={28} color={train.main} />
                  <Text style={[Type.controlLabel, { color: C.textHi }]}>
                    Logged at {formatClock(new Date(state!.finishedAt!))}
                  </Text>
                </Tile>
              ) : (
                <ChunkyButton
                  label="Finish workout"
                  icon="flag-checkered"
                  hue="train"
                  onPress={finish}
                  loading={finishing}
                  disabled={doneCount === 0 && !anySetDone}
                  style={styles.finish}
                />
              )}
            </EntranceView>
          )}

          {!loading && split.isCustom && (
            <Text style={[Type.subline, styles.footnote, { color: C.textMid }]}>Running your own split · change it in the week plan</Text>
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      <MusclesSheet
        visible={musclesOpen}
        onClose={() => setMusclesOpen(false)}
        load={todayLoad}
        onExplore={() => {
          setMusclesOpen(false);
          router.push('/train/explore' as any);
        }}
      />
    </View>
  );
}

const formatClock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.three, gap: 12 },
  flex: { flex: 1 },
  selfStart: { alignSelf: 'flex-start' },

  heroFace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 18 },
  ringCenter: { flexDirection: 'row', alignItems: 'flex-end' },
  ringOf: { marginBottom: 10 },
  heroSide: { flex: 1, gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  restFace: { alignItems: 'flex-start', gap: 12, paddingVertical: 20 },

  checkFace: { gap: Spacing.three },
  checkHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkRow: { flexDirection: 'row', gap: 10 },

  moves: { marginTop: Spacing.three },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tempo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, marginBottom: 12 },
  tempoClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  finish: { marginTop: Spacing.three },
  doneFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: Spacing.two },
  footnote: { textAlign: 'center' },
  bento: { flexDirection: 'row', gap: 10 },
  bentoFace: { gap: 4, paddingVertical: 14 },
  bentoArt: { height: 48, justifyContent: 'center' },
});
