import { memo, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { ChunkyButton, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { Colors, mix, Radius, Type, type HueName } from '@/constants/theme';
import type { MealEntry, MealStatus } from '@/utils/FuelStorage';

type Palette = typeof Colors.dark;

const ACTIONS: { status: MealStatus; icon: IconName; label: string; hue: HueName }[] = [
  { status: 'eaten', icon: 'check-bold', label: 'Ate', hue: 'fuel' },
  { status: 'swapped', icon: 'swap-horizontal', label: 'Swap', hue: 'spend' },
  { status: 'missed', icon: 'close', label: 'Skip', hue: 'alarm' },
];

/**
 * One meal of the plan as a card: the meal's picture, its time, the dish in
 * big type, and three chunky answers — Ate / Swap / Skip. The card takes the
 * colour of the answer, so a finished day is a column of lime cards.
 */
export const MealRow = memo(function MealRow({
  time,
  label,
  icon,
  dish,
  entry,
  colors,
  locked = false,
  onSet,
}: {
  time: string;
  label: string;
  icon: IconName;
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

  const tint =
    status === 'eaten'
      ? undefined
      : status === 'missed'
        ? { face: mix(colors.alert, colors.surface, 0.12), edge: mix(colors.alert, colors.bg, 0.28) }
        : undefined;

  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.springify().damping(18)} style={styles.wrap}>
      <Tile hue={status === 'eaten' ? 'fuel' : status === 'swapped' ? 'spend' : null} tint={tint} style={styles.face}>
        <View style={styles.head}>
          <IconBlob name={icon} hue="fuel" size={48} variant={status === 'eaten' ? 'solid' : 'soft'} />
          <View style={styles.flex}>
            <Text style={[Type.dotLabel, { color: colors.textMid }]}>
              {time} · {label}
            </Text>
            <Text
              style={[
                Type.title,
                {
                  color: status === 'missed' ? colors.textMid : colors.textHi,
                  textDecorationLine: status === 'missed' ? 'line-through' : 'none',
                },
              ]}
            >
              {dish}
            </Text>
          </View>
          <ChunkyButton
            icon="youtube"
            variant="soft"
            hue="alarm"
            size="sm"
            haptic="light"
            onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${dish} recipe`)}`)}
            accessibilityLabel={`Recipe videos for ${dish}`}
          />
        </View>

        {status === 'swapped' && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut}>
            <TextInput
              value={note}
              onChangeText={setNote}
              onEndEditing={() => onSet('swapped', note)}
              placeholder="What did you have instead?"
              placeholderTextColor={colors.textLow}
              returnKeyType="done"
              style={[styles.note, { color: colors.textHi, backgroundColor: colors.bg }]}
            />
          </Animated.View>
        )}

        {!locked && (
          <View style={styles.actions}>
            {ACTIONS.map((a) => {
              const active = status === a.status;
              return (
                <ChunkyButton
                  key={a.status}
                  label={a.label}
                  icon={a.icon}
                  hue={a.hue}
                  variant={active ? 'solid' : 'soft'}
                  size="sm"
                  haptic={active ? 'light' : 'selection'}
                  style={styles.flex}
                  onPress={() => onSet(active ? null : a.status, a.status === 'swapped' ? note : undefined)}
                  accessibilityLabel={`${label}: ${a.label}${active ? ' (selected)' : ''}`}
                />
              );
            })}
          </View>
        )}
      </Tile>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  face: { gap: 14 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: {
    ...Type.body,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', gap: 8 },
});

