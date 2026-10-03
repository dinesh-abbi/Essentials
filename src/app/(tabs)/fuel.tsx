import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CycleGrid } from '@/components/fuel/CycleGrid';
import { MealRow } from '@/components/fuel/MealRow';
import { MealScanSheet } from '@/components/fuel/MealScanSheet';
import { RestockSheet } from '@/components/fuel/RestockSheet';
import Bowl from '@/components/illustrations/Bowl';
import Skeleton from '@/components/SkeletonLoader';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { EntranceView } from '@/components/ui/entrance-view';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { BottomTabInset, Colors, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as Fuel from '@/utils/FuelStorage';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import { localDateKey } from '@/utils/userDocs';

type Palette = typeof Colors.dark;

export default function FuelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sheet?: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;
  const scrollHandler = useTabBarScrollHandler();

  const [start, setStart] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [logs, setLogs] = useState<Record<string, Fuel.DayMeals>>({});
  const [leftToBuy, setLeftToBuy] = useState(0);
  const [restockOpen, setRestockOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  useDataRefresh(['docs'], () => setReloadTick((n) => n + 1));

  const pos = start ? Fuel.positionFor(start) : null;

  const refreshRestock = useCallback(async (p: Fuel.CyclePosition) => {
    const bought = (await Fuel.getBought())[Fuel.windowKey(p)] ?? {};
    const due = Fuel.dueItems(p.day);
    const all = [...due.monthly, ...due.weekly, ...due.daily];
    setLeftToBuy(Fuel.sumCost(all.filter((i) => !bought[i.item])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      showTabBar();
      let cancelled = false;
      (async () => {
        const s = await Fuel.getCycleStart();
        if (cancelled) return;
        const p = Fuel.positionFor(s);
        setStart(s);
        setSelected(p.day);
        refreshRestock(p);
        // Opened from the restock notification / Home's restock-day link.
        if (params.sheet === 'restock') {
          setRestockOpen(true);
          router.setParams({ sheet: undefined });
        }
        const l = await Fuel.getMealLogs();
        if (!cancelled) setLogs(l);
      })();
      return () => {
        cancelled = true;
      };
      // reloadTick: re-read after a background revalidation lands.
    }, [refreshRestock, params.sheet, router, reloadTick]),
  );

  const selectedDate = start ? Fuel.dateForCycleDay(start, selected) : new Date();
  const dayLog = logs[localDateKey(selectedDate)];
  const plan = Fuel.planFor(selected);
  const isToday = pos?.day === selected;
  const isFuture = !!pos && selected > pos.day;
  const todayEaten = pos && start ? Fuel.eatenCount(logs[localDateKey(new Date())]) : 0;
  const restockIn = pos ? Fuel.daysUntilRestock(pos.day) : 0;
  const isRestockDay = !!pos && Fuel.RESTOCK_DAYS.includes(pos.day);

  const setMeal = async (meal: Fuel.MealType, status: Fuel.MealStatus | null, note?: string) => {
    // Optimistic — the row responds on the tap, storage catches up.
    const key = localDateKey(selectedDate);
    setLogs((prev) => {
      const day: Fuel.DayMeals = prev[key] ? { ...prev[key], meals: { ...prev[key].meals } } : { date: key, cycleDay: selected, meals: {} };
      if (status === null) delete day.meals[meal];
      else day.meals[meal] = { status, note, at: Date.now() };
      return { ...prev, [key]: day };
    });
    const next = await Fuel.setMealStatus(selectedDate, selected, meal, status, note);
    setLogs(next);
  };

  const align = async (day: number) => {
    const s = await Fuel.alignCycle(day);
    setStart(s);
    setSelected(day);
    setAlignOpen(false);
    refreshRestock(Fuel.positionFor(s));
    rescheduleRoutineReminders().catch(() => {});
  };

  const step = (delta: number) => setSelected((d) => ((d - 1 + delta + Fuel.CYCLE_LENGTH) % Fuel.CYCLE_LENGTH) + 1);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + Spacing.five }]}
        >
          <EntranceView index={0} style={styles.topRow}>
            <Text style={[Type.bracketLabel, { color: colors.textMid, flex: 1 }]}>
              <Text style={{ color: colors.water }}>[ FUEL ]</Text>
              {'  ·  28-day plan'}
            </Text>
            <HeaderIconButton icon="camera" accessibilityLabel="Scan a meal" onPress={() => setScanOpen(true)} />
            <HeaderIconButton icon="shopping-bag" accessibilityLabel="Restock list" onPress={() => setRestockOpen(true)} />
          </EntranceView>

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <EntranceView index={1} style={styles.hero}>
            {!pos ? (
              <View style={{ gap: Spacing.three }}>
                <Skeleton width={120} height={13} />
                <Skeleton width={180} height={88} />
              </View>
            ) : (
              <>
                <View style={styles.heroHead}>
                  <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ CYCLE DAY ]</Text>
                  <AnimatedPressable
                    onPress={() => setAlignOpen(true)}
                    haptic="light"
                    pressOpacity={0.7}
                    style={styles.inlineLink}
                    accessibilityRole="button"
                    accessibilityLabel="Realign the cycle to a different day"
                  >
                    <Text style={[Type.subline, { color: colors.water }]}>Realign</Text>
                  </AnimatedPressable>
                </View>
                <View style={styles.heroRow}>
                  <View style={styles.heroNumber}>
                    <AnimatedNumber value={pos.day} style={Type.hero} color={colors.textHi} height={92} />
                    <Text style={[Type.heroUnit, styles.heroUnit, { color: colors.textMid }]}>/ 28</Text>
                  </View>
                  <Bowl size={52} color={colors.water} />
                </View>
                <View style={styles.readouts}>
                  <Readout label="MEALS TODAY" value={`${todayEaten}/4`} colors={colors} />
                  <Readout
                    label="RESTOCK"
                    value={isRestockDay ? 'Today' : `in ${restockIn} d`}
                    colors={colors}
                    accent={isRestockDay}
                  />
                  <Readout label="WEEK" value={`${Math.ceil(pos.day / 7)} of 4`} colors={colors} />
                </View>
              </>
            )}
          </EntranceView>

          {/* ── Restock prompt ───────────────────────────────────────── */}
          {pos && isRestockDay && leftToBuy > 0 && (
            <EntranceView index={2}>
              <AnimatedPressable
                onPress={() => setRestockOpen(true)}
                haptic="light"
                pressOpacity={0.85}
                style={[styles.restock, { borderColor: colors.water, backgroundColor: colors.surface }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[Type.bracketLabel, { color: colors.water }]}>[ RESTOCK DAY ]</Text>
                  <Text style={[Type.body, { color: colors.textHi }]}>₹{leftToBuy.toLocaleString('en-IN')} of groceries still to buy</Text>
                </View>
                <Feather name="arrow-right" size={18} color={colors.water} />
              </AnimatedPressable>
            </EntranceView>
          )}

          {/* ── Cycle field ──────────────────────────────────────────── */}
          {pos && start && (
            <EntranceView index={3} style={[styles.section, { borderTopColor: colors.hairline }]}>
              <CycleGrid start={start} today={pos.day} selected={selected} logs={logs} colors={colors} onSelect={setSelected} />
            </EntranceView>
          )}

          {/* ── Day ──────────────────────────────────────────────────── */}
          {pos && (
            <EntranceView index={4} style={[styles.section, { borderTopColor: colors.hairline }]}>
              <View style={styles.dayHead}>
                <AnimatedPressable onPress={() => step(-1)} haptic="selection" style={[styles.navBtn, { borderColor: colors.hairline }]} accessibilityLabel="Previous day">
                  <Feather name="chevron-left" size={18} color={colors.textHi} />
                </AnimatedPressable>
                <View style={styles.dayTitle}>
                  <Text style={[Type.bracketLabel, { color: isToday ? colors.water : colors.textMid }]}>
                    [ {isToday ? 'TODAY' : isFuture ? 'COMING UP' : 'LOOKING BACK'} · DAY {selected} ]
                  </Text>
                  <Text style={[Type.title, { color: colors.textHi }]}>
                    {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <AnimatedPressable onPress={() => step(1)} haptic="selection" style={[styles.navBtn, { borderColor: colors.hairline }]} accessibilityLabel="Next day">
                  <Feather name="chevron-right" size={18} color={colors.textHi} />
                </AnimatedPressable>
              </View>
              {!isToday && (
                <AnimatedPressable onPress={() => setSelected(pos.day)} haptic="light" pressOpacity={0.7} style={[styles.inlineLink, styles.backToday]}>
                  <Feather name="corner-up-left" size={14} color={colors.water} />
                  <Text style={[Type.subline, { color: colors.water }]}>Back to today</Text>
                </AnimatedPressable>
              )}

              {plan ? (
                Fuel.MEALS.map((m) => (
                  <MealRow
                    key={m.type}
                    time={`${String(m.hour).padStart(2, '0')}:${String(m.minute).padStart(2, '0')}`}
                    label={m.label}
                    dish={plan[m.type]}
                    entry={dayLog?.meals[m.type]}
                    colors={colors}
                    locked={isFuture}
                    onSet={(status, note) => setMeal(m.type, status, note)}
                  />
                ))
              ) : (
                <Text style={[Type.body, { color: colors.textMid }]}>No plan for this day.</Text>
              )}

              <AnimatedPressable
                onPress={() => setScanOpen(true)}
                haptic="light"
                pressOpacity={0.85}
                style={[styles.scanPill, { borderColor: colors.hairline }]}
                accessibilityRole="button"
              >
                <Feather name="camera" size={16} color={colors.water} />
                <Text style={[Type.controlLabel, { color: colors.textHi }]}>Ate something else? Scan it</Text>
              </AnimatedPressable>
            </EntranceView>
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      <RestockSheet
        visible={restockOpen}
        position={pos}
        onClose={() => {
          setRestockOpen(false);
          if (pos) refreshRestock(pos);
        }}
      />
      <MealScanSheet visible={scanOpen} onClose={() => setScanOpen(false)} />

      <Sheet visible={alignOpen} onClose={() => setAlignOpen(false)} bracket="[ REALIGN ]" title="Which day of the plan is today?" heightRatio={0.6}>
        <View style={styles.alignGrid}>
          {Array.from({ length: Fuel.CYCLE_LENGTH }, (_, i) => i + 1).map((d) => {
            const on = d === pos?.day;
            return (
              <AnimatedPressable
                key={d}
                onPress={() => align(d)}
                haptic="selection"
                style={[styles.alignCell, on ? { backgroundColor: colors.water } : { borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth }]}
                accessibilityRole="button"
                accessibilityLabel={`Make today day ${d}`}
              >
                <Text style={[Type.readout, { fontSize: 17, color: on ? colors.onAccent : colors.textHi }]}>{d}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
        <Text style={[Type.subline, styles.alignNote, { color: colors.textMid }]}>
          Restock days follow: they always land on plan days 1, 8, 15 and 22.
        </Text>
      </Sheet>
    </View>
  );
}

function Readout({ label, value, colors, accent }: { label: string; value: string; colors: Palette; accent?: boolean }) {
  return (
    <View style={styles.readout}>
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ {label} ]</Text>
      <Text style={[styles.readoutValue, { color: accent ? colors.water : colors.textHi }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.four + Spacing.one, paddingTop: Spacing.three },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.five },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },

  hero: { marginBottom: Spacing.five, gap: Spacing.two },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroNumber: { flexDirection: 'row', alignItems: 'flex-end' },
  heroUnit: { marginLeft: Spacing.two, marginBottom: 14 },
  readouts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.three },
  readout: { gap: 2 },
  readoutValue: { ...Type.readout, fontSize: 22, lineHeight: 28 },

  restock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three + 2,
    marginBottom: Spacing.five,
  },

  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.four, marginBottom: Spacing.five },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dayTitle: { flex: 1, alignItems: 'center', gap: 2 },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToday: { alignSelf: 'center', marginTop: Spacing.one },
  scanPill: {
    marginTop: Spacing.four,
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  alignGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.four, gap: Spacing.two },
  alignCell: {
    width: '12.4%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignNote: { paddingHorizontal: Spacing.four, marginTop: Spacing.four },
});
