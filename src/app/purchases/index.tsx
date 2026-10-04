import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AppLoader from '@/components/AppLoader';
import Skeleton from '@/components/SkeletonLoader';
import { categoryMeta } from '@/components/spend/categories';
import { ExpenseRow, formatAmount } from '@/components/spend/ExpenseRow';
import { ExpenseSheet, type ExpenseDraft } from '@/components/spend/ExpenseSheet';
import { BarChart } from '@/components/ui/bar-chart';
import { Chip, ChunkyButton, Tile } from '@/components/ui/chunky';
import { Donut } from '@/components/ui/donut';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { StatGrid, StatTile } from '@/components/ui/stat-tile';
import { Colors, FontFace, Hue, Radius, Spacing, Type } from '@/constants/theme';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WidgetSync from '@/utils/WidgetSync';

export { CATEGORIES } from '@/components/spend/categories';
export type CategoryType = string;

const C = Colors.dark;
const S = Hue.spend;
type Tab = 'daily' | 'weekly' | 'monthly';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY = 86_400_000;

type Row = { kind: 'header'; key: string; label: string; total: number } | { kind: 'log'; key: string; log: PurchasesStorage.PurchaseLog };

/**
 * Spend — Day / Week / Month. Day: today's total big, one button to add, and
 * every expense grouped by day with its category picture. Week: bars per day.
 * Month: a category donut and the top categories as coloured bars.
 */
function SpendTrackerContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('daily');

  const [logs, setLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; log: PurchasesStorage.PurchaseLog | null }>({ open: false, log: null });
  const [weekOffset, setWeekOffset] = useState(0);
  const [month, setMonth] = useState(() => new Date());
  // Frozen at mount so render stays pure; the screen is short-lived.
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      try {
        setLogs((await PurchasesStorage.getPurchases()).sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.warn('Failed to load purchases', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────
  const save = async (d: ExpenseDraft) => {
    setSaving(true);
    try {
      if (sheet.log) {
        await PurchasesStorage.updatePurchase(sheet.log.id, d);
        const id = sheet.log.id;
        setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...d } : l)).sort((a, b) => b.timestamp - a.timestamp));
      } else {
        const created = await PurchasesStorage.savePurchase(d.name, d.cost, d.category, d.timestamp);
        setLogs((prev) => [created, ...prev].sort((a, b) => b.timestamp - a.timestamp));
      }
      WidgetSync.sync();
      setSheet({ open: false, log: null });
    } catch {
      Alert.alert('Error', 'Failed to save that expense.');
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

  const wipeAll = () =>
    Alert.alert('Erase all expenses?', 'This removes your whole spend history on every device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase all',
        style: 'destructive',
        onPress: async () => {
          try {
            await PurchasesStorage.clearPurchases();
            setLogs([]);
            WidgetSync.sync();
          } catch {
            Alert.alert('Error', 'Failed to clear data.');
          }
        },
      },
    ]);

  // ── Day ──────────────────────────────────────────────────────────────────
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l) => l.timestamp >= midnight.getTime());
  const todayTotal = todayLogs.reduce((s, l) => s + l.cost, 0);
  const allTime = logs.reduce((s, l) => s + l.cost, 0);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let current = '';
    let header: Extract<Row, { kind: 'header' }> | null = null;
    for (const l of logs) {
      const key = new Date(l.timestamp).toDateString();
      if (key !== current) {
        current = key;
        header = { kind: 'header', key: `h-${key}`, label: dayLabel(new Date(l.timestamp)), total: 0 };
        out.push(header);
      }
      header!.total += l.cost;
      out.push({ kind: 'log', key: l.id, log: l });
    }
    return out;
  }, [logs]);

  // ── Week ─────────────────────────────────────────────────────────────────
  const ref = new Date(openedAt + weekOffset * 7 * DAY);
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ((ref.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i).getTime();
    const amount = logs.filter((l) => l.timestamp >= start && l.timestamp < start + DAY).reduce((s, l) => s + l.cost, 0);
    return { date: new Date(start), amount };
  });
  const weekTotal = week.reduce((s, d) => s + d.amount, 0);
  const weekMax = Math.max(0, ...week.map((d) => d.amount));
  const weekCount = logs.filter((l) => l.timestamp >= monday.getTime() && l.timestamp < monday.getTime() + 7 * DAY).length;
  const todayKey = new Date().toDateString();

  // ── Month ────────────────────────────────────────────────────────────────
  const y = month.getFullYear();
  const m = month.getMonth();
  const monthLogs = logs.filter((l) => {
    const d = new Date(l.timestamp);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const monthTotal = monthLogs.reduce((s, l) => s + l.cost, 0);
  const byCat = Object.entries(
    monthLogs.reduce<Record<string, number>>((acc, l) => ((acc[l.category] = (acc[l.category] ?? 0) + l.cost), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

  const goTab = (t: Tab) => {
    setTab(t);
    pager.current?.scrollTo({ x: ['daily', 'weekly', 'monthly'].indexOf(t) * windowWidth, animated: true });
  };
  const pageBottom = { paddingBottom: insets.bottom + Spacing.six };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader
            bracket="Spend"
            right={
              <ChunkyButton icon="qrcode-scan" variant="soft" hue="spend" size="md" haptic="light" onPress={() => router.push('/upi/scanner' as any)} accessibilityLabel="Scan a UPI QR to pay" />
            }
          />
          <Segmented
            hue="spend"
            value={tab}
            onChange={goTab}
            options={[
              { value: 'daily', label: 'Day' },
              { value: 'weekly', label: 'Week' },
              { value: 'monthly', label: 'Month' },
            ]}
          />
        </View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setTab((['daily', 'weekly', 'monthly'] as Tab[])[Math.round(e.nativeEvent.contentOffset.x / windowWidth)] ?? 'daily')}
        >
          {/* ── Day ───────────────────────────────────────────────────── */}
          <View style={{ width: windowWidth }}>
            <FlatList
              data={loading ? [] : rows}
              keyExtractor={(r) => r.key}
              contentContainerStyle={[styles.page, pageBottom]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={styles.dayHead}>
                  <Tile hue="spend" style={styles.hero}>
                    <View style={styles.heroTop}>
                      <View style={styles.flex}>
                        <Text style={[Type.dotLabel, { color: S.main }]}>Today</Text>
                        <View style={styles.amountRow}>
                          <Text style={[styles.rupeeBig, { color: C.textHi }]}>₹</Text>
                          <Text style={[Type.dotHero, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatAmount(todayTotal)}
                          </Text>
                        </View>
                      </View>
                      <Donut size={74} stroke={11} slices={todayLogs.map((l) => ({ value: l.cost, color: categoryMeta(l.category).color }))}>
                        <MaterialCommunityIcons name="wallet" size={24} color={S.main} />
                      </Donut>
                    </View>
                    <View style={styles.chips}>
                      <Chip icon="receipt" label={`${todayLogs.length} today`} hue="spend" />
                      <Chip icon="sigma" label={`₹${formatAmount(Math.round(allTime))} all time`} />
                    </View>
                    <ChunkyButton label="Add expense" icon="plus" hue="spend" onPress={() => setSheet({ open: true, log: null })} />
                  </Tile>
                  {loading && (
                    <View style={styles.skeletons}>
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} width="100%" height={64} borderRadius={22} />
                      ))}
                    </View>
                  )}
                </View>
              }
              renderItem={({ item }) =>
                item.kind === 'header' ? (
                  <View style={styles.groupHead}>
                    <Text style={[Type.dotLabel, { color: C.textMid }]}>{item.label}</Text>
                    <Text style={[Type.badge, { color: C.textMid }]}>₹{formatAmount(Math.round(item.total))}</Text>
                  </View>
                ) : (
                  <ExpenseRow log={item.log} onPress={() => setSheet({ open: true, log: item.log })} />
                )
              }
              ListEmptyComponent={
                loading ? null : (
                  <Tile style={styles.empty}>
                    <MaterialCommunityIcons name="piggy-bank-outline" size={44} color={S.main} />
                    <Text style={[Type.body, { color: C.textMid }]}>No expenses yet — add your first one.</Text>
                  </Tile>
                )
              }
              ListFooterComponent={
                logs.length > 0 ? (
                  <ChunkyButton label="Erase all expenses" icon="delete-sweep-outline" variant="soft" hue="alarm" textColor={C.alert} size="sm" onPress={wipeAll} style={styles.wipe} />
                ) : null
              }
            />
          </View>

          {/* ── Week ──────────────────────────────────────────────────── */}
          <ScrollView style={{ width: windowWidth }} contentContainerStyle={[styles.page, pageBottom]} showsVerticalScrollIndicator={false}>
            <Stepper
              title={weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${-weekOffset} weeks ago`}
              subtitle={`${fmtShort(week[0].date)} – ${fmtShort(week[6].date)}`}
              onPrev={() => setWeekOffset((w) => w - 1)}
              onNext={() => setWeekOffset((w) => Math.min(0, w + 1))}
              nextDisabled={weekOffset === 0}
            />
            <Tile style={styles.chart}>
              <BarChart
                hue="spend"
                height={150}
                bars={week.map((d, i) => ({
                  label: WEEKDAYS[i],
                  value: d.amount,
                  caption: d.amount ? compact(d.amount) : '',
                  strong: d.amount > 0 && d.amount === weekMax,
                  selected: d.date.toDateString() === todayKey,
                  onPress: () => router.push({ pathname: '/purchases/report' as any, params: { dateMs: d.date.getTime().toString() } }),
                }))}
              />
              <Text style={[Type.subline, { color: C.textMid }]}>Bright bar = biggest day · tap a day for details</Text>
            </Tile>
            <StatGrid>
              <StatTile icon="cash-multiple" hue="spend" prefix="₹" value={formatAmount(Math.round(weekTotal))} label="this week" />
              <StatTile icon="calendar-today" hue="water" prefix="₹" value={formatAmount(Math.round(weekTotal / 7))} label="a day" />
              <StatTile icon="arrow-up-bold" hue="train" prefix="₹" value={formatAmount(Math.round(weekMax))} label="biggest day" />
              <StatTile icon="receipt" hue="checkin" value={`${weekCount}`} label="expenses" />
            </StatGrid>
          </ScrollView>

          {/* ── Month ─────────────────────────────────────────────────── */}
          <ScrollView style={{ width: windowWidth }} contentContainerStyle={[styles.page, pageBottom]} showsVerticalScrollIndicator={false}>
            <Stepper
              title={month.toLocaleString('default', { month: 'long' })}
              subtitle={`${y}`}
              onPrev={() => setMonth(new Date(y, m - 1, 1))}
              onNext={() => setMonth(new Date(y, m + 1, 1))}
            />
            <Tile hue="spend" style={styles.monthHero}>
              <Donut size={150} stroke={20} slices={byCat.map(([cat, v]) => ({ value: v, color: categoryMeta(cat).color }))}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>Spent</Text>
                <Text style={[Type.dotSmall, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
                  {compact(monthTotal)}
                </Text>
              </Donut>
              <View style={styles.monthSide}>
                {byCat.slice(0, 4).map(([cat, v]) => (
                  <View key={cat} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: categoryMeta(cat).color }]} />
                    <Text style={[Type.subline, styles.flex, { color: C.textHi }]} numberOfLines={1}>
                      {cat}
                    </Text>
                    <Text style={[Type.badge, { color: C.textMid }]}>{Math.round((v / monthTotal) * 100)}%</Text>
                  </View>
                ))}
                {byCat.length === 0 && <Text style={[Type.subline, { color: C.textMid }]}>Nothing this month</Text>}
              </View>
            </Tile>

            {byCat.length > 0 && (
              <Tile style={styles.cats}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>By category</Text>
                {byCat.map(([cat, v]) => {
                  const meta = categoryMeta(cat);
                  return (
                    <View key={cat} style={styles.catRow}>
                      <View style={[styles.catIcon, { backgroundColor: meta.color + '2E' }]}>
                        <MaterialCommunityIcons name={meta.icon} size={18} color={meta.color} />
                      </View>
                      <View style={styles.flex}>
                        <View style={styles.catTop}>
                          <Text style={[Type.controlLabel, { color: C.textHi, fontSize: 14 }]}>{cat}</Text>
                          <Text style={[Type.badge, { color: C.textMid }]}>₹{formatAmount(Math.round(v))}</Text>
                        </View>
                        <View style={[styles.track, { backgroundColor: C.surface2 }]}>
                          <View style={[styles.fill, { width: `${Math.max(4, (v / byCat[0][1]) * 100)}%`, backgroundColor: meta.color }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Tile>
            )}

            <StatGrid>
              <StatTile icon="receipt" hue="checkin" value={`${monthLogs.length}`} label="expenses" />
              <StatTile icon="scale-balance" hue="water" prefix="₹" value={formatAmount(Math.round(monthLogs.length ? monthTotal / monthLogs.length : 0))} label="each, avg" />
            </StatGrid>
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      <ExpenseSheet
        visible={sheet.open}
        log={sheet.log}
        saving={saving}
        onClose={() => setSheet({ open: false, log: null })}
        onSave={save}
        onDelete={remove}
      />
    </View>
  );
}

function Stepper({
  title,
  subtitle,
  onPrev,
  onNext,
  nextDisabled,
}: {
  title: string;
  subtitle?: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <ChunkyButton icon="chevron-left" variant="soft" hue="spend" size="md" haptic="selection" onPress={onPrev} accessibilityLabel="Previous" />
      <View style={styles.stepperText}>
        <Text style={[Type.title, { color: C.textHi }]}>{title}</Text>
        {subtitle ? <Text style={[Type.dotLabel, { color: C.textMid }]}>{subtitle}</Text> : null}
      </View>
      <ChunkyButton icon="chevron-right" variant="soft" hue="spend" size="md" haptic="selection" onPress={onNext} disabled={nextDisabled} accessibilityLabel="Next" />
    </View>
  );
}

const fmtShort = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });

/** ₹1.2k style for chart captions. */
const compact = (n: number) => (n >= 100_000 ? `${(n / 100_000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

function dayLabel(d: Date) {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export default function SpendTrackerScreen() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    async function authenticateUser() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock Spend',
            fallbackLabel: 'Use device passcode',
            disableDeviceFallback: false,
          });
          if (result.success) setIsAuthenticated(true);
          else {
            Alert.alert('Locked', 'Unlock is needed to see your spending.');
            router.back();
          }
        } else {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Biometric auth failed', e);
        Alert.alert('Security error', 'Biometric check failed.');
        router.back();
      } finally {
        setIsVerifying(false);
      }
    }
    authenticateUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isVerifying) return <AppLoader label="Unlocking…" />;
  if (!isAuthenticated) return null;
  return <SpendTrackerContent />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three, gap: 10, paddingBottom: 10 },
  page: { paddingHorizontal: Spacing.three, paddingTop: 6, gap: 12 },
  flex: { flex: 1 },

  dayHead: { gap: 12, marginBottom: 4 },
  hero: { gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  rupeeBig: { fontFamily: FontFace.displayBold, fontSize: 34, lineHeight: 58 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skeletons: { gap: 8 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6, paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  wipe: { marginTop: Spacing.four },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperText: { flex: 1, alignItems: 'center' },
  chart: { gap: 12, paddingTop: 20 },

  monthHero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  monthSide: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  cats: { gap: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
