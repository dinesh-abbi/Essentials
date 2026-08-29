import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, ClipPath, Rect, Circle, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import Skeleton from '@/components/SkeletonLoader';
import Plant from '@/components/illustrations/Plant';
import Sun from '@/components/illustrations/Sun';
import Wallet from '@/components/illustrations/Wallet';
import {
  BottomTabInset,
  Colors,
  HitTarget,
  MaxContentWidth,
  Motion,
  Radius,
  Spacing,
  Type,
} from '@/constants/theme';
import * as AttendanceStorage from '@/utils/AttendanceStorage';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import { useAuth } from '@/contexts/AuthContext';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';
import { useTabBarScrollHandler, showTabBar } from '@/utils/tabBarVisibility';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Palette = typeof Colors.dark;

/**
 * A presentation-layer budget. There is no budget concept in the data model —
 * `PurchaseLog` is {id, name, cost, category, timestamp} and nothing persists a
 * target — so this is a UI constant, not a stored setting. Hydration
 * deliberately does NOT work this way: it reads the real, user-configurable
 * goal from WaterStorage.getUserWaterGoal().
 */
const DAILY_SPEND_BUDGET = 800;

const SPARK_DAYS = 7;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ─── Number counter ───────────────────────────────────────────────────────────

/**
 * Counts to `value` on the UI thread by driving a disabled TextInput's `text`
 * prop — RN's <Text> has no animatable text prop.
 *
 * Both loaded faces ship the `tnum` OpenType feature (verified against the
 * shipped .ttf), so the tabular figures are real fixed-width digits and the
 * 84px hero cannot jitter its own width — or shove "ml" beside it — mid-count.
 */
function AnimatedNumber({
  value,
  prefix = '',
  textStyle,
  color,
  reduceMotion,
}: {
  value: number;
  prefix?: string;
  textStyle: any;
  color: string;
  reduceMotion: boolean;
}) {
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = reduceMotion
      ? value
      : withTiming(value, { duration: Motion.duration.count, easing: Easing.out(Easing.cubic) });
  }, [value, reduceMotion, shown]);

  const animatedProps = useAnimatedProps(() => {
    return { text: `${prefix}${Math.round(shown.value).toLocaleString('en-IN')}` } as any;
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      accessible={false}
      importantForAccessibility="no"
      value={`${prefix}${value}`}
      animatedProps={animatedProps}
      style={[textStyle, styles.numberInput, { color }]}
    />
  );
}

// ─── Water vessel ─────────────────────────────────────────────────────────────

const VESSEL_WIDTH = 60;
const VESSEL_HEIGHT = 124;
const WAVE_AMPLITUDE = 3.2;
// Points sampled across the width to draw the curve, connected with straight
// `L` segments rather than bezier curves (cheaper inside a per-frame
// worklet). At this density (~3dp between samples against a 3.2dp
// amplitude) the facets are well below what's perceptible on a phone
// screen — the wave reads as smooth without the extra bezier-control-point
// math.
const WAVE_SAMPLES = 18;

/**
 * A pill/capsule vessel — full stadium shape, liquid rising from the bottom.
 * Built entirely as one SVG so the wave can genuinely clip to the pill's
 * rounded corners (a plain View's overflow:hidden can't clip a jagged
 * animated path the way a `<ClipPath>` can). Two sine curves at different
 * speed/amplitude/opacity for a bit of parallax, plus bubbles clipped to the
 * live liquid region.
 */
function WaterVessel({
  ratio,
  colors,
  reduceMotion,
  logTick,
}: {
  ratio: number;
  colors: Palette;
  reduceMotion: boolean;
  /** Bumped by the screen on every successful `addWater`; 0 = "since mount,
   *  nothing logged yet" so the pulse never fires on first paint. */
  logTick: number;
}) {
  const level = useSharedValue(0); // 0..1, the fill fraction
  const phase1 = useSharedValue(0);
  const phase2 = useSharedValue(0);
  const bubble1 = useSharedValue(0);
  const bubble2 = useSharedValue(0);
  const pulse = useSharedValue(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    const target = clamp01(ratio);
    if (reduceMotion) {
      level.value = target;
      hasMounted.current = true;
      return;
    }
    // First paint charges the vessel with a clean ease. Every change after
    // that is a direct response to a tap, so it's allowed a small spring
    // overshoot — water actually slops up and settles when you pour more in.
    level.value = hasMounted.current
      ? withSpring(target, { damping: 11, stiffness: 120, mass: 0.7 })
      : withTiming(target, { duration: Motion.duration.entrance + 150, easing: Easing.out(Easing.cubic) });
    hasMounted.current = true;
  }, [ratio, reduceMotion, level]);

  // Two independent, opposite-direction loops — so the combined surface
  // never repeats in an obviously mechanical way. Skipped under reduce-motion.
  useEffect(() => {
    if (reduceMotion) return;
    phase1.value = withRepeat(withTiming(Math.PI * 2, { duration: 2600, easing: Easing.linear }), -1, false);
    phase2.value = withRepeat(withTiming(-Math.PI * 2, { duration: 3400, easing: Easing.linear }), -1, false);
    bubble1.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, false);
    bubble2.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, false);
  }, [reduceMotion, phase1, phase2, bubble1, bubble2]);

  // One water-tinted flash per log.
  useEffect(() => {
    if (logTick === 0 || reduceMotion) return;
    pulse.value = withSequence(
      withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, [logTick, reduceMotion, pulse]);

  const wavePath = (amp: number, ph: number) => {
    'worklet';
    const levelY = VESSEL_HEIGHT - level.value * VESSEL_HEIGHT;
    let d = '';
    for (let i = 0; i <= WAVE_SAMPLES; i++) {
      const x = (VESSEL_WIDTH / WAVE_SAMPLES) * i;
      const y = levelY + Math.sin((i / WAVE_SAMPLES) * Math.PI * 2 + ph) * amp;
      d += i === 0 ? `M ${x},${y}` : ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += ` L ${VESSEL_WIDTH},${VESSEL_HEIGHT} L 0,${VESSEL_HEIGHT} Z`;
    return d;
  };

  const fillProps = useAnimatedProps(() => ({ d: wavePath(WAVE_AMPLITUDE, phase1.value) } as any));
  const clipFillProps = useAnimatedProps(() => ({ d: wavePath(WAVE_AMPLITUDE, phase1.value) } as any));
  const linePropsMain = useAnimatedProps(() => {
    'worklet';
    const levelY = VESSEL_HEIGHT - level.value * VESSEL_HEIGHT;
    let d = '';
    for (let i = 0; i <= WAVE_SAMPLES; i++) {
      const x = (VESSEL_WIDTH / WAVE_SAMPLES) * i;
      const y = levelY + Math.sin((i / WAVE_SAMPLES) * Math.PI * 2 + phase1.value) * WAVE_AMPLITUDE;
      d += i === 0 ? `M ${x},${y}` : ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return { d } as any;
  });
  const fillProps2 = useAnimatedProps(() => ({ d: wavePath(WAVE_AMPLITUDE * 0.6, phase2.value) } as any));
  const pulseProps = useAnimatedProps(() => ({ opacity: pulse.value * 0.5 } as any));

  const bubbleTravel = VESSEL_HEIGHT * 0.42;
  const bubble1Props = useAnimatedProps(() => {
    'worklet';
    const baseY = VESSEL_HEIGHT - 14;
    return {
      cx: VESSEL_WIDTH * 0.36,
      cy: baseY - bubble1.value * bubbleTravel,
      opacity: reduceMotion ? 0 : Math.sin(bubble1.value * Math.PI) * 0.55,
    } as any;
  });
  const bubble2Props = useAnimatedProps(() => {
    'worklet';
    const baseY = VESSEL_HEIGHT - 22;
    return {
      cx: VESSEL_WIDTH * 0.62,
      cy: baseY - bubble2.value * bubbleTravel,
      opacity: reduceMotion ? 0 : Math.sin(bubble2.value * Math.PI) * 0.4,
    } as any;
  });

  const outlineR = VESSEL_WIDTH / 2;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.vesselWrap}
    >
      <Svg width={VESSEL_WIDTH} height={VESSEL_HEIGHT} viewBox={`0 0 ${VESSEL_WIDTH} ${VESSEL_HEIGHT}`}>
        <Defs>
          <ClipPath id="vesselOutline">
            <Rect x={0} y={0} width={VESSEL_WIDTH} height={VESSEL_HEIGHT} rx={outlineR} ry={outlineR} />
          </ClipPath>
          <ClipPath id="liquidOnly">
            <AnimatedPath animatedProps={clipFillProps} />
          </ClipPath>
          <SvgGradient id="vesselFillGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.waterStrong} />
            <Stop offset="1" stopColor={colors.water} />
          </SvgGradient>
        </Defs>

        <G clipPath="url(#vesselOutline)">
          <Rect x={0} y={0} width={VESSEL_WIDTH} height={VESSEL_HEIGHT} fill={colors.surface} />
          <AnimatedPath animatedProps={fillProps2} fill={colors.water} opacity={0.35} />
          <AnimatedPath animatedProps={fillProps} fill="url(#vesselFillGrad)" />

          <G clipPath="url(#liquidOnly)">
            <AnimatedCircle r={2} fill={colors.textHi} animatedProps={bubble1Props} />
            <AnimatedCircle r={1.4} fill={colors.textHi} animatedProps={bubble2Props} />
          </G>

          <AnimatedPath
            animatedProps={linePropsMain}
            fill="none"
            stroke={colors.waterStrong}
            strokeWidth={1.4}
          />

          <AnimatedRect
            x={0}
            y={0}
            width={VESSEL_WIDTH}
            height={VESSEL_HEIGHT}
            fill={colors.waterStrong}
            animatedProps={pulseProps}
          />
        </G>

        <Rect
          x={0.75}
          y={0.75}
          width={VESSEL_WIDTH - 1.5}
          height={VESSEL_HEIGHT - 1.5}
          rx={outlineR - 0.75}
          ry={outlineR - 0.75}
          fill="none"
          stroke={colors.hairline}
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

/**
 * Seven days of spend, drawn by hand in react-native-svg. Every point is
 * real: bucketed from the same `getPurchases()` result the total comes from.
 * Stroke is `textMid`, not `water` — the one-accent rule reserves `water` for
 * hydration; spend stays inside the neutral ramp.
 */
function Sparkline({ series, colors }: { series: number[]; colors: Palette }) {
  const W = 60;
  const H = 22;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => {
    const x = (i / (SPARK_DAYS - 1)) * W;
    const y = H - 2 - (v / max) * (H - 5);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L ${W},${H} L 0,${H} Z`;

  return (
    <Svg width={W} height={H} accessibilityLabel="Spend over the last seven days">
      <Defs>
        <SvgGradient id="sparkFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.textMid} stopOpacity="0.22" />
          <Stop offset="1" stopColor={colors.textMid} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={area} fill="url(#sparkFade)" />
      <Path d={line} fill="none" stroke={colors.textMid} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Secondary card shell ─────────────────────────────────────────────────────

/**
 * A quiet card: `surface` fill, one `hairline` border, no shadow. Separation
 * from the background comes entirely from that hairline plus the space around
 * it — not elevation. The bracket label stands in for a plain title.
 */
function StatCard({
  bracket,
  onPress,
  colors,
  accessibilityLabel,
  illustration,
  children,
}: {
  bracket: string;
  onPress: () => void;
  colors: Palette;
  accessibilityLabel: string;
  illustration: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.85}
      style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>{bracket}</Text>
      <View style={styles.statBody}>{children}</View>
      {/* At most one illustration per card, low emphasis, corner-tucked. */}
      <View style={styles.statIllo} pointerEvents="none">
        {illustration}
      </View>
    </AnimatedPressable>
  );
}

// ─── Hourly hydration (AM / PM) ─────────────────────────────────────────────

/**
 * Restyled AM/PM dot grid. Only draws the real tracked window (6-22 —
 * WaterStorage.getTodayHourlyStatus()'s own window), not a fake 24-hour grid,
 * so there's no dead cell pretending to be trackable.
 */
const AM_HOURS = [6, 7, 8, 9, 10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function HourlyDots({
  hourlyMap,
  currentHour,
  colors,
}: {
  hourlyMap: Record<number, boolean>;
  currentHour: number;
  colors: Palette;
}) {
  const loggedCount = Object.values(hourlyMap).filter(Boolean).length;
  const totalCount = AM_HOURS.length + PM_HOURS.length;

  const renderRow = (label: string, hours: number[]) => (
    <View style={styles.hourRow}>
      <Text style={[Type.subline, styles.hourRowLabel, { color: colors.textMid }]}>{label}</Text>
      <View style={styles.hourDotsWrap}>
        {hours.map((h) => {
          const on = hourlyMap[h] === true;
          const isNow = h === currentHour;
          return (
            <View
              key={h}
              style={[
                styles.hourDot,
                { backgroundColor: on ? colors.water : colors.hairline },
                isNow && { borderWidth: 1.5, borderColor: colors.water },
              ]}
            />
          );
        })}
      </View>
    </View>
  );

  return (
    <View
      style={styles.hourlySection}
      accessible
      accessibilityLabel={`Hourly hydration. ${loggedCount} of ${totalCount} tracked hours logged today.`}
    >
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ HOURS ]</Text>
      <View style={styles.hourRows}>
        {renderRow('AM', AM_HOURS)}
        {renderRow('PM', PM_HOURS)}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const quicklog = params.quicklog;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;

  useFocusEffect(
    useCallback(() => {
      showTabBar();
    }, [])
  );

  const tabBarScrollHandler = useTabBarScrollHandler();

  const [offlineCount, setOfflineCount] = useState(0);
  const [lastCheckInTime, setLastCheckInTime] = useState<number | null>(null);
  const [todaySpend, setTodaySpend] = useState(0);
  const [spendCount, setSpendCount] = useState(0);
  const [spendSeries, setSpendSeries] = useState<number[]>(() => Array(SPARK_DAYS).fill(0));
  const [waterTotalMl, setWaterTotalMl] = useState(0);
  const [waterHourlyMap, setWaterHourlyMap] = useState<Record<number, boolean>>({});
  const [waterSaving, setWaterSaving] = useState(false);
  // 0 = "nothing logged since mount" — WaterVessel reads this to skip the
  // celebratory pulse on first paint and fire it only on a real tap.
  const [logTick, setLogTick] = useState(0);
  const [waterGoal, setWaterGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [alarmConfig, setAlarmConfig] = useState<BarcodeAlarmStorage.BarcodeAlarmConfig | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        setDashboardLoading(true);
        try {
          const queue = await AttendanceStorage.getOfflineQueue();
          setOfflineCount(queue.length);

          const checkInTime = await AttendanceStorage.getLastCheckInTime();
          setLastCheckInTime(checkInTime);

          const purchases = await PurchasesStorage.getPurchases();
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const todayPs = purchases.filter((p) => p.timestamp >= midnight.getTime());
          setTodaySpend(todayPs.reduce((a, c) => a + c.cost, 0));
          setSpendCount(todayPs.length);

          // Bucket the previous SPARK_DAYS days out of the same result — no
          // extra fetch, and the sparkline is real data rather than ornament.
          const buckets = Array(SPARK_DAYS).fill(0);
          const dayMs = 86_400_000;
          for (const p of purchases) {
            const age = Math.floor((midnight.getTime() - p.timestamp) / dayMs);
            const idx = SPARK_DAYS - 1 - (age + 1);
            if (p.timestamp >= midnight.getTime()) buckets[SPARK_DAYS - 1] += p.cost;
            else if (idx >= 0 && idx < SPARK_DAYS - 1) buckets[idx] += p.cost;
          }
          setSpendSeries(buckets);

          let waterTotal = await WaterStorage.getTodayTotalMl();

          const widgetData = await WidgetSync.readWidgetData();
          if (widgetData && !widgetData.isStale && widgetData.waterMl > waterTotal) {
            waterTotal = widgetData.waterMl;
          }
          setWaterTotalMl(waterTotal);
          setWaterHourlyMap(await WaterStorage.getTodayHourlyStatus());

          const userGoal = await WaterStorage.getUserWaterGoal();
          setWaterGoal(userGoal);

          const alarm = await BarcodeAlarmStorage.getAlarmConfig();
          setAlarmConfig(alarm);

          setNow(new Date());
          WidgetSync.sync();
        } catch (e) {
          console.error('load metrics failed', e);
        } finally {
          setDashboardLoading(false);
        }
      }
      load();
    }, [])
  );

  const addWater = async (amount: number) => {
    setWaterSaving(true);
    try {
      await WaterStorage.logWaterIntake(amount);
      const total = await WaterStorage.getTodayTotalMl();
      setWaterTotalMl(total);
      setWaterHourlyMap(await WaterStorage.getTodayHourlyStatus());
      setLogTick((n) => n + 1);
      WidgetSync.sync();
    } catch (e) {
      console.error('Add water failed', e);
    } finally {
      setWaterSaving(false);
    }
  };

  const removeWater = async () => {
    setWaterSaving(true);
    try {
      const todayLogs = await WaterStorage.getTodayWaterLogs();
      if (todayLogs.length > 0) {
        todayLogs.sort((a, b) => b.timestamp - a.timestamp);
        await WaterStorage.deleteWaterLog(todayLogs[0].id);
        const total = await WaterStorage.getTodayTotalMl();
        setWaterTotalMl(total);
        setWaterHourlyMap(await WaterStorage.getTodayHourlyStatus());
        WidgetSync.sync();
      }
    } catch (e) {
      console.error('Remove water failed', e);
    } finally {
      setWaterSaving(false);
    }
  };

  // A quick-log fired from the home-screen widget arrives as a route param.
  // Declared below addWater on purpose: referencing it from above captures the
  // binding before initialisation, so the widget path could call a stale one.
  useEffect(() => {
    if (!quicklog) return;
    const amount = Number(quicklog);
    router.setParams({ quicklog: undefined });
    if (!Number.isNaN(amount) && amount > 0) {
      addWater(amount);
    }
  }, [quicklog]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const ratio = waterGoal > 0 ? waterTotalMl / waterGoal : 0;
  const waterPct = Math.min(100, Math.round(ratio * 100));

  const hours = now.getHours();
  const headline = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.displayName ?? user?.email?.split('@')[0] ?? 'there').split(' ')[0];
  const initials = firstName.slice(0, 2).toUpperCase();
  const photoUrl = user?.photoURL ?? null;

  const hasCheckedIn = lastCheckInTime !== null;
  const checkInStr = lastCheckInTime ? formatClock(new Date(lastCheckInTime)) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + insets.bottom + Spacing.four },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={tabBarScrollHandler}
          scrollEventThrottle={16}
        >
          {/* ── Greeting ──────────────────────────────────────────────────
              Big top margin, deliberate — the calm/uncrowded read starts
              here, not just at the hero. */}
          <EntranceView index={0} reduceMotion={reduceMotion} style={styles.greetingRow}>
            <View style={styles.greetingText}>
              <Text style={[Type.greeting, { color: colors.textMid }]}>Hi {firstName},</Text>
              <View style={styles.headlineRow}>
                <Text style={[Type.headline, { color: colors.textHi }]}>{headline}</Text>
                <AnimatedPressable
                  onPress={() => router.navigate('/profile' as any)}
                  haptic="light"
                  style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open your profile"
                >
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <Text style={[Type.bracketLabel, styles.avatarInitials, { color: colors.textMid }]}>
                      {initials}
                    </Text>
                  )}
                </AnimatedPressable>
              </View>
              <Text style={[Type.bracketLabel, styles.statusRow, { color: colors.textMid }]}>
                <Text style={{ color: colors.water }}>[ TODAY ]</Text>
                {'  ·  ' + formatDayStamp(now) + '  ·  ' + formatRemaining(now) + ' left'}
              </Text>
            </View>
          </EntranceView>

          {/* ── Hydration hero ───────────────────────────────────────────
              No card. Sits directly on `bg`, framed by space and a single
              hairline top border that closes the section — not a shadow,
              not a gradient, not a second surface. */}
          <EntranceView index={1} reduceMotion={reduceMotion} style={styles.heroSection}>
            {dashboardLoading ? (
              <View style={{ gap: Spacing.three }}>
                <Skeleton width={140} height={13} />
                <View style={styles.heroTopRow}>
                  <View style={{ gap: Spacing.two }}>
                    <Skeleton width={200} height={88} />
                    <Skeleton width={120} height={13} />
                  </View>
                  <Skeleton width={VESSEL_WIDTH} height={VESSEL_HEIGHT} borderRadius={VESSEL_WIDTH / 2} />
                </View>
              </View>
            ) : (
              <>
                <AnimatedPressable
                  onPress={() => router.push('/water')}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`Hydration. ${waterTotalMl} of ${waterGoal} millilitres, ${waterPct} percent. Open hydration detail.`}
                >
                  <View style={styles.heroHeadRow}>
                    <Text style={[Type.bracketLabel, { color: colors.water }]}>[ HYDRATION ]</Text>
                    <Text style={[Type.bracketLabel, { color: colors.textMid }]}>{waterPct}%</Text>
                  </View>

                  {/* Number column sits beside the vessel — the vessel is
                      what "water" is on this screen. */}
                  <View style={styles.heroTopRow}>
                    <View style={styles.heroNumberCol}>
                      <View style={styles.heroNumberRow}>
                        <AnimatedNumber
                          value={waterTotalMl}
                          textStyle={Type.hero}
                          color={colors.textHi}
                          reduceMotion={reduceMotion}
                        />
                        <Text style={[Type.heroUnit, styles.heroUnitText, { color: colors.textMid }]}>ml</Text>
                      </View>
                      <Text style={[Type.subline, { color: colors.textMid }]}>
                        of {waterGoal.toLocaleString('en-IN')} ml
                      </Text>
                    </View>

                    <WaterVessel ratio={ratio} colors={colors} reduceMotion={reduceMotion} logTick={logTick} />
                  </View>
                </AnimatedPressable>

                {/* Controls sit outside the pressable above so a tap on
                    "+ 250 ml" can't also open /water — no stopPropagation. */}
                <View style={styles.heroControlRow}>
                  <AnimatedPressable
                    onPress={removeWater}
                    disabled={waterSaving || waterTotalMl === 0}
                    haptic="light"
                    pressOpacity={0.7}
                    style={[
                      styles.ghostCircle,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.hairline,
                        opacity: waterTotalMl === 0 ? 0.4 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove the most recent water log"
                  >
                    <Feather name="minus" size={22} color={colors.textHi} />
                  </AnimatedPressable>

                  <AnimatedPressable
                    onPress={() => addWater(250)}
                    disabled={waterSaving}
                    haptic="medium"
                    pressOpacity={0.85}
                    style={[styles.waterPill, { backgroundColor: colors.water }]}
                    accessibilityRole="button"
                    accessibilityLabel="Log 250 millilitres of water"
                  >
                    {waterSaving ? (
                      <ActivityIndicator size="small" color={colors.onAccent} />
                    ) : (
                      <>
                        <Feather name="plus" size={17} color={colors.onAccent} />
                        <Text style={[Type.controlLabel, { color: colors.onAccent }]}>250 ml</Text>
                      </>
                    )}
                  </AnimatedPressable>
                </View>

                <HourlyDots hourlyMap={waterHourlyMap} currentHour={now.getHours()} colors={colors} />

                {/* Closes the hero as a section — space + one hairline, the
                    only border the whole block carries. Not a card edge. */}
                <View style={[styles.heroClose, { borderTopColor: colors.hairline }]} />
              </>
            )}
          </EntranceView>

          {/* ── Secondary two-up ─────────────────────────────────────────── */}
          {!dashboardLoading && (
            <EntranceView index={2} reduceMotion={reduceMotion} style={styles.twoUp}>
              <StatCard
                bracket="[ SPEND ]"
                onPress={() => router.push('/purchases')}
                colors={colors}
                accessibilityLabel={`Spend. ${todaySpend} rupees of ${DAILY_SPEND_BUDGET}. Open expenses.`}
                illustration={<Wallet size={30} color={colors.water} />}
              >
                <Text style={[Type.numberSm, { color: colors.textHi }]} numberOfLines={1}>
                  ₹{todaySpend.toLocaleString('en-IN')}
                </Text>
                <Text style={[Type.subline, { color: colors.textMid }]} numberOfLines={1}>
                  of ₹{DAILY_SPEND_BUDGET}
                  {spendCount > 0 ? ` · ${spendCount} today` : ''}
                </Text>
                <View style={styles.sparkWrap}>
                  <Sparkline series={spendSeries} colors={colors} />
                </View>
              </StatCard>

              <StatCard
                bracket="[ CHECK-IN ]"
                onPress={() => router.push('/attendance')}
                colors={colors}
                accessibilityLabel={
                  hasCheckedIn
                    ? `Check-in at ${checkInStr}. ${offlineCount > 0 ? `${offlineCount} pending upload` : 'Synced'}. Open check-in.`
                    : 'No check-in yet today. Tap to check in.'
                }
                illustration={
                  hasCheckedIn ? (
                    <Plant size={30} color={colors.water} />
                  ) : (
                    <Sun size={30} color={colors.water} />
                  )
                }
              >
                {hasCheckedIn ? (
                  <>
                    <Text style={[Type.numberSm, { color: colors.textHi }]} numberOfLines={1}>
                      {checkInStr}
                    </Text>
                    <Text
                      style={[
                        Type.subline,
                        { color: offlineCount > 0 ? colors.alert : colors.textMid },
                      ]}
                      numberOfLines={1}
                    >
                      {offlineCount > 0 ? `${offlineCount} pending` : 'Synced today'}
                    </Text>
                  </>
                ) : (
                  <Text style={[Type.subline, styles.emptyStateText, { color: colors.textMid }]}>
                    Tap to check in
                  </Text>
                )}
              </StatCard>
            </EntranceView>
          )}

          {/* ── Alarm (only when armed) ──────────────────────────────────── */}
          {!dashboardLoading && alarmConfig?.enabled && (
            <EntranceView index={3} reduceMotion={reduceMotion}>
              <AnimatedPressable
                onPress={() => router.push('/alarm/setup' as any)}
                haptic="light"
                pressOpacity={0.85}
                style={[styles.alarmRow, { borderTopColor: colors.hairline }]}
                accessibilityRole="button"
                accessibilityLabel={`Alarm at ${formatAlarmTime(alarmConfig.hour, alarmConfig.minute)}. Scan a barcode to dismiss. Open alarm settings.`}
              >
                <View style={styles.alarmText}>
                  <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ ALARM ]</Text>
                  <Text style={[Type.numberSm, styles.alarmTime, { color: colors.textHi }]}>
                    {formatAlarmTime(alarmConfig.hour, alarmConfig.minute)}
                  </Text>
                  <Text style={[Type.subline, { color: colors.textMid }]} numberOfLines={1}>
                    {alarmConfig.soundName || 'Default sound'} · scan to dismiss
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textLow} />
              </AnimatedPressable>
            </EntranceView>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Entrance ─────────────────────────────────────────────────────────────────

/**
 * Fade + translateY(10 → 0), 350ms ease-out, 70ms stagger between elements —
 * applied via Reanimated's `withDelay`. An earlier version of this component
 * computed the per-index delay and then discarded it (`void delay;`) with a
 * comment claiming a timeout mechanism that was never actually written —
 * every element animated in simultaneously, not staggered, despite being
 * shipped and reported as staggered. Fixed here for real.
 */
function EntranceView({
  index,
  reduceMotion,
  style,
  children,
}: {
  index: number;
  reduceMotion: boolean;
  style?: any;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 10);

  useEffect(() => {
    if (reduceMotion) return;
    const delay = index * 70;
    const config = { duration: 350, easing: Easing.out(Easing.cubic) };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateY.value = withDelay(delay, withTiming(0, config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatAlarmTime = (h: number, m: number) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? '0' + m : m;
  return `${hour12}:${minStr} ${ampm}`;
};

/** "Sun 23 Aug" */
const formatDayStamp = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

const formatClock = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "14h left" until midnight. */
const formatRemaining = (d: Date) => {
  const mins = 24 * 60 - (d.getHours() * 60 + d.getMinutes());
  const h = Math.floor(mins / 60);
  return `${h}h`;
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four + Spacing.one,
    paddingTop: Spacing.six * 0.7,
  },

  // ── Greeting ────────────────────────────────────────────────────────────────
  greetingRow: { marginBottom: Spacing.six },
  greetingText: { gap: Spacing.one },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: HitTarget,
    height: HitTarget,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { letterSpacing: 0 },
  statusRow: { marginTop: Spacing.one },

  // ── Hydration hero — type-forward, no card ───────────────────────────────────
  heroSection: {
    marginBottom: Spacing.six,
  },
  heroHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  heroNumberCol: { flex: 1 },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  numberInput: {
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    height: 92,
    textAlignVertical: 'center',
  },
  heroUnitText: { marginLeft: Spacing.two, marginBottom: 12 },

  vesselWrap: {
    width: VESSEL_WIDTH,
    height: VESSEL_HEIGHT,
    marginLeft: Spacing.four,
  },

  heroControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  heroClose: {
    marginTop: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ghostCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterPill: {
    height: 56,
    paddingHorizontal: Spacing.four + Spacing.one,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  // ── Hourly AM/PM dots ────────────────────────────────────────────────────
  hourlySection: { marginTop: Spacing.five, gap: Spacing.two },
  hourRows: { gap: Spacing.two, marginTop: Spacing.one },
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hourRowLabel: { width: 22 },
  hourDotsWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourDot: { width: 6, height: 6, borderRadius: 3 },

  // ── Secondary two-up ────────────────────────────────────────────────────────
  twoUp: { flexDirection: 'row', gap: Spacing.three, marginBottom: Spacing.five },
  statCard: {
    flex: 1,
    minHeight: 148,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three + 2,
    justifyContent: 'space-between',
  },
  statBody: { gap: Spacing.half, marginTop: Spacing.three },
  statIllo: { position: 'absolute', top: Spacing.three, right: Spacing.three, opacity: 0.9 },
  sparkWrap: { marginTop: Spacing.two, alignSelf: 'flex-start' },
  emptyStateText: { marginTop: Spacing.one },

  // ── Alarm ───────────────────────────────────────────────────────────────────
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  alarmText: { flex: 1, gap: Spacing.half },
  alarmTime: { marginTop: Spacing.half },
});
