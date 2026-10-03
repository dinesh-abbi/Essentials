import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { dayForSlot, splitSlotFor, type TrainingDay } from '@/utils/TrainingStorage';
import { isoWeekday, localDateKey } from '@/utils/userDocs';

type Palette = typeof Colors.dark;

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The week as an instrument strip: seven columns, each a short bar.
 *   lit bar        → a session was logged that day
 *   hairline bar   → a training day (past = missed, future = planned)
 *   small dot      → a recovery day
 * Today's letter is the only full-contrast letter in the row. Tapping the
 * strip opens the full week plan.
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
    const key = localDateKey(date);
    return { letter, iso: i + 1, day, done: doneDates.has(key) };
  });

  const trained = cols.filter((c) => c.done).length;
  const planned = cols.filter((c) => !c.day.isRecovery).length;

  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.85}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={`This week: ${trained} of ${planned} training days logged. Open the week plan.`}
    >
      <View style={styles.head}>
        <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ THIS WEEK ]</Text>
        <Text style={[Type.bracketLabel, { color: colors.textMid }]}>
          {trained}/{planned}
        </Text>
      </View>
      <View style={styles.row}>
        {cols.map((c) => {
          const isToday = c.iso === todayIso;
          const isPast = c.iso < todayIso;
          return (
            <View key={c.iso} style={styles.col}>
              <View style={styles.barBox}>
                {c.day.isRecovery && !c.done ? (
                  <View style={[styles.dot, { backgroundColor: colors.hairline }]} />
                ) : (
                  <View
                    style={[
                      styles.bar,
                      c.done
                        ? { backgroundColor: colors.water, borderColor: colors.water }
                        : {
                            backgroundColor: 'transparent',
                            borderColor: isToday ? colors.water : colors.hairline,
                            opacity: isPast ? 0.55 : 1,
                          },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  Type.bracketLabel,
                  styles.letter,
                  { color: isToday ? colors.textHi : colors.textMid },
                ]}
              >
                {c.letter}
              </Text>
              {isToday ? <View style={[styles.todayMark, { backgroundColor: colors.water }]} /> : <View style={styles.todayMark} />}
            </View>
          );
        })}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: Spacing.two, width: 28 },
  barBox: { height: 34, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 8, height: 34, borderRadius: Radius.pill, borderWidth: 1.2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  letter: { letterSpacing: 0 },
  todayMark: { width: 4, height: 4, borderRadius: 2, marginTop: -4 },
});
