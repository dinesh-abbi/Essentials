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

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, Tile } from '@/components/ui/chunky';
import { Colors, Hue, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { prescription, type Exercise } from '@/utils/TrainingStorage';

type Palette = typeof Colors.dark;

/**
 * One movement in today's session, as a chunky card. Collapsed: a numbered
 * badge, the name, the prescription as chips and a big check button. When
 * done, the card takes the training hue and the badge pops into a tick —
 * a finished list reads as a column of coral cards. Expanded: the coaching
 * cue, a load stepper pre-filled from last time, and form videos.
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
  const train = Hue.train;

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
    pop.value = withSequence(withTiming(1.3, { duration: 110 }), withSpring(1, Motion.bouncy));
  }, [done, reduceMotion, pop]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const commit = (value: number) => {
    const v = Math.max(0, Math.round(value * 10) / 10);
    setText(v ? String(v) : '');
    onWeight(v);
  };

  const openForm = () =>
    Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} proper form`)}`);

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
                <Chip icon={isCardio ? 'timer-outline' : 'repeat'} label={prescription(exercise)} />
                {weight ? <Chip icon="weight-kilogram" label={`${weight} ${unit}`} hue="train" /> : null}
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
            {exercise.notes ? (
              <View style={[styles.cue, { backgroundColor: colors.surface2 }]}>
                <MaterialCommunityIcons name="lightbulb-on" size={18} color={Hue.spend.main} />
                <Text style={[Type.body, styles.flex, { color: colors.textMid }]}>{exercise.notes}</Text>
              </View>
            ) : null}

            {exercise.tempo && !isCardio ? <Chip icon="metronome" label={`Tempo ${exercise.tempo}`} /> : null}

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
                  placeholderTextColor={colors.textLow}
                  style={[Type.dotNumber, styles.loadInput, { color: colors.textHi }]}
                  accessibilityLabel={`${isCardio ? 'Minutes' : 'Kilograms'} for ${exercise.name}`}
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
            {lastWeight ? (
              <Text style={[Type.subline, styles.last, { color: colors.textMid }]}>
                Last time: {lastWeight} {unit}
              </Text>
            ) : null}

            <ChunkyButton label="Watch form" icon="youtube" variant="soft" hue="train" size="sm" haptic="light" onPress={openForm} />
          </Animated.View>
        )}
      </Tile>
    </Animated.View>
  );
});

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
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  last: { textAlign: 'center', marginTop: -4 },
});
