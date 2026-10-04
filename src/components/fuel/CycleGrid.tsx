import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Hue, Type } from '@/constants/theme';
import { CYCLE_LENGTH, dateForCycleDay, eatenCount, type DayMeals } from '@/utils/FuelStorage';
import { localDateKey } from '@/utils/userDocs';

type Palette = typeof Colors.dark;

/**
 * The 28-day cycle as a dot field (4 weeks × 7 days) — each dot one day,
 * glowing brighter the more of its meals were eaten. The first column is
 * always a restock day (cart above it). Today wears a ring; the selected day
 * is outlined in white. Tap a dot to see that day.
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
  const fuel = Hue.fuel;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.weekLabel} />
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={styles.cellBox}>
            {i === 0 ? <MaterialCommunityIcons name="cart" size={14} color={Hue.spend.main} /> : null}
          </View>
        ))}
      </View>
      {[0, 1, 2, 3].map((w) => (
        <View key={w} style={styles.row}>
          <Text style={[Type.dotLabel, styles.weekLabel, { color: colors.textLow }]}>W{w + 1}</Text>
          {Array.from({ length: 7 }, (_, i) => {
            const day = w * 7 + i + 1;
            const eaten = eatenCount(logs[localDateKey(dateForCycleDay(start, day))]);
            const future = day > today;
            const isToday = day === today;
            const isSelected = day === selected;
            return (
              <AnimatedPressable
                key={day}
                onPress={() => onSelect(day)}
                haptic="selection"
                pressScale={0.85}
                style={styles.cellBox}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Cycle day ${day}${isToday ? ', today' : ''}${future ? '' : `, ${eaten} of 4 meals`}`}
              >
                <View
                  style={[
                    styles.ring,
                    isSelected && { borderColor: colors.textHi },
                    !isSelected && isToday && { borderColor: fuel.main },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: future ? colors.surface2 : eaten === 0 ? colors.surface2 : fuel.main,
                        opacity: future ? 0.45 : eaten === 0 ? 1 : 0.35 + eaten * 0.1625,
                      },
                    ]}
                  />
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      ))}
      <Text style={[Type.subline, styles.legend, { color: colors.textMid }]}>
        Brighter dot = more meals eaten · day {today} of {CYCLE_LENGTH}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  weekLabel: { width: 30 },
  cellBox: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40 },
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 24, height: 24, borderRadius: 12 },
  legend: { marginTop: 8 },
});
