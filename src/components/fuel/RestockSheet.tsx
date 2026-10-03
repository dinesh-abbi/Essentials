import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import * as Fuel from '@/utils/FuelStorage';

type Palette = typeof Colors.dark;

/**
 * The restock checklist. Ticking an item is a real purchase (category
 * "Groceries") — it lands in Spend, the reports and the widget — and
 * unticking removes that same purchase. "Due now" shows what this restock
 * window needs (monthly staples only in the first window of the cycle);
 * "Everything" shows the full list.
 */
export function RestockSheet({
  visible,
  onClose,
  position,
}: {
  visible: boolean;
  onClose: () => void;
  position: Fuel.CyclePosition | null;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;
  const [bought, setBought] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const key = position ? Fuel.windowKey(position) : '';

  useEffect(() => {
    if (!visible || !key) return;
    Fuel.getBought().then((all) => setBought(all[key] ?? {}));
  }, [visible, key]);

  if (!position) return null;

  const due = Fuel.dueItems(position.day, showAll);
  const all = [...due.monthly, ...due.weekly, ...due.daily];
  const budget = Fuel.sumCost(all);
  const left = Fuel.sumCost(all.filter((i) => !bought[i.item]));

  const toggle = async (item: Fuel.GroceryItem) => {
    setPending(item.item);
    try {
      const next = await Fuel.toggleGrocery(key, item);
      setBought(next[key] ?? {});
    } finally {
      setPending(null);
    }
  };

  const restockDay = Fuel.windowStartFor(position.day);

  return (
    <Sheet visible={visible} onClose={onClose} bracket="[ RESTOCK ]" title={`Window from day ${restockDay}`}>
      <View style={[styles.stats, { borderBottomColor: colors.hairline }]}>
        <View style={styles.stat}>
          <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ LIST ]</Text>
          <Text style={[Type.numberSm, { color: colors.textHi }]}>₹{budget.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ STILL TO BUY ]</Text>
          <Text style={[Type.numberSm, { color: left === 0 ? colors.water : colors.textHi }]}>₹{left.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={[styles.segment, { borderColor: colors.hairline }]}>
        {[
          { v: false, l: 'Due now' },
          { v: true, l: 'Everything' },
        ].map((o) => (
          <AnimatedPressable
            key={o.l}
            onPress={() => setShowAll(o.v)}
            haptic="selection"
            style={[styles.segBtn, showAll === o.v && { backgroundColor: colors.surface2 }]}
            accessibilityRole="button"
            accessibilityState={{ selected: showAll === o.v }}
          >
            <Text style={[Type.controlLabel, { fontSize: 14, color: showAll === o.v ? colors.textHi : colors.textMid }]}>{o.l}</Text>
          </AnimatedPressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Section title="MONTHLY" items={due.monthly} bought={bought} pending={pending} colors={colors} onToggle={toggle} />
        <Section title="WEEKLY" items={due.weekly} bought={bought} pending={pending} colors={colors} onToggle={toggle} />
        <Section title="DAILY" items={due.daily} bought={bought} pending={pending} colors={colors} onToggle={toggle} />
        <Text style={[Type.subline, { color: colors.textMid }]}>
          Ticked items are logged to Spend as Groceries. Untick to remove the purchase.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

function Section({
  title,
  items,
  bought,
  pending,
  colors,
  onToggle,
}: {
  title: string;
  items: Fuel.GroceryItem[];
  bought: Record<string, string>;
  pending: string | null;
  colors: Palette;
  onToggle: (i: Fuel.GroceryItem) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ {title} ]</Text>
      {items.map((i) => {
        const on = !!bought[i.item];
        return (
          <AnimatedPressable
            key={i.item}
            onPress={() => onToggle(i)}
            disabled={pending !== null}
            haptic={on ? 'light' : 'selection'}
            pressScale={0.98}
            style={[styles.item, { borderBottomColor: colors.hairline }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${i.item}, ${i.cost} rupees`}
          >
            <View
              style={[
                styles.box,
                on ? { backgroundColor: colors.water, borderColor: colors.water } : { borderColor: colors.hairline },
              ]}
            >
              {pending === i.item ? (
                <ActivityIndicator size="small" color={on ? colors.onAccent : colors.water} />
              ) : on ? (
                <Feather name="check" size={14} color={colors.onAccent} />
              ) : null}
            </View>
            <Text
              style={[
                Type.body,
                styles.itemName,
                { color: on ? colors.textMid : colors.textHi, textDecorationLine: on ? 'line-through' : 'none' },
              ]}
            >
              {i.item}
            </Text>
            <Text style={[Type.readout, styles.cost, { color: on ? colors.textMid : colors.textHi }]}>₹{i.cost}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { gap: 2, flex: 1 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    padding: 4,
  },
  segBtn: { flex: 1, height: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  section: { gap: Spacing.one },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  itemName: { flex: 1 },
  cost: { fontSize: 15 },
});
