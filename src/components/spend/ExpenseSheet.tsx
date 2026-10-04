import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES, categoryMeta } from '@/components/spend/categories';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ChunkyButton } from '@/components/ui/chunky';
import { DateTimeSheet } from '@/components/ui/date-time-sheet';
import { Sheet } from '@/components/ui/sheet';
import { Colors, FontFace, Hue, Radius, Spacing, Type, withAlpha } from '@/constants/theme';
import type { PurchaseLog } from '@/utils/PurchasesStorage';

const C = Colors.dark;

export interface ExpenseDraft {
  name: string;
  cost: number;
  category: string;
  timestamp: number;
}

/**
 * Add or edit one expense: a huge amount, a name, when, and a picture grid of
 * categories. Pass `log` to edit (adds a Delete button).
 */
export function ExpenseSheet({
  visible,
  log,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  log?: PurchaseLog | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: ExpenseDraft) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissable={!saving}
      bracket={log ? 'Edit expense' : 'New expense'}
      title={log ? log.name : 'What did you spend on?'}
      heightRatio={0.9}
    >
      {/* Keyed so each open starts from the right values. */}
      {visible ? <Form key={log?.id ?? 'new'} log={log} saving={saving} onSave={onSave} onDelete={onDelete} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Form({
  log,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  log?: PurchaseLog | null;
  saving?: boolean;
  onSave: (draft: ExpenseDraft) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(log?.name ?? '');
  const [cost, setCost] = useState(log ? String(log.cost) : '');
  const [category, setCategory] = useState(log?.category ?? 'Groceries');
  const [when, setWhen] = useState(() => new Date(log?.timestamp ?? Date.now()));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  const save = () => {
    if (!name.trim()) return Alert.alert('Add a name', 'What was it? e.g. Eggs, Bus, Coffee.');
    const price = parseFloat(cost.replace(',', '.'));
    if (isNaN(price) || price <= 0) return Alert.alert('Add an amount', 'Enter how much it cost.');
    onSave({ name: name.trim(), cost: price, category, timestamp: when.getTime() });
  };

  const isToday = when.toDateString() === new Date().toDateString();
  const sun = Hue.spend;

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.amount, { backgroundColor: C.bg }]}>
        <Text style={[styles.rupee, { color: sun.main }]}>₹</Text>
        <TextInput
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.textLow}
          style={[Type.dotHero, styles.amountInput, { color: C.textHi }]}
          accessibilityLabel="Amount in rupees"
          autoFocus={!log}
        />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name it — eggs, bus, coffee…"
        placeholderTextColor={C.textLow}
        style={[Type.controlLabel, styles.name, { color: C.textHi, backgroundColor: C.bg }]}
        autoCorrect={false}
      />

      <View style={styles.when}>
        <ChunkyButton
          label={isToday ? 'Today' : when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          icon="calendar"
          variant="soft"
          hue="spend"
          size="sm"
          style={styles.flex}
          onPress={() => setPicker('date')}
        />
        <ChunkyButton
          label={when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          icon="clock-outline"
          variant="soft"
          hue="spend"
          size="sm"
          style={styles.flex}
          onPress={() => setPicker('time')}
        />
      </View>

      <Text style={[Type.dotLabel, { color: C.textMid }]}>Category</Text>
      <View style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const meta = categoryMeta(cat);
          const on = category === cat;
          return (
            <AnimatedPressable
              key={cat}
              onPress={() => setCategory(cat)}
              haptic="selection"
              pressScale={0.9}
              style={[styles.cat, { backgroundColor: on ? withAlpha(meta.color, 0.18) : C.bg }, on && { borderColor: meta.color }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={cat}
            >
              <View style={[styles.catIcon, { backgroundColor: on ? meta.color : withAlpha(meta.color, 0.16) }]}>
                <MaterialCommunityIcons name={meta.icon} size={20} color={on ? C.onAccent : meta.color} />
              </View>
              <Text style={[Type.badge, { color: on ? C.textHi : C.textMid, fontSize: 11 }]} numberOfLines={1}>
                {cat}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <ChunkyButton label={log ? 'Save changes' : 'Add expense'} icon="check-bold" hue="spend" onPress={save} loading={saving} />
      {log && onDelete ? (
        <ChunkyButton
          label="Delete"
          icon="trash-can-outline"
          variant="soft"
          hue="alarm"
          textColor={C.alert}
          size="md"
          onPress={() =>
            Alert.alert('Delete this expense?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  onDelete(log.id);
                  onClose();
                },
              },
            ])
          }
        />
      ) : null}

      <DateTimeSheet mode={picker ?? 'date'} visible={picker !== null} value={when} onClose={() => setPicker(null)} onChange={setWhen} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: 12 },
  flex: { flex: 1 },
  amount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.xl, paddingVertical: 10, gap: 6 },
  rupee: { fontFamily: FontFace.displayBold, fontSize: 40 },
  amountInput: { minWidth: 80, textAlign: 'center', padding: 0, includeFontPadding: false },
  name: { borderRadius: Radius.lg, paddingHorizontal: 16, height: 52 },
  when: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  cat: {
    width: '23.5%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
