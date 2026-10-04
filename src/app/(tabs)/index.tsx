import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MEAL_ICONS } from '@/components/fuel/meal-icons';
import Droplet from '@/components/illustrations/Droplet';
import Skeleton from '@/components/SkeletonLoader';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { DotMeter, LiveDot } from '@/components/ui/dots';
import { EntranceView } from '@/components/ui/entrance-view';
import { LargeHeader } from '@/components/ui/large-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import {
  BottomTabInset,
  Colors,
  FontFace,
  Hue,
  MaxContentWidth,
  Spacing,
  Type,
  type HueName,
} from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as AttendanceStorage from '@/utils/AttendanceStorage';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';
import * as FuelStorage from '@/utils/FuelStorage';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import { showTabBar, useTabBarScrollHandler } from '@/utils/tabBarVisibility';
import * as TrainingStorage from '@/utils/TrainingStorage';
import { localDateKey } from '@/utils/userDocs';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';

const C = Colors.dark;

/** UI-only daily budget for the spend tile (nothing persists a budget). */
const DAILY_SPEND_BUDGET = 800;
const SPARK_DAYS = 7;
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06–22, WaterStorage's window
const HOUR_LABELS: Record<number, string> = { 6: '6a', 12: '12p', 18: '6p', 22: '10p' };

type TrainingSummary = { focus: string; done: number; total: number; logged: boolean; streak: number };
type FuelSummary = { day: number; meals: Partial<Record<FuelStorage.MealType, FuelStorage.MealStatus>>; restock: boolean };

/**
 * Home — "today at a glance".
 *
 *   header      One UI large title, dot-matrix date, avatar
 *   rings       Apple-style rings: water · meals · training, one look
 *   water       Drip the mascot fills up and cheers as you drink; tap it to log
 *   bento       four chunky tiles (train, fuel, spend, check-in), each a
 *               picture first and a number second
 *   alarm       only when armed
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { quicklog } = useLocalSearchParams<{ quicklog?: string }>();
  const insets = useSafeAreaInsets();
  const tabBarScrollHandler = useTabBarScrollHandler();

  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoal, setWaterGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [hourly, setHourly] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [bumpTick, setBumpTick] = useState(0);
  const [todaySpend, setTodaySpend] = useState(0);
  const [spendCount, setSpendCount] = useState(0);
  const [spendSeries, setSpendSeries] = useState<number[]>(() => Array(SPARK_DAYS).fill(0));
  const [checkIn, setCheckIn] = useState<number | null>(null);
  const [pendingCheckIns, setPendingCheckIns] = useState(0);
  const [alarm, setAlarm] = useState<BarcodeAlarmStorage.BarcodeAlarmConfig | null>(null);
  const [training, setTraining] = useState<TrainingSummary | null>(null);
  const [fuel, setFuel] = useState<FuelSummary | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      showTabBar();
      let cancelled = false;
      (async () => {
        // Every read here is cache-first, so revisits update in place and
        // the skeleton only shows on the very first paint.
        try {
          const [queue, lastCheckIn, purchases, alarmCfg] = await Promise.all([
            AttendanceStorage.getOfflineQueue(),
            AttendanceStorage.getLastCheckInTime(),
            PurchasesStorage.getPurchases(),
            BarcodeAlarmStorage.getAlarmConfig(),
          ]);
          if (cancelled) return;
          setPendingCheckIns(queue.length);
          setCheckIn(lastCheckIn);
          setAlarm(alarmCfg);

          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const todayPs = purchases.filter((p) => p.timestamp >= midnight.getTime());
          setTodaySpend(todayPs.reduce((a, c) => a + c.cost, 0));
          setSpendCount(todayPs.length);
          const buckets = Array(SPARK_DAYS).fill(0);
          for (const p of purchases) {
            if (p.timestamp >= midnight.getTime()) buckets[SPARK_DAYS - 1] += p.cost;
            else {
              const age = Math.floor((midnight.getTime() - p.timestamp) / 86_400_000);
              const idx = SPARK_DAYS - 2 - age;
              if (idx >= 0) buckets[idx] += p.cost;
            }
          }
          setSpendSeries(buckets);

          let total = await WaterStorage.getTodayTotalMl();
          const widget = await WidgetSync.readWidgetData();
          if (widget && !widget.isStale && widget.waterMl > total) total = widget.waterMl;
          const [hours, goal] = await Promise.all([WaterStorage.getTodayHourlyStatus(), WaterStorage.getUserWaterGoal()]);
          if (cancelled) return;
          setWaterMl(total);
          setHourly(hours);
          setWaterGoal(goal);

          const [split, offset, dayState, cycleStart] = await Promise.all([
            TrainingStorage.getCachedSplit(),
            TrainingStorage.getScheduleOffset(),
            TrainingStorage.getDayState(),
            FuelStorage.getCycleStart(),
          ]);
          const today = TrainingStorage.dayForSlot(split.days, TrainingStorage.splitSlotFor(new Date(), offset));
          const base = {
            focus: today.focus,
            done: today.exercises.filter((e) => dayState.completed[e.id]).length,
            total: today.exercises.length,
            logged: !!dayState.finishedAt,
          };
          if (cancelled) return;
          setTraining((prev) => ({ ...base, streak: prev?.streak ?? 0 }));
          const pos = FuelStorage.positionFor(cycleStart);
          const restock = FuelStorage.RESTOCK_DAYS.includes(pos.day);
          setFuel((prev) => ({ day: pos.day, restock, meals: prev?.meals ?? {} }));
          setNow(new Date());
          WidgetSync.sync();

          // Slower (possibly network-backed on a cold cache) — fill in after.
          FuelStorage.getMealLogs()
            .then((logs) => {
              if (cancelled) return;
              const entries = logs[localDateKey()]?.meals ?? {};
              const meals: FuelSummary['meals'] = {};
              (Object.keys(entries) as FuelStorage.MealType[]).forEach((k) => (meals[k] = entries[k]?.status));
              setFuel({ day: pos.day, restock, meals });
            })
            .catch(() => {});
          TrainingStorage.getRecentSessions()
            .then((s) => !cancelled && setTraining({ ...base, streak: TrainingStorage.currentStreak(s, split.days, offset) }))
            .catch(() => {});
        } catch (e) {
          console.error('Home load failed', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [reloadTick]),
  );
  useDataRefresh(['water', 'purchases', 'docs'], () => setReloadTick((n) => n + 1));

  const refreshWater = async () => {
    setWaterMl(await WaterStorage.getTodayTotalMl());
    setHourly(await WaterStorage.getTodayHourlyStatus());
    WidgetSync.sync();
  };

  const addWater = async (amount: number) => {
    setSaving(true);
    try {
      await WaterStorage.logWaterIntake(amount);
      setBumpTick((n) => n + 1);
      await refreshWater();
    } catch (e) {
      console.error('Add water failed', e);
    } finally {
      setSaving(false);
    }
  };

  const undoWater = async () => {
    setSaving(true);
    try {
      const logs = (await WaterStorage.getTodayWaterLogs()).sort((a, b) => b.timestamp - a.timestamp);
      if (logs.length) {
        await WaterStorage.deleteWaterLog(logs[0].id);
        await refreshWater();
      }
    } catch (e) {
      console.error('Undo water failed', e);
    } finally {
      setSaving(false);
    }
  };

  // Widget quick-log arrives as a route param. Declared below addWater so it
  // never captures a stale binding.
  useEffect(() => {
    if (!quicklog) return;
    const amount = Number(quicklog);
    router.setParams({ quicklog: undefined });
    // Deferred a tick so the log's state updates don't run inside the effect body.
    if (!Number.isNaN(amount) && amount > 0) Promise.resolve().then(() => addWater(amount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quicklog]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const waterRatio = waterGoal > 0 ? waterMl / waterGoal : 0;
  const mealsEaten = fuel ? Object.values(fuel.meals).filter((s) => s === 'eaten' || s === 'swapped').length : 0;
  const isRest = !!training && training.total === 0;
  const trainRatio = !training ? 0 : isRest ? 1 : training.logged ? 1 : training.done / training.total;

  const firstName = (user?.displayName ?? user?.email?.split('@')[0] ?? 'there').split(' ')[0];
  const photoUrl = user?.photoURL ?? null;
  const hour = now.getHours();
  const hello = hour < 5 ? 'Night owl' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + insets.bottom + Spacing.four }]}
          showsVerticalScrollIndicator={false}
          onScroll={tabBarScrollHandler}
          scrollEventThrottle={16}
        >
          <EntranceView index={0}>
            <LargeHeader
              eyebrow={`${formatDay(now)} · ${hello}`}
              title={`Hi, ${firstName}`}
              right={
                <AnimatedPressable
                  onPress={() => router.navigate('/profile' as any)}
                  haptic="light"
                  style={[styles.avatar, { borderColor: Hue.profile.main }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open your profile"
                >
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <Text style={[Type.controlLabel, { color: C.textHi }]}>{firstName.slice(0, 1).toUpperCase()}</Text>
                  )}
                </AnimatedPressable>
              }
            />
          </EntranceView>

          {loading ? (
            <View style={{ gap: 12 }}>
              <Skeleton width="100%" height={170} borderRadius={28} />
              <Skeleton width="100%" height={260} borderRadius={28} />
              <Skeleton width="100%" height={180} borderRadius={28} />
            </View>
          ) : (
            <>
              {/* ── Rings ───────────────────────────────────────────────── */}
              <EntranceView index={1}>
                <Tile style={styles.ringsFace}>
                  <TodayRings water={waterRatio} meals={mealsEaten / 4} train={trainRatio} />
                  <View style={styles.legend}>
                    <LegendRow
                      hue="water"
                      icon="water"
                      value={`${(waterMl / 1000).toFixed(1)}/${(waterGoal / 1000).toFixed(1)}`}
                      unit="L"
                      onPress={() => router.push('/water')}
                    />
                    <LegendRow
                      hue="fuel"
                      icon="silverware-fork-knife"
                      value={`${mealsEaten}/4`}
                      unit="meals"
                      onPress={() => router.navigate('/fuel' as any)}
                    />
                    <LegendRow
                      hue="train"
                      icon={isRest ? 'sleep' : 'dumbbell'}
                      value={isRest ? 'Rest' : `${training?.done ?? 0}/${training?.total ?? 0}`}
                      unit={isRest ? '' : 'moves'}
                      onPress={() => router.navigate('/train' as any)}
                    />
                  </View>
                </Tile>
              </EntranceView>

              {/* ── Water ───────────────────────────────────────────────── */}
              <EntranceView index={2}>
                <Tile hue="water" style={styles.waterFace}>
                  <View style={styles.waterTop}>
                    <AnimatedPressable
                      onPress={() => addWater(250)}
                      disabled={saving}
                      haptic="medium"
                      pressScale={0.92}
                      accessibilityRole="button"
                      accessibilityLabel={`Water: ${waterMl} of ${waterGoal} millilitres. Tap the drop to log 250 millilitres.`}
                    >
                      <Droplet ratio={waterRatio} size={104} bumpTick={bumpTick} />
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => router.push('/water')}
                      haptic="light"
                      pressScale={0.98}
                      style={styles.waterNumbers}
                      accessibilityRole="button"
                      accessibilityLabel="Open hydration details"
                    >
                      <View style={styles.rowCenter}>
                        <Text style={[Type.dotLabel, { color: Hue.water.main }]}>Water</Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color={Hue.water.main} />
                      </View>
                      <View style={styles.numberRow}>
                        <AnimatedNumber value={waterMl} style={Type.dotHero} color={C.textHi} height={66} />
                        <Text style={[Type.heroUnit, styles.unit, { color: C.textMid }]}>ml</Text>
                      </View>
                      <Text style={[Type.subline, { color: C.textMid }]}>
                        {waterRatio >= 1 ? 'Goal reached!' : `${Math.max(0, waterGoal - waterMl).toLocaleString('en-IN')} ml to go`}
                      </Text>
                    </AnimatedPressable>
                  </View>

                  {/* One dot per hour 06–22: lit = drank that hour. */}
                  <View style={styles.hours} accessibilityLabel={`${Object.values(hourly).filter(Boolean).length} hours with water today`}>
                    {HOURS.map((h) => (
                      <View key={h} style={styles.hourCol}>
                        <View
                          style={[
                            styles.hourDot,
                            { backgroundColor: hourly[h] ? Hue.water.main : C.surface2 },
                            h === hour && styles.hourNow,
                            h === hour && { borderColor: Hue.water.main },
                          ]}
                        />
                        <Text style={[Type.badge, styles.hourLabel, { color: C.textLow }]} numberOfLines={1}>
                          {HOUR_LABELS[h] ?? ''}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.waterButtons}>
                    <ChunkyButton
                      icon="undo-variant"
                      variant="soft"
                      hue="water"
                      size="md"
                      haptic="light"
                      onPress={undoWater}
                      disabled={saving || waterMl === 0}
                      accessibilityLabel="Undo the last glass"
                    />
                    <ChunkyButton
                      label="250 ml"
                      icon="cup-water"
                      hue="water"
                      size="md"
                      onPress={() => addWater(250)}
                      disabled={saving}
                      style={styles.flex}
                    />
                    <ChunkyButton
                      label="500"
                      icon="plus"
                      variant="soft"
                      hue="water"
                      size="md"
                      onPress={() => addWater(500)}
                      disabled={saving}
                      accessibilityLabel="Log 500 millilitres"
                    />
                  </View>
                </Tile>
              </EntranceView>

              {/* ── Bento ───────────────────────────────────────────────── */}
              <EntranceView index={3} style={styles.bentoRow}>
                <BentoTile
                  hue="train"
                  icon={isRest ? 'sleep' : 'dumbbell'}
                  badge={training?.logged ? <Chip icon="check-bold" label="Done" hue="train" solid /> : training?.streak ? <Chip icon="fire" label={`${training.streak}`} hue="train" /> : null}
                  value={isRest ? 'REST' : `${training?.done ?? 0}/${training?.total ?? 0}`}
                  caption={training?.focus ?? 'Training'}
                  onPress={() => router.navigate('/train' as any)}
                  footer={
                    isRest || !training ? (
                      <Text style={[Type.subline, { color: C.textMid }]}>Recover & stretch</Text>
                    ) : (
                      <DotMeter total={training.total} lit={training.logged ? training.total : training.done} color={Hue.train.main} size={9} gap={5} />
                    )
                  }
                />
                <BentoTile
                  hue="fuel"
                  icon="food-apple"
                  badge={fuel?.restock ? <Chip icon="cart" label="Restock" hue="spend" solid /> : null}
                  value={`${mealsEaten}/4`}
                  caption={`Day ${fuel?.day ?? 1} of 28`}
                  onPress={() => router.navigate((fuel?.restock ? '/fuel?sheet=restock' : '/fuel') as any)}
                  footer={
                    <View style={styles.plates}>
                      {FuelStorage.MEALS.map((m) => {
                        const s = fuel?.meals[m.type];
                        const on = s === 'eaten' || s === 'swapped';
                        return (
                          <View
                            key={m.type}
                            style={[styles.plate, { backgroundColor: on ? Hue.fuel.main : s === 'missed' ? C.alertWeak : C.surface2 }]}
                          >
                            <MaterialCommunityIcons name={MEAL_ICONS[m.type]} size={15} color={on ? Hue.fuel.on : s === 'missed' ? C.alert : C.textLow} />
                          </View>
                        );
                      })}
                    </View>
                  }
                />
              </EntranceView>

              <EntranceView index={4} style={styles.bentoRow}>
                <BentoTile
                  hue="spend"
                  icon="wallet"
                  value={todaySpend.toLocaleString('en-IN')}
                  prefix="₹"
                  caption={spendCount ? `${spendCount} today · ₹${DAILY_SPEND_BUDGET} plan` : 'Nothing spent yet'}
                  onPress={() => router.push('/purchases')}
                  footer={<SpendBars series={spendSeries} />}
                />
                <BentoTile
                  hue="checkin"
                  icon="map-marker-check"
                  badge={checkIn === null ? <LiveDot color={Hue.checkin.main} size={9} /> : null}
                  value={checkIn ? formatClock(new Date(checkIn)) : '--:--'}
                  caption={checkIn ? 'Checked in' : 'Tap to check in'}
                  onPress={() => router.push('/attendance')}
                  footer={
                    checkIn ? (
                      <Chip
                        icon={pendingCheckIns ? 'cloud-upload' : 'cloud-check'}
                        label={pendingCheckIns ? `${pendingCheckIns} to send` : 'Sent'}
                        hue={pendingCheckIns ? 'spend' : 'checkin'}
                      />
                    ) : (
                      <Chip icon="camera" label="Selfie + post" hue="checkin" />
                    )
                  }
                />
              </EntranceView>

              {alarm?.enabled && (
                <EntranceView index={5}>
                  <Tile hue="alarm" onPress={() => router.push('/alarm/setup' as any)} style={styles.alarmFace} accessibilityLabel={`Alarm at ${formatAlarm(alarm.hour, alarm.minute)}. Open alarm settings.`}>
                    <IconBlob name="alarm" hue="alarm" size={44} />
                    <View style={styles.flex}>
                      <Text style={[Type.dotNumber, { color: C.textHi }]}>{formatAlarm(alarm.hour, alarm.minute)}</Text>
                      <Text style={[Type.subline, { color: C.textMid }]}>Scan the barcode to stop it</Text>
                    </View>
                    <MaterialCommunityIcons name="barcode-scan" size={26} color={Hue.alarm.main} />
                  </Tile>
                </EntranceView>
              )}
            </>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

/** Three concentric rings, Apple-Fitness style: water outside, meals, training inside. */
function TodayRings({ water, meals, train }: { water: number; meals: number; train: number }) {
  const rings: { hue: HueName; value: number; size: number }[] = [
    { hue: 'water', value: water, size: 132 },
    { hue: 'fuel', value: meals, size: 100 },
    { hue: 'train', value: train, size: 68 },
  ];
  return (
    <View style={styles.rings} accessible accessibilityLabel={`Today: water ${Math.round(water * 100)}%, meals ${Math.round(meals * 100)}%, training ${Math.round(train * 100)}%`}>
      {rings.map((r, i) => (
        <View key={r.hue} style={[StyleSheet.absoluteFill, styles.center]}>
          <ProgressRing size={r.size} stroke={13} progress={r.value} color={Hue[r.hue].main} track={Hue[r.hue].soft} delay={i * 120} />
        </View>
      ))}
    </View>
  );
}

function LegendRow({
  hue,
  icon,
  value,
  unit,
  onPress,
}: {
  hue: HueName;
  icon: IconName;
  value: string;
  unit: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable onPress={onPress} haptic="light" pressScale={0.96} style={styles.legendRow} accessibilityRole="button" accessibilityLabel={`${value} ${unit}`}>
      <IconBlob name={icon} hue={hue} size={30} variant="soft" />
      <Text style={[Type.dotSmall, { color: Hue[hue].main }]} numberOfLines={1}>
        {value}
      </Text>
      {unit ? <Text style={[Type.subline, { color: C.textMid }]}>{unit}</Text> : null}
    </AnimatedPressable>
  );
}

function BentoTile({
  hue,
  icon,
  badge,
  value,
  prefix,
  caption,
  footer,
  onPress,
}: {
  hue: HueName;
  icon: IconName;
  badge?: ReactNode;
  value: string;
  prefix?: string;
  caption: string;
  footer: ReactNode;
  onPress: () => void;
}) {
  return (
    <Tile hue={hue} onPress={onPress} containerStyle={styles.flex} style={styles.bentoFace} accessibilityLabel={`${caption}: ${prefix ?? ''}${value}`}>
      <View style={styles.bentoTop}>
        <IconBlob name={icon} hue={hue} size={40} />
        {badge}
      </View>
      <View style={styles.bentoValue}>
        {prefix ? <Text style={[styles.prefix, { color: C.textHi }]}>{prefix}</Text> : null}
        <Text style={[Type.dotNumber, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
      <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
        {caption}
      </Text>
      <View style={styles.bentoFooter}>{footer}</View>
    </Tile>
  );
}

/** Seven days of spend as chunky rounded bars; today is the bright one. */
function SpendBars({ series }: { series: number[] }) {
  const max = Math.max(...series, 1);
  return (
    <View style={styles.bars} accessible={false}>
      {series.map((v, i) => {
        const today = i === series.length - 1;
        return (
          <View key={i} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: 6 + (v / max) * 26,
                  backgroundColor: today ? Hue.spend.main : v > 0 ? Hue.spend.soft : C.surface2,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatDay = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).replace(',', '');

const formatClock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const formatAlarm = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  content: { paddingHorizontal: Spacing.three, gap: 12 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: C.surface2,
  },
  avatarImg: { width: '100%', height: '100%' },

  ringsFace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 18 },
  rings: { width: 132, height: 132 },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  waterFace: { gap: Spacing.three, paddingTop: 18 },
  waterTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  waterNumbers: { flex: 1, gap: 2 },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end' },
  unit: { marginLeft: 6, marginBottom: 10 },
  hours: { flexDirection: 'row', justifyContent: 'space-between' },
  hourCol: { flex: 1, alignItems: 'center', height: 32 },
  hourDot: { width: 11, height: 11, borderRadius: 6 },
  hourNow: { borderWidth: 2, width: 13, height: 13, borderRadius: 7 },
  hourLabel: { width: 34, textAlign: 'center', marginTop: 4, fontSize: 10 },
  waterButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  bentoRow: { flexDirection: 'row', gap: 12 },
  bentoFace: { gap: 6, minHeight: 176 },
  bentoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  bentoValue: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  prefix: { fontFamily: FontFace.displayBold, fontSize: 24, lineHeight: 34 },
  bentoFooter: { marginTop: 'auto', paddingTop: 8 },
  plates: { flexDirection: 'row', gap: 6 },
  plate: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 32, gap: 5 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },

  alarmFace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
