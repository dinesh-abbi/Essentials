import { Feather } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, FontFace, Motion, Radius, Spacing, Type } from '@/constants/theme';
import type { MealEntry, MealStatus } from '@/utils/FuelStorage';

type Palette = typeof Colors.dark;

const ACTIONS: { status: MealStatus; icon: 'check' | 'x' | 'repeat'; label: string }[] = [
  { status: 'eaten', icon: 'check', label: 'Ate it' },
  { status: 'swapped', icon: 'repeat', label: 'Had something else' },
  { status: 'missed', icon: 'x', label: 'Skipped' },
];

/**
 * One meal of the plan: the time as a tabular numeral in the gutter, the
 * meal name as a bracket label, the planned dish in display type, and three
 * small state buttons. "Had something else" opens a one-line note.
 * Colour stays disciplined: eaten = the accent, skipped = the alert tone
 * (it is the one meal-state that is actually a problem), swapped = neutral.
 */
export const MealRow = memo(function MealRow({
  time,
  label,
  dish,
  entry,
  colors,
  locked = false,
  onSet,
}: {
  time: string;
  label: string;
  dish: string;
  entry?: MealEntry;
  colors: Palette;
  /** Future days show the plan but can't be logged yet. */
  locked?: boolean;
  onSet: (status: MealStatus | null, note?: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const status = entry?.status;
  const [note, setNote] = useState(entry?.note ?? '');
  useEffect(() => setNote(entry?.note ?? ''), [entry?.note]);

  const tint = (s: MealStatus) => (s === 'eaten' ? colors.water : s === 'missed' ? colors.alert : colors.textHi);

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(Motion.duration.fast + 80)}
      style={[styles.row, { borderBottomColor: colors.hairline }]}
    >
      <Text style={[Type.badge, styles.time, { color: status ? colors.textMid : colors.textHi }]}>{time}</Text>

      <View style={styles.main}>
        <Text style={[Type.bracketLabel, { color: status === 'eaten' ? colors.water : colors.textMid }]}>
          [ {label.toUpperCase()} ]
        </Text>
        <Text
          style={[
            styles.dish,
            {
              color: status === 'missed' ? colors.textMid : colors.textHi,
              textDecorationLine: status === 'missed' ? 'line-through' : 'none',
            },
          ]}
        >
          {dish}
        </Text>

        {status === 'swapped' && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut}>
            <TextInput
              value={note}
              onChangeText={setNote}
              onEndEditing={() => onSet('swapped', note)}
              placeholder="What did you have instead?"
              placeholderTextColor={colors.textLow}
              returnKeyType="done"
              style={[styles.note, { color: colors.textHi, borderColor: colors.hairline, backgroundColor: colors.surface }]}
            />
          </Animated.View>
        )}

        <View style={styles.footer}>
          <View style={[styles.actions, locked && { opacity: 0 }]} pointerEvents={locked ? 'none' : 'auto'}>
            {ACTIONS.map((a) => {
              const active = status === a.status;
              return (
                <AnimatedPressable
                  key={a.status}
                  onPress={() => onSet(active ? null : a.status, a.status === 'swapped' ? note : undefined)}
                  haptic={active ? 'light' : 'selection'}
                  pressScale={0.9}
                  style={[
                    styles.action,
                    active
                      ? { backgroundColor: tint(a.status), borderColor: tint(a.status) }
                      : { borderColor: colors.hairline },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label}: ${a.label}`}
                >
                  <Feather name={a.icon} size={16} color={active ? colors.onAccent : colors.textMid} />
                </AnimatedPressable>
              );
            })}
          </View>
          <AnimatedPressable
            onPress={() =>
              Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${dish} recipe`)}`)
            }
            haptic="light"
            pressOpacity={0.7}
            style={styles.recipe}
            accessibilityRole="link"
            accessibilityLabel={`Recipe videos for ${dish}`}
          >
            <Text style={[Type.subline, { color: colors.textMid }]}>Recipe</Text>
            <Feather name="arrow-up-right" size={13} color={colors.textMid} />
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  time: { width: 44, fontSize: 13, marginTop: 1 },
  main: { flex: 1, gap: Spacing.two },
  dish: { fontFamily: FontFace.displayBold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  note: {
    ...Type.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipe: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: Spacing.one },
});
