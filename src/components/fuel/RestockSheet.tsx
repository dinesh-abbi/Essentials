import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';
import * as Fuel from '@/utils/FuelStorage';

const C = Colors.dark;
const S = Hue.spend;

/**
 * The restock checklist. Ticking an item is a real purchase (category
 * "Groceries") — it lands in Spend, the reports and the widget — and
 * unticking removes that same purchase. A ring shows how much of the list
 * is bought; "Due now" vs "Everything" switches the scope.
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
  const [bought, setBought] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<'due' | 'all'>('due');
  const [pending, setPending] = useState<string | null>(null);
  const key = position ? Fuel.windowKey(position) : '';

  useEffect(() => {
    if (!visible || !key) return;
    Fuel.getBought().then((all) => setBought(all[key] ?? {}));
  }, [visible, key]);

  if (!position) return null;

  const due = Fuel.dueItems(position.day, scope === 'all');
  const all = [...due.monthly, ...due.weekly, ...due.daily];
  const budget = Fuel.sumCost(all);
  const left = Fuel.sumCost(all.filter((i) => !bought[i.item]));
  const doneCount = all.filter((i) => bought[i.item]).length;

  const toggle = async (item: Fuel.GroceryItem) => {
    setPending(item.item);
    try {
      const next = await Fuel.toggleGrocery(key, item);
      setBought(next[key] ?? {});
    } finally {
      setPending(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} bracket="Restock" title={`Shopping from day ${Fuel.windowStartFor(position.day)}`}>
      <View style={styles.top}>
        <Tile hue="spend" style={styles.summary}>
          <ProgressRing size={70} stroke={9} progress={all.length ? doneCount / all.length : 0} color={S.main} track={S.soft}>
            <Text style={[Type.dotSmall, { color: C.textHi, fontSize: 16 }]}>
              {doneCount}/{all.length}
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text style={[Type.dotLabel, { color: C.textMid }]}>Still to buy</Text>
            <Text style={[Type.dotNumber, { color: left === 0 ? Hue.fuel.main : C.textHi }]}>₹{left.toLocaleString('en-IN')}</Text>
            <Text style={[Type.subline, { color: C.textMid }]}>of ₹{budget.toLocaleString('en-IN')} list</Text>
          </View>
        </Tile>
        <Segmented
          hue="spend"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'due', label: 'Due now' },
            { value: 'all', label: 'Everything' },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Section title="Monthly" icon="calendar-month" items={due.monthly} bought={bought} pending={pending} onToggle={toggle} />
        <Section title="Weekly" icon="calendar-week" items={due.weekly} bought={bought} pending={pending} onToggle={toggle} />
        <Section title="Daily" icon="calendar-today" items={due.daily} bought={bought} pending={pending} onToggle={toggle} />
        <Text style={[Type.subline, { color: C.textMid }]}>Ticked items go into Spend as Groceries. Untick to take them out.</Text>
      </ScrollView>
    </Sheet>
  );
}

function Section({
  title,
  icon,
  items,
  bought,
  pending,
  onToggle,
}: {
  title: string;
  icon: IconName;
  items: Fuel.GroceryItem[];
  bought: Record<string, string>;
  pending: string | null;
  onToggle: (i: Fuel.GroceryItem) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <IconBlob name={icon} hue="spend" size={28} variant="soft" />
        <Text style={[Type.dotLabel, { color: C.textMid }]}>{title}</Text>
      </View>
      {items.map((i) => {
        const on = !!bought[i.item];
        return (
          <AnimatedPressable
            key={i.item}
            onPress={() => onToggle(i)}
            disabled={pending !== null}
            haptic={on ? 'light' : 'selection'}
            pressScale={0.97}
            style={[styles.item, { backgroundColor: on ? Hue.fuel.tile : C.bg }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${i.item}, ${i.cost} rupees`}
          >
            <View style={[styles.box, { backgroundColor: on ? Hue.fuel.main : C.surface2 }]}>
              {pending === i.item ? (
                <ActivityIndicator size="small" color={on ? C.onAccent : S.main} />
              ) : on ? (
                <MaterialCommunityIcons name="check-bold" size={16} color={C.onAccent} />
              ) : null}
            </View>
            <Text style={[Type.controlLabel, styles.flex, { color: on ? C.textMid : C.textHi, textDecorationLine: on ? 'line-through' : 'none' }]}>
              {i.item}
            </Text>
            <Text style={[Type.dotSmall, { color: on ? C.textMid : C.textHi, fontSize: 16 }]}>₹{i.cost}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: Spacing.four, gap: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  body: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.lg },
  box: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
