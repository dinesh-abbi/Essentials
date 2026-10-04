import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CycleGrid } from '@/components/fuel/CycleGrid';
import { MEAL_ICONS } from '@/components/fuel/meal-icons';
import { MealRow } from '@/components/fuel/MealRow';
import { RestockSheet } from '@/components/fuel/RestockSheet';
import Skeleton from '@/components/SkeletonLoader';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { LargeHeader } from '@/components/ui/large-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Sheet } from '@/components/ui/sheet';
import { BottomTabInset, Colors, Hue, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as Fuel from '@/utils/FuelStorage';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import { localDateKey } from '@/utils/userDocs';

const C = Colors.dark;

/**
 * Fuel — the 28-day plan as a ring (where you are in the cycle), a dot field
 * (how the month went), and today's four meals as cards you answer with one
 * tap: Ate / Swap / Skip.
 */
export default function FuelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sheet?: string }>();
  const insets = useSafeAreaInsets();
  const scrollHandler = useTabBarScrollHandler();

  const [start, setStart] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [logs, setLogs] = useState<Record<string, Fuel.DayMeals>>({});
  const [leftToBuy, setLeftToBuy] = useState(0);
  const [restockOpen, setRestockOpen] = useState(false);
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
        // Opened from the restock notification / Home's restock badge.
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
  const todayLog = logs[localDateKey(new Date())];
  const todayEaten = Fuel.eatenCount(todayLog);
  const restockIn = pos ? Fuel.daysUntilRestock(pos.day) : 0;
  const isRestockDay = !!pos && Fuel.RESTOCK_DAYS.includes(pos.day);

  const setMeal = async (meal: Fuel.MealType, status: Fuel.MealStatus | null, note?: string) => {
    // Optimistic — the card responds on the tap, storage catches up.
    const key = localDateKey(selectedDate);
    setLogs((prev) => {
      const day: Fuel.DayMeals = prev[key] ? { ...prev[key], meals: { ...prev[key].meals } } : { date: key, cycleDay: selected, meals: {} };
      if (status === null) delete day.meals[meal];
      else day.meals[meal] = { status, note, at: Date.now() };
      return { ...prev, [key]: day };
    });
    setLogs(await Fuel.setMealStatus(selectedDate, selected, meal, status, note));
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
  const fuel = Hue.fuel;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + Spacing.five }]}
        >
          <EntranceView index={0}>
            <LargeHeader
              eyebrow={pos ? `Week ${Math.ceil(pos.day / 7)} of 4 · 28-day plan` : '28-day plan'}
              title="Fuel"
              right={
                <ChunkyButton
                  icon="cart"
                  variant={isRestockDay ? 'solid' : 'soft'}
                  hue="spend"
                  size="md"
                  haptic="light"
                  onPress={() => setRestockOpen(true)}
                  accessibilityLabel="Restock list"
                />
              }
            />
          </EntranceView>

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <EntranceView index={1}>
            {!pos ? (
              <Skeleton width="100%" height={176} borderRadius={28} />
            ) : (
              <Tile hue="fuel" style={styles.heroFace}>
                <AnimatedPressable onPress={() => setAlignOpen(true)} haptic="light" pressScale={0.95} accessibilityRole="button" accessibilityLabel={`Day ${pos.day} of 28. Tap to realign the cycle.`}>
                  <ProgressRing size={132} stroke={15} progress={pos.day / Fuel.CYCLE_LENGTH} color={fuel.main} track={fuel.soft}>
                    <Text style={[Type.dotLabel, { color: C.textMid }]}>Day</Text>
                    <AnimatedNumber value={pos.day} style={Type.dotHero} color={C.textHi} height={62} />
                  </ProgressRing>
                </AnimatedPressable>
                <View style={styles.heroSide}>
                  <Text style={[Type.dotLabel, { color: fuel.main }]}>Today’s plates</Text>
                  <View style={styles.plates}>
                    {Fuel.MEALS.map((m) => {
                      const s = todayLog?.meals[m.type]?.status;
                      const on = s === 'eaten' || s === 'swapped';
                      return (
                        <View key={m.type} style={[styles.plate, { backgroundColor: on ? fuel.main : s === 'missed' ? C.alertWeak : C.surface2 }]}>
                          <MaterialCommunityIcons name={MEAL_ICONS[m.type]} size={17} color={on ? fuel.on : s === 'missed' ? C.alert : C.textLow} />
                        </View>
                      );
                    })}
                  </View>
                  <Text style={[Type.subline, { color: C.textMid }]}>{todayEaten} of 4 eaten</Text>
                  <Chip
                    icon="cart"
                    label={isRestockDay ? 'Restock today' : `Restock in ${restockIn}d`}
                    hue="spend"
                    solid={isRestockDay}
                  />
                </View>
              </Tile>
            )}
          </EntranceView>

          {/* ── Restock prompt ───────────────────────────────────────── */}
          {pos && isRestockDay && leftToBuy > 0 && (
            <EntranceView index={2}>
              <Tile hue="spend" onPress={() => setRestockOpen(true)} style={styles.restockFace} accessibilityLabel={`Restock day. ₹${leftToBuy} of groceries still to buy.`}>
                <IconBlob name="cart" hue="spend" size={46} />
                <View style={styles.flex}>
                  <Text style={[Type.title, { color: C.textHi }]}>₹{leftToBuy.toLocaleString('en-IN')} to buy</Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>Tick items as you shop</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Hue.spend.main} />
              </Tile>
            </EntranceView>
          )}

          {/* ── Cycle field ──────────────────────────────────────────── */}
          {pos && start && (
            <EntranceView index={3}>
              <Tile style={styles.gridFace}>
                <View style={styles.gridHead}>
                  <Text style={[Type.dotLabel, { color: C.textMid }]}>This cycle</Text>
                  <AnimatedPressable onPress={() => setAlignOpen(true)} haptic="light" style={styles.inline} accessibilityRole="button">
                    <MaterialCommunityIcons name="calendar-sync" size={16} color={fuel.main} />
                    <Text style={[Type.badge, { color: fuel.main }]}>Realign</Text>
                  </AnimatedPressable>
                </View>
                <CycleGrid start={start} today={pos.day} selected={selected} logs={logs} colors={C} onSelect={setSelected} />
              </Tile>
            </EntranceView>
          )}

          {/* ── Day ──────────────────────────────────────────────────── */}
          {pos && (
            <EntranceView index={4} style={styles.day}>
              <View style={styles.dayHead}>
                <ChunkyButton icon="chevron-left" variant="soft" hue="fuel" size="md" haptic="selection" onPress={() => step(-1)} accessibilityLabel="Previous day" />
                <View style={styles.dayTitle}>
                  <Chip
                    label={isToday ? 'Today' : isFuture ? 'Coming up' : 'Looking back'}
                    hue={isToday ? 'fuel' : undefined}
                    solid={isToday}
                    style={styles.selfCenter}
                  />
                  <Text style={[Type.title, { color: C.textHi }]} numberOfLines={1}>
                    {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <ChunkyButton icon="chevron-right" variant="soft" hue="fuel" size="md" haptic="selection" onPress={() => step(1)} accessibilityLabel="Next day" />
              </View>
              {!isToday && (
                <ChunkyButton label="Back to today" icon="undo-variant" variant="soft" hue="fuel" size="sm" haptic="light" onPress={() => setSelected(pos.day)} style={styles.selfCenter} />
              )}

              {plan ? (
                Fuel.MEALS.map((m) => (
                  <MealRow
                    key={m.type}
                    time={`${String(m.hour).padStart(2, '0')}:${String(m.minute).padStart(2, '0')}`}
                    label={m.label}
                    icon={MEAL_ICONS[m.type]}
                    dish={plan[m.type]}
                    entry={dayLog?.meals[m.type]}
                    colors={C}
                    locked={isFuture}
                    onSet={(status, note) => setMeal(m.type, status, note)}
                  />
                ))
              ) : (
                <Text style={[Type.body, { color: C.textMid }]}>No plan for this day.</Text>
              )}
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

      <Sheet visible={alignOpen} onClose={() => setAlignOpen(false)} bracket="Realign" title="Which plan day is today?" heightRatio={0.62}>
        <View style={styles.alignGrid}>
          {Array.from({ length: Fuel.CYCLE_LENGTH }, (_, i) => i + 1).map((d) => {
            const on = d === pos?.day;
            return (
              <AnimatedPressable
                key={d}
                onPress={() => align(d)}
                haptic="selection"
                pressScale={0.88}
                style={[styles.alignCell, { backgroundColor: on ? fuel.main : C.surface2 }]}
                accessibilityRole="button"
                accessibilityLabel={`Make today day ${d}`}
              >
                <Text style={[Type.dotSmall, { color: on ? fuel.on : C.textHi }]}>{d}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
        <Text style={[Type.subline, styles.alignNote, { color: C.textMid }]}>Restock days stay on plan days 1, 8, 15 and 22.</Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.three, gap: 12 },
  flex: { flex: 1 },
  selfCenter: { alignSelf: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },

  heroFace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 18 },
  heroSide: { flex: 1, gap: 8 },
  plates: { flexDirection: 'row', gap: 6 },
  plate: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  restockFace: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  gridFace: { gap: 8 },
  gridHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  day: { marginTop: Spacing.three, gap: 12 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayTitle: { flex: 1, alignItems: 'center', gap: 6 },

  alignGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.four, gap: 8 },
  alignCell: {
    width: '12.4%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignNote: { paddingHorizontal: Spacing.four, marginTop: Spacing.four },
});
