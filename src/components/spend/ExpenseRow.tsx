import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { categoryMeta } from '@/components/spend/categories';
import { Tile } from '@/components/ui/chunky';
import { Colors, FontFace, Type, withAlpha } from '@/constants/theme';
import type { PurchaseLog } from '@/utils/PurchasesStorage';

const C = Colors.dark;

/** One expense: category picture, name, time · category, and the amount. Tap to edit. */
export const ExpenseRow = memo(function ExpenseRow({ log, onPress }: { log: PurchaseLog; onPress?: () => void }) {
  const meta = categoryMeta(log.category);
  const income = log.category === 'Income';
  return (
    <Tile onPress={onPress} style={styles.face} containerStyle={styles.box} accessibilityLabel={`${log.name}, ${log.category}, ₹${log.cost}. Edit.`}>
      <View style={[styles.icon, { backgroundColor: withAlpha(meta.color, 0.18) }]}>
        <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.text}>
        <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={1}>
          {log.name}
        </Text>
        <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
          {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {log.category}
        </Text>
      </View>
      <View style={styles.amount}>
        <Text style={[styles.rupee, { color: income ? '#86EFAC' : C.textMid }]}>{income ? '+₹' : '₹'}</Text>
        <Text style={[Type.dotSmall, { color: income ? '#86EFAC' : C.textHi }]}>{formatAmount(log.cost)}</Text>
      </View>
    </Tile>
  );
});

export const formatAmount = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const styles = StyleSheet.create({
  box: { marginBottom: 8 },
  face: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  amount: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  rupee: { fontFamily: FontFace.display, fontSize: 14, lineHeight: 22 },
});
