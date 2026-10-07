import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MuscleChip } from '@/components/training/MuscleChip';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, Tile } from '@/components/ui/chunky';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Colors, Hue, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { prescription, type Exercise, type LoggedSet, type SetEntry } from '@/utils/TrainingStorage';

type Palette = typeof Colors.dark;

const REST_SECONDS = 60;

/**
 * One movement in today's session, as a chunky card. Collapsed: a numbered
 * badge, the name, the prescription as chips and a big check button. When
 * done, the card takes the training hue and the badge pops into a tick.
 * Expanded: the coaching cue, then — for rep-based moves — one row per set
 * (reps × kg + a tick, pre-filled from last time, a 60 s rest ring after
 * each tick); timed and cardio moves keep a single minutes/kg stepper.
 */
export const ExerciseRow = memo(function ExerciseRow({
  exercise,
  index,
  done,
  weight,
  lastWeight,
  sets,
  last,
  muscles,
  expanded,
  colors,
  onToggleExpand,
  onToggleDone,
  onWeight,
  onSets,
  onInfo,
}: {
  exercise: Exercise;
  index: number;
  done: boolean;
  weight?: number;
  lastWeight?: number;
  /** Today's sets for rep-based moves; absent for timed / cardio moves. */
  sets?: SetEntry[];
  /** The latest finished performance of this move. */
  last?: { date: string; weight: number; sets?: LoggedSet[] } | null;
  muscles: string[];
  expanded: boolean;
  colors: Palette;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onWeight: (value: number) => void;
  onSets: (next: SetEntry[]) => void;
  /** Opens the library page when this move is in the library. */
  onInfo?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const isCardio = !!exercise.isCardio;
  const unit = isCardio ? 'min' : 'kg';
  const step = isCardio ? 5 : 2.5;
  const train = Hue.train;
  const setBased = !!sets;
  const doneSets = sets?.filter((s) => s.done).length ?? 0;

  useEffect(() => {
    if (!done || reduceMotion) return;
    pop.value = withSequence(withTiming(1.3, { duration: 110 }), withSpring(1, Motion.bouncy));
  }, [done, reduceMotion, pop]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  // ── Rest timer: starts when a set is ticked, counts down once a second ──
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!restUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= restUntil) setRestUntil(null);
    }, 1000);
    return () => clearInterval(id);
  }, [restUntil]);
  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;

  const tickSet = (i: number) => {
    if (!sets) return;
    const next = sets.map((s, j) => (j === i ? { ...s, done: !s.done } : s));
    onSets(next);
    if (!sets[i].done && next.some((s) => !s.done)) {
      setNow(Date.now());
      setRestUntil(Date.now() + REST_SECONDS * 1000);
    }
  };

  const editSet = (i: number, patch: Partial<SetEntry>) => sets && onSets(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  /** The stepper moves every set not yet ticked, like changing the plates once. */
  const shiftRemaining = (delta: number) => {
    if (!sets) return;
    onSets(sets.map((s) => (s.done ? s : { ...s, weight: Math.max(0, Math.round((s.weight + delta) * 10) / 10) })));
  };

  const useLast = () => {
    const prev = last?.sets;
    if (!sets || !prev?.length) return;
    onSets(sets.map((s, i) => (s.done ? s : { ...s, ...(prev[i] ?? prev[prev.length - 1]) })));
  };

  const addSet = () => {
    if (!sets || sets.length >= 10) return;
    const tail = sets[sets.length - 1];
    onSets([...sets, { reps: tail?.reps ?? 10, weight: tail?.weight ?? 0, done: false }]);
  };

  const removeSet = () => {
    if (!sets || sets.length <= 1 || sets[sets.length - 1].done) return;
    onSets(sets.slice(0, -1));
  };

  const openForm = () =>
    Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} proper form`)}`);

  const topWeight = setBased ? Math.max(0, ...sets!.map((s) => s.weight)) : weight;

  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.springify().damping(18)} style={styles.wrap}>
      <Tile hue={done ? 'train' : null} style={styles.face}>
        <View style={styles.head}>
          <AnimatedPressable
            onPress={onToggleExpand}
            haptic="selection"
            pressScale={0.98}
            style={styles.headMain}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${exercise.name}, ${prescription(exercise)}${done ? ', done' : ''}. ${expanded ? 'Collapse' : 'Expand'} details.`}
          >
            <Animated.View style={[styles.badge, { backgroundColor: done ? train.main : colors.surface2 }, badgeStyle]}>
              {done ? (
                <MaterialCommunityIcons name="check-bold" size={20} color={train.on} />
              ) : (
                <Text style={[Type.dotSmall, { color: colors.textHi }]}>{index + 1}</Text>
              )}
            </Animated.View>
            <View style={styles.titleCol}>
              <Text style={[styles.name, { color: colors.textHi }]} numberOfLines={expanded ? 3 : 2}>
                {exercise.name}
              </Text>
              <View style={styles.chips}>
                <Chip icon={isCardio ? 'timer-outline' : 'repeat'} label={setBased && doneSets ? `${doneSets}/${sets!.length} sets` : prescription(exercise)} />
                {topWeight ? <Chip icon="weight-kilogram" label={`${topWeight} ${unit}`} hue="train" /> : null}
              </View>
            </View>
          </AnimatedPressable>

          <ChunkyButton
            icon={done ? 'check-bold' : 'check'}
            hue="train"
            variant={done ? 'solid' : 'soft'}
            size="md"
            haptic={done ? 'light' : 'medium'}
            onPress={onToggleDone}
            accessibilityLabel={done ? `Mark ${exercise.name} not done` : `Mark ${exercise.name} done`}
          />
        </View>

        {expanded && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(Motion.duration.fast + 60)}
            exiting={reduceMotion ? undefined : FadeOut.duration(Motion.duration.fast)}
            style={styles.body}
          >
            {exercise.notes || muscles.length ? (
              <View style={[styles.cue, { backgroundColor: colors.surface2 }]}>
                {muscles.length ? <MuscleChip muscleIds={muscles} size={30} /> : null}
                {exercise.notes ? <Text style={[Type.body, styles.flex, { color: colors.textMid }]}>{exercise.notes}</Text> : <View style={styles.flex} />}
              </View>
            ) : null}

            {exercise.tempo && !isCardio ? <Chip icon="metronome" label={`Tempo ${exercise.tempo}`} /> : null}

            {setBased ? (
              <>
                {sets!.map((s, i) => (
                  <View key={i} style={styles.setRow}>
                    <View style={[styles.setNum, { backgroundColor: s.done ? train.main : colors.bg }]}>
                      <Text style={[Type.dotSmall, { color: s.done ? train.on : colors.textMid, fontSize: 16 }]}>{i + 1}</Text>
                    </View>
                    <NumField
                      value={s.reps}
                      unit="reps"
                      integer
                      colors={colors}
                      onChange={(v) => editSet(i, { reps: v })}
                      accessibilityLabel={`Reps for set ${i + 1}`}
                    />
                    <NumField
                      value={s.weight}
                      unit="kg"
                      colors={colors}
                      onChange={(v) => editSet(i, { weight: v })}
                      accessibilityLabel={`Kilograms for set ${i + 1}`}
                    />
                    <ChunkyButton
                      icon={s.done ? 'check-bold' : 'check'}
                      hue="train"
                      variant={s.done ? 'solid' : 'soft'}
                      size="md"
                      haptic={s.done ? 'light' : 'medium'}
                      onPress={() => tickSet(i)}
                      accessibilityLabel={s.done ? `Untick set ${i + 1}` : `Tick set ${i + 1}`}
                    />
                  </View>
                ))}

                {restLeft > 0 && (
                  <View style={[styles.rest, { backgroundColor: colors.bg }]}>
                    <ProgressRing size={44} stroke={6} progress={restLeft / REST_SECONDS} color={train.main} track={train.soft}>
                      <MaterialCommunityIcons name="timer-sand" size={18} color={train.main} />
                    </ProgressRing>
                    <Text style={[Type.dotNumber, styles.flex, { color: colors.textHi }]}>{restLeft}s</Text>
                    <ChunkyButton label="Skip" variant="soft" hue="train" size="sm" haptic="light" onPress={() => setRestUntil(null)} accessibilityLabel="Skip rest" />
                  </View>
                )}

                <View style={styles.loadRow}>
                  <ChunkyButton
                    icon="minus"
                    variant="soft"
                    hue="train"
                    size="md"
                    haptic="selection"
                    onPress={() => shiftRemaining(-step)}
                    accessibilityLabel={`Remaining sets ${step} kilograms lighter`}
                  />
                  <View style={styles.loadMid}>
                    <Text style={[Type.dotLabel, { color: colors.textMid }]}>Remaining sets</Text>
                  </View>
                  <ChunkyButton
                    icon="plus"
                    variant="soft"
                    hue="train"
                    size="md"
                    haptic="selection"
                    onPress={() => shiftRemaining(step)}
                    accessibilityLabel={`Remaining sets ${step} kilograms heavier`}
                  />
                </View>

                <View style={styles.actions}>
                  {last?.sets?.length ? (
                    <ChunkyButton label="Use last time" icon="history" variant="soft" hue="train" size="sm" haptic="light" onPress={useLast} />
                  ) : null}
                  <ChunkyButton icon="plus" label="Set" variant="soft" hue="train" size="sm" haptic="light" onPress={addSet} disabled={sets!.length >= 10} accessibilityLabel="Add a set" />
                  <ChunkyButton
                    icon="minus"
                    label="Set"
                    variant="soft"
                    hue="train"
                    size="sm"
                    haptic="light"
                    onPress={removeSet}
                    disabled={sets!.length <= 1 || !!sets![sets!.length - 1].done}
                    accessibilityLabel="Remove the last set"
                  />
                </View>
              </>
            ) : (
              <LoadStepper
                weight={weight}
                lastWeight={lastWeight}
                unit={unit}
                step={step}
                name={exercise.name}
                isCardio={isCardio}
                colors={colors}
                onWeight={onWeight}
              />
            )}

            {last ? (
              <Text style={[Type.subline, styles.last, { color: colors.textMid }]}>
                Last time · {describeLast(last, unit)}
              </Text>
            ) : !setBased && lastWeight ? (
              <Text style={[Type.subline, styles.last, { color: colors.textMid }]}>
                Last time: {lastWeight} {unit}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {onInfo ? <ChunkyButton label="How to" icon="human-handsup" variant="soft" hue="train" size="sm" haptic="light" onPress={onInfo} /> : null}
              <ChunkyButton label="Watch form" icon="youtube" variant="soft" hue="train" size="sm" haptic="light" onPress={openForm} />
            </View>
          </Animated.View>
        )}
      </Tile>
    </Animated.View>
  );
});

/** "3 × 10 @ 40 kg · 12 Mar" — sets grouped when they match. */
function describeLast(last: { date: string; weight: number; sets?: LoggedSet[] }, unit: string): string {
  const [y, m, d] = last.date.split('-').map(Number);
  const when = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (!last.sets?.length) return `${last.weight} ${unit} · ${when}`;
  const same = last.sets.every((s) => s.reps === last.sets![0].reps && s.weight === last.sets![0].weight);
  const body = same
    ? `${last.sets.length} × ${last.sets[0].reps} @ ${last.sets[0].weight} kg`
    : last.sets.map((s) => `${s.reps}×${s.weight}`).join(' · ') + ' kg';
  return `${body} · ${when}`;
}

/**
 * Number input that lets "42." exist mid-typing; resynced (during render, the
 * React-recommended way) only when the value changes from outside.
 */
function NumField({
  value,
  unit,
  integer = false,
  colors,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  unit: string;
  integer?: boolean;
  colors: Palette;
  onChange: (v: number) => void;
  accessibilityLabel: string;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== (parseFloat(text.replace(',', '.')) || 0)) setText(value ? String(value) : '');
  }
  return (
    <View style={[styles.numField, { backgroundColor: colors.bg }]}>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          const n = integer ? parseInt(t, 10) : parseFloat(t.replace(',', '.'));
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        placeholder="0"
        placeholderTextColor={colors.textMid}
        style={[Type.dotSmall, styles.numInput, { color: colors.textHi }]}
        accessibilityLabel={accessibilityLabel}
        selectTextOnFocus
      />
      <Text style={[Type.subline, { color: colors.textMid }]}>{unit}</Text>
    </View>
  );
}

/** The single minutes/kg stepper for timed and cardio moves. */
function LoadStepper({
  weight,
  lastWeight,
  unit,
  step,
  name,
  isCardio,
  colors,
  onWeight,
}: {
  weight?: number;
  lastWeight?: number;
  unit: string;
  step: number;
  name: string;
  isCardio: boolean;
  colors: Palette;
  onWeight: (value: number) => void;
}) {
  const [text, setText] = useState(weight ? String(weight) : '');
  const [seenWeight, setSeenWeight] = useState(weight);
  if (weight !== seenWeight) {
    setSeenWeight(weight);
    if ((weight ?? 0) !== (parseFloat(text.replace(',', '.')) || 0)) setText(weight ? String(weight) : '');
  }

  const commit = (value: number) => {
    const v = Math.max(0, Math.round(value * 10) / 10);
    setText(v ? String(v) : '');
    onWeight(v);
  };

  return (
    <View style={styles.loadRow}>
      <ChunkyButton
        icon="minus"
        variant="soft"
        hue="train"
        size="md"
        haptic="selection"
        onPress={() => commit((weight ?? lastWeight ?? 0) - step)}
        accessibilityLabel={`Decrease by ${step}`}
      />
      <View style={[styles.loadField, { backgroundColor: colors.bg }]}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            const n = parseFloat(t.replace(',', '.'));
            onWeight(Number.isFinite(n) ? n : 0);
          }}
          keyboardType="decimal-pad"
          placeholder={lastWeight ? String(lastWeight) : '0'}
          placeholderTextColor={colors.textMid}
          style={[Type.dotNumber, styles.loadInput, { color: colors.textHi }]}
          accessibilityLabel={`${isCardio ? 'Minutes' : 'Kilograms'} for ${name}`}
          selectTextOnFocus
        />
        <Text style={[Type.controlLabel, { color: colors.textMid }]}>{unit}</Text>
      </View>
      <ChunkyButton
        icon="plus"
        variant="soft"
        hue="train"
        size="md"
        haptic="selection"
        onPress={() => commit((weight ?? lastWeight ?? 0) + step)}
        accessibilityLabel={`Increase by ${step}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  face: { paddingVertical: 12, paddingLeft: 12, paddingRight: 12 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleCol: { flex: 1, gap: 6 },
  name: { ...Type.title, fontSize: 17, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  body: { paddingTop: Spacing.three, gap: 12 },
  cue: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: Radius.md, alignItems: 'flex-start' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numField: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  numInput: { minWidth: 36, textAlign: 'center', padding: 0, includeFontPadding: false },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: Radius.md },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadMid: { flex: 1, alignItems: 'center' },
  loadField: {
    flex: 1,
    height: 51,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadInput: { minWidth: 48, textAlign: 'center', padding: 0, includeFontPadding: false },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  last: { textAlign: 'center', marginTop: -4 },
});
