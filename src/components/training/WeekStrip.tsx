import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Tile } from '@/components/ui/chunky';
import { Colors, Hue, Type } from '@/constants/theme';
import { dayForSlot, splitSlotFor, type TrainingDay } from '@/utils/TrainingStorage';
import { isoWeekday, localDateKey } from '@/utils/userDocs';

type Palette = typeof Colors.dark;

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The week as seven big circles — read it like a habit tracker:
 *   coral + tick   → trained that day
 *   ringed         → today
 *   dumbbell       → a training day (past ones fade = missed)
 *   moon           → a recovery day
 * Tapping opens the full week plan.
 */
export function WeekStrip({
  days,
  offset,
  doneDates,
  colors,
  onPress,
  now = new Date(),
}: {
  days: TrainingDay[];
  offset: number;
  doneDates: Set<string>;
  colors: Palette;
  onPress: () => void;
  now?: Date;
}) {
  const todayIso = isoWeekday(now);
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() - (todayIso - 1));

  const cols = LETTERS.map((letter, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const day = dayForSlot(days, splitSlotFor(date, offset));
    return { letter, iso: i + 1, day, done: doneDates.has(localDateKey(date)) };
  });

  const trained = cols.filter((c) => c.done).length;
  const planned = cols.filter((c) => !c.day.isRecovery).length;
  const train = Hue.train;

  return (
    <Tile onPress={onPress} style={styles.face} accessibilityLabel={`This week: ${trained} of ${planned} training days logged. Open the week plan.`}>
      <View style={styles.head}>
        <Text style={[Type.dotLabel, { color: colors.textMid }]}>This week</Text>
        <View style={styles.headRight}>
          <Text style={[Type.dotSmall, { color: train.main }]}>
            {trained}/{planned}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMid} />
        </View>
      </View>
      <View style={styles.row}>
        {cols.map((c) => {
          const isToday = c.iso === todayIso;
          const isPast = c.iso < todayIso;
          const rest = c.day.isRecovery && !c.done;
          return (
            <View key={c.iso} style={styles.col}>
              <Text style={[Type.dotLabel, { color: isToday ? colors.textHi : colors.textLow }]}>{c.letter}</Text>
              <View
                style={[
                  styles.circle,
                  c.done
                    ? { backgroundColor: train.main }
                    : { backgroundColor: isToday ? train.soft : colors.surface2, opacity: isPast && !isToday ? 0.5 : 1 },
                  isToday && !c.done && { borderWidth: 2.5, borderColor: train.main },
                ]}
              >
                <MaterialCommunityIcons
                  name={c.done ? 'check-bold' : rest ? 'weather-night' : 'dumbbell'}
                  size={c.done ? 18 : 16}
                  color={c.done ? train.on : isToday ? train.main : rest ? colors.textLow : colors.textMid}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  face: { gap: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: 8 },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
