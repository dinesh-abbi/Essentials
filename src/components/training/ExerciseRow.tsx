import { Feather } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
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

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, FontFace, HitTarget, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { prescription, type Exercise } from '@/utils/TrainingStorage';

type Palette = typeof Colors.dark;

/**
 * One movement in today's session. Collapsed it is a single confident line —
 * index, name, prescription, check. Expanded it opens the working surface:
 * the coaching cue, a load stepper pre-filled from last time, and a jump to
 * form videos. The index numeral is the row's only colour cue: it turns
 * `water` when the movement is done, so a finished list reads as a column of
 * lit numbers rather than a column of green cards.
 */
export const ExerciseRow = memo(function ExerciseRow({
  exercise,
  index,
  done,
  weight,
  lastWeight,
  expanded,
  colors,
  onToggleExpand,
  onToggleDone,
  onWeight,
}: {
  exercise: Exercise;
  index: number;
  done: boolean;
  weight?: number;
  lastWeight?: number;
  expanded: boolean;
  colors: Palette;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onWeight: (value: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const isCardio = !!exercise.isCardio;
  const unit = isCardio ? 'min' : 'kg';
  const step = isCardio ? 5 : 2.5;

  // Local text so "42." can exist mid-typing; resynced (during render, the
  // React-recommended way) only when the stored weight changes from outside —
  // e.g. the −/+ stepper — and no longer matches what's typed.
  const [text, setText] = useState(weight ? String(weight) : '');
  const [seenWeight, setSeenWeight] = useState(weight);
  if (weight !== seenWeight) {
    setSeenWeight(weight);
    if ((weight ?? 0) !== (parseFloat(text.replace(',', '.')) || 0)) setText(weight ? String(weight) : '');
  }

  useEffect(() => {
    if (!done || reduceMotion) return;
    pop.value = withSequence(
      withTiming(1.18, { duration: Motion.duration.fast, easing: Easing.out(Easing.cubic) }),
      withSpring(1, Motion.spring),
    );
  }, [done, reduceMotion, pop]);

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const commit = (value: number) => {
    const v = Math.max(0, Math.round(value * 10) / 10);
    setText(v ? String(v) : '');
    onWeight(v);
  };

  const openForm = () =>
    Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} proper form`)}`);

  const number = String(index + 1).padStart(2, '0');

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(Motion.duration.fast + 80)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: expanded ? colors.water : colors.hairline }]}
    >
      <View style={styles.head}>
        <AnimatedPressable
          onPress={onToggleExpand}
          haptic="selection"
          pressScale={0.985}
          style={styles.headMain}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${exercise.name}, ${prescription(exercise)}${done ? ', done' : ''}. ${expanded ? 'Collapse' : 'Expand'} details.`}
        >
          <Text style={[Type.badge, styles.index, { color: done ? colors.water : colors.textMid }]}>{number}</Text>
          <View style={styles.titleCol}>
            <Text
              style={[styles.name, { color: done ? colors.textMid : colors.textHi }]}
              numberOfLines={expanded ? 3 : 1}
            >
              {exercise.name}
            </Text>
            <Text style={[Type.subline, { color: colors.textMid }]} numberOfLines={1}>
              {prescription(exercise)}
              {exercise.tempo && !isCardio ? `  ·  tempo ${exercise.tempo}` : ''}
              {weight ? `  ·  ${weight} ${unit}` : ''}
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={onToggleDone}
          haptic={done ? 'light' : 'medium'}
          style={styles.checkHit}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? `Mark ${exercise.name} not done` : `Mark ${exercise.name} done`}
        >
          <Animated.View
            style={[
              styles.check,
              checkStyle,
              done
                ? { backgroundColor: colors.water, borderColor: colors.water }
                : { backgroundColor: 'transparent', borderColor: colors.hairline },
            ]}
          >
            {done ? <Feather name="check" size={18} color={colors.onAccent} /> : null}
          </Animated.View>
        </AnimatedPressable>
      </View>

      {expanded && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(Motion.duration.fast + 60)}
          exiting={reduceMotion ? undefined : FadeOut.duration(Motion.duration.fast)}
          style={styles.body}
        >
          {exercise.notes ? (
            <View style={[styles.cue, { borderLeftColor: colors.water }]}>
              <Text style={[Type.body, { color: colors.textMid }]}>{exercise.notes}</Text>
            </View>
          ) : null}

          <View style={styles.loadRow}>
            <View style={styles.loadLabel}>
              <Text style={[Type.bracketLabel, { color: colors.textMid }]}>{isCardio ? '[ TIME ]' : '[ LOAD ]'}</Text>
              {lastWeight ? (
                <Text style={[Type.subline, { color: colors.textMid }]}>
                  last {lastWeight} {unit}
                </Text>
              ) : null}
            </View>

            <View style={styles.stepper}>
              <StepButton icon="minus" colors={colors} onPress={() => commit((weight ?? lastWeight ?? 0) - step)} label={`Decrease by ${step}`} />
              <View style={[styles.loadField, { borderColor: colors.hairline, backgroundColor: colors.bg }]}>
                <TextInput
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    const n = parseFloat(t.replace(',', '.'));
                    onWeight(Number.isFinite(n) ? n : 0);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={lastWeight ? String(lastWeight) : '0'}
                  placeholderTextColor={colors.textLow}
                  style={[styles.loadInput, { color: colors.textHi }]}
                  accessibilityLabel={`${isCardio ? 'Minutes' : 'Kilograms'} for ${exercise.name}`}
                  selectTextOnFocus
                />
                <Text style={[Type.subline, { color: colors.textMid }]}>{unit}</Text>
              </View>
              <StepButton icon="plus" colors={colors} onPress={() => commit((weight ?? lastWeight ?? 0) + step)} label={`Increase by ${step}`} />
            </View>
          </View>

          <AnimatedPressable
            onPress={openForm}
            haptic="light"
            pressOpacity={0.7}
            style={styles.formLink}
            accessibilityRole="link"
            accessibilityLabel={`Watch form videos for ${exercise.name}`}
          >
            <Feather name="play-circle" size={15} color={colors.water} />
            <Text style={[Type.controlLabel, { color: colors.water }]}>Watch form</Text>
            <Feather name="arrow-up-right" size={14} color={colors.water} />
          </AnimatedPressable>
        </Animated.View>
      )}
    </Animated.View>
  );
});

function StepButton({
  icon,
  onPress,
  colors,
  label,
}: {
  icon: 'minus' | 'plus';
  onPress: () => void;
  colors: Palette;
  label: string;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      style={[styles.step, { borderColor: colors.hairline }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={16} color={colors.textHi} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two + 2,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  index: { width: 22, fontSize: 13 },
  titleCol: { flex: 1, gap: 2 },
  name: { fontFamily: FontFace.displayBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  checkHit: { width: HitTarget + 8, height: HitTarget + 8, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingLeft: 22 + Spacing.three, paddingRight: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.three },
  cue: { borderLeftWidth: 2, paddingLeft: Spacing.three },
  loadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  loadLabel: { gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    height: 44,
    minWidth: 92,
    justifyContent: 'center',
  },
  loadInput: {
    ...Type.readout,
    fontSize: 20,
    minWidth: 36,
    textAlign: 'right',
    padding: 0,
    includeFontPadding: false,
  },
  formLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'flex-start', paddingVertical: Spacing.one },
});
