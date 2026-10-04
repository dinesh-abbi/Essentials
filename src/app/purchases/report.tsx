import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Skeleton from '@/components/SkeletonLoader';
import { categoryMeta } from '@/components/spend/categories';
import { ExpenseRow, formatAmount } from '@/components/spend/ExpenseRow';
import { ExpenseSheet, type ExpenseDraft } from '@/components/spend/ExpenseSheet';
import { Chip, Tile } from '@/components/ui/chunky';
import { Donut } from '@/components/ui/donut';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, FontFace, Hue, Spacing, Type } from '@/constants/theme';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WidgetSync from '@/utils/WidgetSync';

const C = Colors.dark;

/** One day of spending: a category donut with the total, then every expense. */
export default function PurchasesDailyReportScreen() {
  const { dateMs } = useLocalSearchParams<{ dateMs: string }>();
  const insets = useSafeAreaInsets();
  const target = dateMs ? new Date(parseInt(dateMs, 10)) : new Date();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [editing, setEditing] = useState<PurchasesStorage.PurchaseLog | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const start = new Date(target);
        start.setHours(0, 0, 0, 0);
        const end = start.getTime() + 86_400_000;
        const all = await PurchasesStorage.getPurchases();
        setLogs(all.filter((l) => l.timestamp >= start.getTime() && l.timestamp < end).sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.warn('Failed to load spend report:', e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMs]);

  const save = async (d: ExpenseDraft) => {
    if (!editing) return;
    setSaving(true);
    try {
      await PurchasesStorage.updatePurchase(editing.id, d);
      const id = editing.id;
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...d } : l)));
      WidgetSync.sync();
      setEditing(null);
    } catch {
      Alert.alert('Error', 'Failed to update it.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await PurchasesStorage.deletePurchase(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      WidgetSync.sync();
    } catch {
      Alert.alert('Error', 'Failed to delete it.');
    }
  };

  const total = logs.reduce((s, l) => s + l.cost, 0);
  const byCat = Object.entries(logs.reduce<Record<string, number>>((a, l) => ((a[l.category] = (a[l.category] ?? 0) + l.cost), a), {})).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket="Spend · day" />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]} showsVerticalScrollIndicator={false}>
          <Text style={[Type.largeTitle, { color: C.textHi }]}>{target.toLocaleDateString('en-IN', { weekday: 'long' })}</Text>
          <Text style={[Type.dotLabel, { color: C.textMid }]}>
            {target.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>

          {loading ? (
            <Skeleton width="100%" height={170} borderRadius={28} />
          ) : (
            <Tile hue="spend" style={styles.hero}>
              <Donut size={120} stroke={16} slices={byCat.map(([c, v]) => ({ value: v, color: categoryMeta(c).color }))}>
                <MaterialCommunityIcons name="wallet" size={28} color={Hue.spend.main} />
              </Donut>
              <View style={styles.flex}>
                <View style={styles.amountRow}>
                  <Text style={[styles.rupee, { color: C.textHi }]}>₹</Text>
                  <Text style={[Type.dotNumber, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatAmount(total)}
                  </Text>
                </View>
                <Chip icon="receipt" label={`${logs.length} expense${logs.length === 1 ? '' : 's'}`} hue="spend" />
                {byCat.slice(0, 3).map(([c, v]) => (
                  <View key={c} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: categoryMeta(c).color }]} />
                    <Text style={[Type.subline, styles.flex, { color: C.textHi }]} numberOfLines={1}>
                      {c}
                    </Text>
                    <Text style={[Type.badge, { color: C.textMid }]}>₹{formatAmount(Math.round(v))}</Text>
                  </View>
                ))}
              </View>
            </Tile>
          )}

          <Text style={[Type.headline, styles.section, { color: C.textHi }]}>Expenses</Text>
          {!loading && logs.length === 0 && (
            <Tile style={styles.empty}>
              <MaterialCommunityIcons name="piggy-bank-outline" size={44} color={Hue.spend.main} />
              <Text style={[Type.body, { color: C.textMid }]}>Nothing spent this day.</Text>
            </Tile>
          )}
          {logs.map((l) => (
            <ExpenseRow key={l.id} log={l} onPress={() => setEditing(l)} />
          ))}
        </ScrollView>
      </SafeAreaView>

      <ExpenseSheet visible={!!editing} log={editing} saving={saving} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 10 },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.three },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 6 },
  rupee: { fontFamily: FontFace.displayBold, fontSize: 22, lineHeight: 36 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  section: { marginTop: Spacing.three },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
});
