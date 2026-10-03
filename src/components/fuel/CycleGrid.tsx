import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { CYCLE_LENGTH, dateForCycleDay, eatenCount, type DayMeals } from '@/utils/FuelStorage';
import { localDateKey } from '@/utils/userDocs';

type Palette = typeof Colors.dark;

/**
 * The 28-day cycle as a 4 × 7 field — each cell one day, filled by how many
 * of its four meals were eaten (or swapped). Read across, it's adherence
 * over the month at a glance; the first column is always a restock day
 * (cycle days 1, 8, 15, 22), marked by the cart above it. Future days are
 * hairline outlines, today wears a ring, the selected day is outlined.
 */
export function CycleGrid({
  start,
  today,
  selected,
  logs,
  colors,
  onSelect,
}: {
  start: string;
  today: number;
  selected: number;
  logs: Record<string, DayMeals>;
  colors: Palette;
  onSelect: (day: number) => void;
}) {
  const weeks = [0, 1, 2, 3];
  return (
    <View style={styles.wrap}>
      <View style={styles.markRow}>
        <View style={styles.weekLabel} />
        <View style={styles.cellBox}>
          <Feather name="shopping-cart" size={11} color={colors.textMid} />
        </View>
        <View style={{ flex: 6 }} />
      </View>
      {weeks.map((w) => (
        <View key={w} style={styles.row}>
          <Text style={[Type.bracketLabel, styles.weekLabel, { color: colors.textMid }]}>W{w + 1}</Text>
          {Array.from({ length: 7 }, (_, i) => {
            const day = w * 7 + i + 1;
            const key = localDateKey(dateForCycleDay(start, day));
            const eaten = eatenCount(logs[key]);
            const future = day > today;
            const isToday = day === today;
            const isSelected = day === selected;
            const fill = future
              ? 'transparent'
              : eaten === 0
                ? colors.surface2
                : colors.water;
            const opacity = future || eaten === 0 ? 1 : 0.28 + eaten * 0.18;
            return (
              <AnimatedPressable
                key={day}
                onPress={() => onSelect(day)}
                haptic="selection"
                pressScale={0.9}
                style={styles.cellBox}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Cycle day ${day}${isToday ? ', today' : ''}${future ? '' : `, ${eaten} of 4 meals`}`}
              >
                <View
                  style={[
                    styles.cell,
                    {
                      borderColor: isSelected ? colors.textHi : isToday ? colors.water : colors.hairline,
                      borderWidth: isSelected || isToday ? 1.5 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: fill, opacity }]} />
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      ))}
      <Text style={[Type.subline, styles.legend, { color: colors.textMid }]}>
        Brighter = more meals logged · day {today} of {CYCLE_LENGTH}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  markRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  weekLabel: { width: 30, letterSpacing: 0.5 },
  cellBox: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 34 },
  cell: { width: 28, height: 28, borderRadius: Radius.sm - 1, overflow: 'hidden' },
  fill: { borderRadius: Radius.sm - 2 },
  legend: { marginTop: Spacing.two },
});
