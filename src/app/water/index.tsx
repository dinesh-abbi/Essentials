import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Droplet from '@/components/illustrations/Droplet';
import Skeleton from '@/components/SkeletonLoader';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { BarChart } from '@/components/ui/bar-chart';
import { Chip, ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { StatGrid, StatTile } from '@/components/ui/stat-tile';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';
import { triggerWaterGoalNotification } from '@/utils/notifications';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';

const C = Colors.dark;
const W = Hue.water;
type Tab = 'daily' | 'weekly' | 'monthly';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const HOUR_LABELS: Record<number, string> = { 6: '6a', 12: '12p', 18: '6p', 22: '10p' };
const PRESETS = [2000, 2500, 3000, 3500, 4000, 5000];

/**
 * Hydration — Day / Week / Month, swipeable. Day is Drip filling up plus
 * the hour dots and today's glasses; Week is a bar chart against the goal
 * line; Month is a dot calendar that glows brighter the more you drank.
 */
export default function WaterDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('daily');

  // ── Day ──────────────────────────────────────────────────────────────────
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [total, setTotal] = useState(0);
  const [goal, setGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [logs, setLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [hourly, setHourly] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | boolean>(false);
  const [bumpTick, setBumpTick] = useState(0);
  const [goalOpen, setGoalOpen] = useState(false);
  const [customGoal, setCustomGoal] = useState('');

  const refreshDaily = async (spinner = true) => {
    if (spinner) setLoadingDaily(true);
    try {
      const [l, t, h, g] = await Promise.all([
        WaterStorage.getTodayWaterLogs(),
        WaterStorage.getTodayTotalMl(),
        WaterStorage.getTodayHourlyStatus(),
        WaterStorage.getUserWaterGoal(),
      ]);
      setLogs(l.sort((a, b) => b.timestamp - a.timestamp));
      setTotal(t);
      setHourly(h);
      setGoal(g);
    } catch (e) {
      console.warn('Failed to load daily hydration:', e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const saveGoal = async (next: number) => {
    if (isNaN(next) || next <= 0) {
      Alert.alert('Check the goal', 'Enter a daily amount in ml, like 3000.');
      return;
    }
    try {
      await WaterStorage.setUserWaterGoal(next);
      setGoal(next);
      setGoalOpen(false);
      setCustomGoal('');
      WidgetSync.sync();
    } catch {
      Alert.alert('Error', 'Failed to update your goal.');
    }
  };

  const addWater = async (ml: number) => {
    setBusy(ml);
    try {
      const before = total;
      await WaterStorage.logWaterIntake(ml);
      setBumpTick((n) => n + 1);
      await refreshDaily(false);
      WidgetSync.sync();
      if (before < goal) {
        const fresh = await WaterStorage.getTodayTotalMl();
        if (fresh >= goal) triggerWaterGoalNotification().catch((e) => console.warn('Goal notification failed:', e));
      }
    } catch {
      Alert.alert('Error', 'Could not save that glass.');
    } finally {
      setBusy(false);
    }
  };

  const deleteLog = (id: string) =>
    Alert.alert('Remove this glass?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await WaterStorage.deleteWaterLog(id);
            await refreshDaily(false);
            WidgetSync.sync();
          } catch {
            Alert.alert('Error', 'Could not remove it.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  // ── Week ─────────────────────────────────────────────────────────────────
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [week, setWeek] = useState<{ date: Date; totalMl: number; logsCount: number }[]>([]);

  const refreshWeekly = async () => {
    try {
      setWeek(await WaterStorage.getWeeklyData(Date.now() + weekOffset * 7 * 86_400_000));
    } catch (e) {
      console.warn('Failed to load weekly progress:', e);
    } finally {
      setLoadingWeekly(false);
    }
  };

  const openDay = (date: Date) => router.push({ pathname: '/water/report' as any, params: { dateMs: date.getTime().toString() } });

  const weekTotal = week.reduce((s, d) => s + d.totalMl, 0);
  const weekMet = week.filter((d) => d.totalMl >= goal).length;
  const weekBest = week.reduce((b, d) => (d.totalMl > (b?.totalMl ?? 0) ? d : b), null as (typeof week)[number] | null);
  const todayKey = new Date().toDateString();

  // ── Month ────────────────────────────────────────────────────────────────
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [month, setMonth] = useState(() => new Date());
  const [dayMap, setDayMap] = useState<Map<number, number>>(new Map());
  const year = month.getFullYear();
  const mon = month.getMonth();

  const refreshMonthly = async () => {
    try {
      setDayMap(await WaterStorage.getMonthlyCalendarData(year, mon));
    } catch (e) {
      console.warn('Failed to load monthly data:', e);
    } finally {
      setLoadingMonthly(false);
    }
  };

  // Monday-first grid.
  const lead = (new Date(year, mon, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  let monthTotal = 0;
  let monthTracked = 0;
  let monthMet = 0;
  dayMap.forEach((v) => {
    monthTotal += v;
    if (v > 0) monthTracked++;
    if (v >= goal) monthMet++;
  });
  const monthAvg = monthTracked ? Math.round(monthTotal / monthTracked) : 0;
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === mon;

  // ── Wiring ───────────────────────────────────────────────────────────────
  // Each effect kicks its loader off a resolved promise, so no state is set
  // synchronously inside the effect body.
  useEffect(() => {
    Promise.resolve(false).then(refreshDaily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    Promise.resolve().then(refreshWeekly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);
  useEffect(() => {
    Promise.resolve().then(refreshMonthly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const goTab = (t: Tab) => {
    setTab(t);
    pager.current?.scrollTo({ x: ['daily', 'weekly', 'monthly'].indexOf(t) * windowWidth, animated: !reduceMotion });
  };

  const ratio = goal > 0 ? total / goal : 0;
  const pagePad = { paddingBottom: insets.bottom + Spacing.five };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader
            bracket="Hydration"
            right={
              <ChunkyButton icon="bullseye-arrow" variant="soft" hue="water" size="md" haptic="light" onPress={() => setGoalOpen(true)} accessibilityLabel="Change daily goal" />
            }
          />
          <Segmented
            hue="water"
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
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
            setTab((['daily', 'weekly', 'monthly'] as Tab[])[i] ?? 'daily');
          }}
        >
          {/* ── Day ───────────────────────────────────────────────────── */}
          <ScrollView style={{ width: windowWidth }} contentContainerStyle={[styles.page, pagePad]} showsVerticalScrollIndicator={false}>
            <Tile hue="water" style={styles.hero}>
              {loadingDaily ? (
                <Skeleton width={150} height={186} borderRadius={75} />
              ) : (
                <AnimatedPressable onPress={() => addWater(250)} disabled={busy !== false} haptic="medium" pressScale={0.94} accessibilityRole="button" accessibilityLabel="Log 250 millilitres">
                  <Droplet ratio={ratio} size={150} bumpTick={bumpTick} />
                </AnimatedPressable>
              )}
              <View style={styles.heroNumber}>
                <AnimatedNumber value={total} style={Type.dotHero} color={C.textHi} height={66} />
                <Text style={[Type.heroUnit, styles.unit, { color: C.textMid }]}>ml</Text>
              </View>
              <View style={styles.chipRow}>
                <Chip icon="bullseye-arrow" label={`Goal ${(goal / 1000).toFixed(1)} L`} hue="water" />
                <Chip icon={ratio >= 1 ? 'party-popper' : 'water-percent'} label={`${Math.round(ratio * 100)}%`} hue="water" solid={ratio >= 1} />
              </View>
              <View style={styles.quick}>
                {[250, 500, 1000].map((ml) => (
                  <ChunkyButton
                    key={ml}
                    label={ml === 1000 ? '1 L' : `${ml}`}
                    icon={ml === 250 ? 'cup-water' : ml === 500 ? 'bottle-soda-classic-outline' : 'water'}
                    hue="water"
                    variant={ml === 250 ? 'solid' : 'soft'}
                    size="md"
                    style={styles.flex}
                    onPress={() => addWater(ml)}
                    loading={busy === ml}
                    disabled={loadingDaily || busy !== false}
                    accessibilityLabel={`Log ${ml} millilitres`}
                  />
                ))}
              </View>
            </Tile>

            <Tile style={styles.hoursFace}>
              <Text style={[Type.dotLabel, { color: C.textMid }]}>Hours</Text>
              <View style={styles.hours}>
                {HOURS.map((h) => (
                  <View key={h} style={styles.hourCol}>
                    <View
                      style={[
                        styles.hourDot,
                        { backgroundColor: hourly[h] ? W.main : C.surface2 },
                        h === today.getHours() && { borderWidth: 2, borderColor: W.main },
                      ]}
                    />
                    <Text style={[Type.badge, styles.hourLabel, { color: C.textLow }]} numberOfLines={1}>
                      {HOUR_LABELS[h] ?? ''}
                    </Text>
                  </View>
                ))}
              </View>
            </Tile>

            <Text style={[Type.headline, styles.section, { color: C.textHi }]}>Today’s glasses</Text>
            {!loadingDaily && logs.length === 0 && (
              <Tile style={styles.empty}>
                <MaterialCommunityIcons name="cup-outline" size={40} color={C.textLow} />
                <Text style={[Type.body, { color: C.textMid }]}>Nothing yet — tap Drip to start.</Text>
              </Tile>
            )}
            {logs.map((l, i) => (
              <Animated.View key={l.id} entering={reduceMotion ? undefined : FadeInDown.delay(i * 30).springify().damping(18)}>
                <Tile style={styles.logFace}>
                  <IconBlob name="cup-water" hue="water" size={40} variant="soft" />
                  <View style={styles.flex}>
                    <Text style={[Type.dotSmall, { color: C.textHi }]}>{l.amountMl} ml</Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>
                      {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <ChunkyButton icon="trash-can-outline" variant="soft" hue="alarm" textColor={C.alert} size="sm" haptic="light" onPress={() => deleteLog(l.id)} accessibilityLabel="Remove this glass" />
                </Tile>
              </Animated.View>
            ))}
          </ScrollView>

          {/* ── Week ──────────────────────────────────────────────────── */}
          <ScrollView style={{ width: windowWidth }} contentContainerStyle={[styles.page, pagePad]} showsVerticalScrollIndicator={false}>
            <Stepper
              title={weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${-weekOffset} weeks ago`}
              subtitle={week.length === 7 ? `${fmtShort(week[0].date)} – ${fmtShort(week[6].date)}` : ''}
              onPrev={() => setWeekOffset((w) => w - 1)}
              onNext={() => setWeekOffset((w) => Math.min(0, w + 1))}
              nextDisabled={weekOffset === 0}
            />
            <Tile style={styles.chartFace}>
              {loadingWeekly ? (
                <Skeleton width="100%" height={170} borderRadius={20} />
              ) : (
                <BarChart
                  hue="water"
                  goal={goal}
                  height={150}
                  bars={week.map((d, i) => ({
                    label: WEEKDAYS[i].slice(0, 1),
                    value: d.totalMl,
                    caption: d.totalMl ? (d.totalMl / 1000).toFixed(1) : '',
                    strong: d.totalMl >= goal,
                    selected: d.date.toDateString() === todayKey,
                    onPress: () => openDay(d.date),
                  }))}
                />
              )}
              <Text style={[Type.subline, { color: C.textMid }]}>Bright bar = goal hit · tap a day for details</Text>
            </Tile>
            <StatGrid>
              <StatTile icon="water" hue="water" value={(weekTotal / 1000).toFixed(1)} label="litres total" />
              <StatTile icon="cup-water" hue="water" value={`${Math.round(weekTotal / 7)}`} label="ml a day" />
              <StatTile icon="trophy" hue="spend" value={`${weekMet}/7`} label="goal days" />
              <StatTile
                icon="star"
                hue="fuel"
                value={weekBest && weekBest.totalMl > 0 ? WEEKDAYS[(weekBest.date.getDay() + 6) % 7] : '--'}
                label="best day"
              />
            </StatGrid>
          </ScrollView>

          {/* ── Month ─────────────────────────────────────────────────── */}
          <ScrollView style={{ width: windowWidth }} contentContainerStyle={[styles.page, pagePad]} showsVerticalScrollIndicator={false}>
            <Stepper
              title={month.toLocaleString('default', { month: 'long' })}
              subtitle={`${year}`}
              onPrev={() => setMonth(new Date(year, mon - 1, 1))}
              onNext={() => setMonth(new Date(year, mon + 1, 1))}
            />
            <Tile style={styles.calFace}>
              <View style={styles.calRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <Text key={i} style={[Type.dotLabel, styles.calHead, { color: C.textLow }]}>
                    {d}
                  </Text>
                ))}
              </View>
              {loadingMonthly ? (
                <Skeleton width="100%" height={220} borderRadius={20} />
              ) : (
                <View style={styles.calGrid}>
                  {cells.map((d, i) => {
                    if (d === null) return <View key={`e${i}`} style={styles.calCell} />;
                    const ml = dayMap.get(d) ?? 0;
                    const t = Math.min(1, ml / goal);
                    const isToday = isThisMonth && d === today.getDate();
                    return (
                      <AnimatedPressable
                        key={d}
                        onPress={() => openDay(new Date(year, mon, d))}
                        haptic="selection"
                        pressScale={0.85}
                        style={styles.calCell}
                        accessibilityRole="button"
                        accessibilityLabel={`${d}: ${ml} millilitres`}
                      >
                        <View
                          style={[
                            styles.calDot,
                            { backgroundColor: ml === 0 ? C.surface2 : W.main, opacity: ml === 0 ? 1 : 0.3 + t * 0.7 },
                            isToday && { borderWidth: 2.5, borderColor: C.textHi },
                          ]}
                        >
                          <Text style={[Type.badge, { color: ml >= goal ? W.on : C.textHi }]}>{d}</Text>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
              <View style={styles.legend}>
                <Text style={[Type.badge, { color: C.textMid }]}>less</Text>
                {[0, 0.35, 0.65, 1].map((o) => (
                  <View key={o} style={[styles.legendDot, { backgroundColor: o === 0 ? C.surface2 : W.main, opacity: o === 0 ? 1 : 0.3 + o * 0.7 }]} />
                ))}
                <Text style={[Type.badge, { color: C.textMid }]}>goal</Text>
              </View>
            </Tile>
            <StatGrid>
              <StatTile icon="water" hue="water" value={(monthTotal / 1000).toFixed(1)} label="litres total" />
              <StatTile icon="calendar-check" hue="profile" value={`${monthTracked}`} label="days logged" />
              <StatTile icon="trophy" hue="spend" value={`${monthMet}`} label="goal days" />
              <StatTile icon="chart-line" hue="fuel" value={(monthAvg / 1000).toFixed(1)} label="L a day" />
            </StatGrid>
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      {/* ── Goal ─────────────────────────────────────────────────────────── */}
      <Sheet visible={goalOpen} onClose={() => setGoalOpen(false)} bracket="Daily goal" title="How much a day?" heightRatio={0.6}>
        <View style={styles.sheetBody}>
          <View style={styles.presets}>
            {PRESETS.map((ml) => (
              <ChunkyButton
                key={ml}
                label={`${ml / 1000} L`}
                hue="water"
                variant={goal === ml ? 'solid' : 'soft'}
                size="md"
                style={styles.preset}
                onPress={() => saveGoal(ml)}
              />
            ))}
          </View>
          <Text style={[Type.dotLabel, { color: C.textMid }]}>Or type it (ml)</Text>
          <View style={styles.customRow}>
            <TextInput
              value={customGoal}
              onChangeText={setCustomGoal}
              keyboardType="number-pad"
              placeholder={String(goal)}
              placeholderTextColor={C.textLow}
              style={[Type.dotNumber, styles.customInput, { color: C.textHi, backgroundColor: C.bg }]}
            />
            <ChunkyButton label="Save" icon="check-bold" hue="water" onPress={() => saveGoal(parseInt(customGoal, 10))} disabled={!customGoal} />
          </View>
        </View>
      </Sheet>
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
      <ChunkyButton icon="chevron-left" variant="soft" hue="water" size="md" haptic="selection" onPress={onPrev} accessibilityLabel="Previous" />
      <View style={styles.stepperText}>
        <Text style={[Type.title, { color: C.textHi }]}>{title}</Text>
        {subtitle ? <Text style={[Type.dotLabel, { color: C.textMid }]}>{subtitle}</Text> : null}
      </View>
      <ChunkyButton icon="chevron-right" variant="soft" hue="water" size="md" haptic="selection" onPress={onNext} disabled={nextDisabled} accessibilityLabel="Next" />
    </View>
  );
}

const fmtShort = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three, gap: 10, paddingBottom: 10 },
  page: { paddingHorizontal: Spacing.three, paddingTop: 6, gap: 12 },
  flex: { flex: 1 },

  hero: { alignItems: 'center', gap: 10, paddingTop: 22 },
  heroNumber: { flexDirection: 'row', alignItems: 'flex-end' },
  unit: { marginLeft: 6, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 6 },
  quick: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 6 },

  hoursFace: { gap: 12 },
  hours: { flexDirection: 'row' },
  hourCol: { flex: 1, alignItems: 'center', height: 34 },
  hourDot: { width: 12, height: 12, borderRadius: 6 },
  hourLabel: { width: 34, textAlign: 'center', marginTop: 4, fontSize: 10 },

  section: { marginTop: Spacing.three },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  logFace: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperText: { flex: 1, alignItems: 'center' },
  chartFace: { gap: 12, paddingTop: 20 },

  calFace: { gap: 6 },
  calRow: { flexDirection: 'row' },
  calHead: { width: `${100 / 7}%`, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDot: { width: '82%', aspectRatio: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },

  sheetBody: { paddingHorizontal: Spacing.four, gap: 14 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  preset: { width: '31.5%' },
  customRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  customInput: { flex: 1, height: 56, borderRadius: Radius.lg, paddingHorizontal: 16 },
});
