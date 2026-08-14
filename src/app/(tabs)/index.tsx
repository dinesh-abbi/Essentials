import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  useAnimatedProps,
  interpolateColor,
  useReducedMotion,
} from 'react-native-reanimated';
import type { ViewProps } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import Skeleton from '@/components/SkeletonLoader';
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import * as AttendanceStorage from '@/utils/AttendanceStorage';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import * as NotificationsUtil from '@/utils/notifications'; // kept for future use
import { useAuth } from '@/contexts/AuthContext';
import * as BarcodeAlarmStorage from '@/utils/BarcodeAlarmStorage';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Solid graphite panel — replaces the former translucent GlassView. Depth now
// comes from the surface/border tokens, not a blur layer (cheaper + de-glassed).
function Panel({ style, ...rest }: ViewProps) {
  return <View style={style} {...rest} />;
}

// ─── Odometer Number Counter ─────────────────────────────────────────────────

function AnimatedNumber({ value, style, prefix = '' }: { value: number; style: any; prefix?: string }) {
  const animatedValue = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Count-up on value change — but snap instantly under reduced motion.
    animatedValue.value = reduceMotion
      ? value
      : withTiming(value, { duration: 1500, easing: Easing.out(Easing.quad) });
  }, [value, reduceMotion]);

  const animatedProps = useAnimatedProps(() => {
    return {
      text: `${prefix}${Math.round(animatedValue.value)}`,
    } as any;
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      value={`${prefix}${value}`} // Fallback
      animatedProps={animatedProps}
      // Instrument readout: monospaced + tabular figures so digits keep equal
      // width and the count-up doesn't jitter the layout.
      style={[style, { padding: 0, margin: 0, fontFamily: Fonts?.mono, fontVariant: ['tabular-nums'] }]}
    />
  );
}

// ─── Pulse Dot Indicator ──────────────────────────────────────────────────────

function PulseDot({ color, isActive, size = 12 }: { color: string; isActive: boolean; size?: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (isActive && !reduceMotion) {
      scale.value = withRepeat(withTiming(2.2, { duration: 1200, easing: Easing.out(Easing.quad) }), -1, false);
      opacity.value = withRepeat(withSequence(withTiming(0, { duration: 1200, easing: Easing.out(Easing.quad) })), -1, false);
    } else {
      scale.value = 1;
      opacity.value = 0;
    }
  }, [isActive, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const radius = size / 2;

  return (
    <View style={styles.pulseContainer}>
      {isActive && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: color,
              width: size,
              height: size,
              borderRadius: radius,
            },
            ringStyle,
          ]}
        />
      )}
      <View
        style={[
          styles.solidDot,
          {
            backgroundColor: color,
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
      />
    </View>
  );
}

// ─── Progress Strip for Water Widget ──────────────────────────────────────────

function ProgressStrip({ percent, trackColor, fillColor }: { percent: number; trackColor: string; fillColor: string; }) {
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withSpring(percent, { damping: 15, stiffness: 90 });
  }, [percent]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`
  }));

  return (
    <View style={[styles.strip, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[styles.stripFill, { backgroundColor: fillColor }, animatedStyle]}
      />
    </View>
  );
}

// ─── Spend Power Core (Compact) ───────────────────────────────────────────────

function SpendPowerCore({ spend, limit = 2000, isDark }: { spend: number; limit?: number; isDark: boolean }) {
  const ratio = Math.min(spend / limit, 1);
  const activeSegments = Math.ceil(ratio * 4); // 0 to 4 segments to fit neatly

  return (
    <View style={styles.powerCoreContainer}>
      <View style={styles.powerCoreRow}>
        {Array.from({ length: 4 }, (_, i) => {
          const isActive = i < activeSegments;
          const c = isDark ? Colors.dark : Colors.light;
          // Calm → caution → alarm as spend climbs (semantic, not a rainbow).
          let color: string = c.signal;
          if (i === 2) color = c.warn;
          if (i === 3) color = c.alert;

          return (
            <View
              key={i}
              style={[
                styles.powerCoreSegment,
                {
                  backgroundColor: isActive ? color : c.border,
                  opacity: isActive ? 1 : 0.4,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Camera Viewfinder Scanner ───────────────────────────────────────────────

function CameraViewfinder({ offlineCount, colors, isDark }: { offlineCount: number; colors: any; isDark: boolean }) {
  const scanLineY = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.4);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      pulseOpacity.value = 1;
      return;
    }
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(32, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [reduceMotion]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const bracketStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const indicatorColor = offlineCount > 0 ? colors.alert : colors.success;

  return (
    <View style={styles.viewfinderContainer}>
      <Animated.View style={[styles.viewfinderBrackets, bracketStyle]}>
        <View style={[styles.bracketTL, { borderColor: indicatorColor }]} />
        <View style={[styles.bracketTR, { borderColor: indicatorColor }]} />
        <View style={[styles.bracketBL, { borderColor: indicatorColor }]} />
        <View style={[styles.bracketBR, { borderColor: indicatorColor }]} />
        
        <Feather name="camera" size={16} color={indicatorColor} />

        <Animated.View style={[styles.laserLine, { backgroundColor: indicatorColor }, laserStyle]} />
      </Animated.View>
    </View>
  );
}

// ─── Water Fluid Chamber Bottle ──────────────────────────────────────────────

function WaterChamber({ percent, colors, isDark }: { percent: number; colors: any; isDark: boolean }) {
  return (
    <View style={[styles.chamberContainer, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
      {/* Dynamic filling water block — bubbles removed (ambient loop) */}
      <AnimatedWaterFill percent={percent} colors={colors} />
    </View>
  );
}

function AnimatedWaterFill({ percent, colors }: { percent: number; colors: any }) {
  const animatedHeight = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withSpring(percent, { damping: 15, stiffness: 90 });
  }, [percent]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${animatedHeight.value}%`,
  }));

  return (
    <Animated.View
      style={[
        styles.chamberFill,
        { backgroundColor: colors.aqua },
        animatedStyle,
      ]}
    />
  );
}

// ─── Primitive Layout Utilities ────────────────────────────────────────────────

function Label({ text, color }: { text: string; color: string }) {
  return (
    <Text style={[styles.label, { color }]}>{text}</Text>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function AnimatedRingingBell({ colors }: { colors: any }) {
  const rotation = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    rotation.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 150 }),
        withTiming(-15, { duration: 300 }),
        withTiming(10, { duration: 250 }),
        withTiming(-10, { duration: 200 }),
        withTiming(0, { duration: 150 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      false
    );
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="bell" size={24} color={colors.primary} />
    </Animated.View>
  );
}

const formatAlarmTime = (h: number, m: number) => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? '0' + m : m;
  return `${hour12}:${minStr} ${ampm}`;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const highlight = params.highlight;
  const quicklog = params.quicklog;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  
  const isDark = scheme === 'dark';
  const themeColors = Colors[scheme];
  
  // Colors come straight from the Cockpit tokens now — no local slate/blue
  // overrides. `surface` is a solid graphite panel (glass removed); water uses
  // the `aqua` domain tint so hydration reads distinct from the signal accent.
  const colors = {
    ...themeColors,
    surface: themeColors.backgroundElement,
  };

  const waterHighlight = useSharedValue(0);

  useEffect(() => {
    if (highlight === 'water') {
      waterHighlight.value = 0;
      waterHighlight.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      );
      router.setParams({ highlight: undefined });
    }
  }, [highlight]);

  // Quick-log from the home-screen widget's "+" tap (essentials:///?quicklog=250).
  // Cleared immediately after consuming so a repeat tap with the same amount
  // still triggers — mirrors how the notification YES_ACTION flow behaves.
  useEffect(() => {
    if (!quicklog) return;
    const amount = Number(quicklog);
    router.setParams({ quicklog: undefined });
    if (!Number.isNaN(amount) && amount > 0) {
      addWater(amount);
    }
  }, [quicklog]);

  const highlightStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      waterHighlight.value,
      [0, 1],
      ['transparent', colors.primary]
    );
    const shadowOpacity = waterHighlight.value * 0.6;
    const shadowRadius = waterHighlight.value * 16;
    return {
      borderWidth: 2,
      borderColor,
      shadowColor: colors.primary,
      shadowOpacity,
      shadowRadius,
      elevation: waterHighlight.value * 8,
      borderRadius: Radius.xl,
    };
  });

  const [offlineCount, setOfflineCount] = useState(0);
  const [lastCheckInTime, setLastCheckInTime] = useState<number | null>(null);
  const [todaySpend, setTodaySpend] = useState(0);
  const [waterTotalMl, setWaterTotalMl] = useState(0);
  const [waterHourlyMap, setWaterHourlyMap] = useState<Record<number, boolean>>({});
  const [waterSaving, setWaterSaving] = useState(false);
  const [waterGoal, setWaterGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [alarmConfig, setAlarmConfig] = useState<BarcodeAlarmStorage.BarcodeAlarmConfig | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

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

          setWaterTotalMl(await WaterStorage.getTodayTotalMl());
          setWaterHourlyMap(await WaterStorage.getTodayHourlyStatus());

          const userGoal = await WaterStorage.getUserWaterGoal();
          setWaterGoal(userGoal);

          const alarm = await BarcodeAlarmStorage.getAlarmConfig();
          setAlarmConfig(alarm);

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
      const hourly = await WaterStorage.getTodayHourlyStatus();
      setWaterTotalMl(total);
      setWaterHourlyMap(hourly);
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
        const hourly = await WaterStorage.getTodayHourlyStatus();
        setWaterTotalMl(total);
        setWaterHourlyMap(hourly);
        WidgetSync.sync();
      }
    } catch (e) {
      console.error('Remove water failed', e);
    } finally {
      setWaterSaving(false);
    }
  };

  const trackedHours = Object.values(waterHourlyMap).filter(Boolean).length;
  const waterPct = Math.min(Math.round((waterTotalMl / waterGoal) * 100), 100);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const currentHour = now.getHours();

  const dayStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'User';

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + insets.bottom + Spacing.three },
          ]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ───────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: themeColors.textSecondary }]}>{greeting},</Text>
              <Text style={[styles.appName, { color: themeColors.text }]}>{displayName}.</Text>
            </View>
            <View style={[styles.dateBadge, { backgroundColor: themeColors.backgroundSelected }]}>
              <Text style={[styles.dateStr, { color: themeColors.text }]}>{dayStr}</Text>
            </View>
          </Animated.View>

          {dashboardLoading ? (
            <View style={{ gap: 16 }}>
              {/* Row 1 Skeletons */}
              <View style={styles.widgetGridRow}>
                {/* Spend widget skeleton */}
                <Panel style={[styles.widgetSquare, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ width: '100%', gap: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton width={50} height={12} />
                      <Feather name="credit-card" size={14} color={colors.accent} />
                    </View>
                    <Skeleton width={100} height={32} style={{ marginTop: 4 }} />
                    <Skeleton width={90} height={12} style={{ marginTop: 8 }} />
                    <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 8 }} />
                  </View>
                </Panel>

                {/* Check-in widget skeleton */}
                <Panel style={[styles.widgetSquare, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
                  <View style={{ width: '100%', gap: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton width={60} height={12} />
                      <Feather name="aperture" size={13} color={colors.accent} />
                    </View>
                    <Skeleton width={56} height={56} borderRadius={28} style={{ alignSelf: 'center', marginTop: 4 }} />
                    <Skeleton width={80} height={12} style={{ alignSelf: 'center', marginTop: 6 }} />
                  </View>
                </Panel>
              </View>

              {/* Row 2 Skeleton */}
              <Panel style={[styles.widgetFullWidth, { backgroundColor: colors.surface, borderColor: 'transparent', borderWidth: 0 }]}>
                <View style={{ flexDirection: 'row', width: '100%' }}>
                  <View style={{ flex: 1, gap: 12, paddingVertical: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton width={130} height={12} />
                      <Feather name="droplet" size={14} color={colors.aqua} />
                    </View>
                    <Skeleton width={120} height={32} style={{ marginTop: 4 }} />
                    {/* Timeline capsules row skeleton */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '90%', paddingVertical: 6 }}>
                      {Array.from({ length: 17 }).map((_, i) => (
                        <Skeleton key={i} width={5} height={14} borderRadius={2.5} />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <Skeleton width={32} height={28} borderRadius={14} />
                      <Skeleton width={32} height={28} borderRadius={14} />
                      <Skeleton width={80} height={12} style={{ marginLeft: 6 }} />
                    </View>
                  </View>
                  <View style={{ width: 60, height: 110, justifyContent: 'center', alignItems: 'center' }}>
                    <Skeleton width={50} height={100} borderRadius={25} />
                  </View>
                </View>
              </Panel>
            </View>
          ) : (
            <>
              {/* ── Row 1: Spend & Check-in Squares (Apple Grid) ──────────────── */}
              <Animated.View entering={FadeInUp.delay(100).duration(600).springify()} style={styles.widgetGridRow}>
                
                {/* Spend widget */}
                <AnimatedPressable onPress={() => router.push('/purchases')} style={{ flex: 1 }}>
                  <Panel style={[styles.widgetSquare, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.widgetHeader}>
                      <Label text="SPEND" color={themeColors.textSecondary} />
                      <Feather name="credit-card" size={14} color={colors.accent} />
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                      <AnimatedNumber
                        value={todaySpend}
                        prefix="₹"
                        style={[styles.widgetNumber, { color: themeColors.text }]}
                      />
                    </View>

                    <View style={{ width: '100%', gap: 4 }}>
                      <Text style={[styles.statusText, { color: themeColors.textSecondary, fontSize: 11 }]}>
                        today's expenses
                      </Text>
                      <SpendPowerCore spend={todaySpend} isDark={isDark} />
                    </View>
                  </Panel>
                </AnimatedPressable>

                {/* Attendance Viewfinder widget */}
                <AnimatedPressable
                  onPress={() => router.push('/attendance')}
                  style={{ flex: 1 }}
                >
                  {(() => {
                    const checkInTimeStr = lastCheckInTime
                      ? new Date(lastCheckInTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata',
                        })
                      : null;

                    return (
                      <Panel style={[styles.widgetSquare, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
                        <View style={[styles.widgetHeader, { width: '100%' }]}>
                          <Label text="CHECK-IN" color={themeColors.textSecondary} />
                          <Feather name="aperture" size={13} color={colors.accent} />
                        </View>
                        
                        <CameraViewfinder offlineCount={offlineCount} colors={colors} isDark={isDark} />

                        <View style={styles.statusRow}>
                          <Dot color={offlineCount > 0 ? themeColors.alert : themeColors.success} />
                          <Text style={[styles.statusText, { color: offlineCount > 0 ? themeColors.alert : themeColors.success, fontSize: 12 }]} numberOfLines={1}>
                            {offlineCount > 0
                              ? (checkInTimeStr ? `Pending • ${checkInTimeStr}` : `${offlineCount} log pending`)
                              : (checkInTimeStr ? `Synced • ${checkInTimeStr}` : 'Synced')}
                          </Text>
                        </View>
                      </Panel>
                    );
                  })()}
                </AnimatedPressable>

              </Animated.View>

              {/* ── Row 2: Unified Combined Water & Timeline Widget ─────────── */}
              <Animated.View entering={FadeInUp.delay(200).duration(600).springify()}>
                <Animated.View style={highlightStyle}>
                  <Panel style={[styles.widgetFullWidth, { backgroundColor: colors.surface, borderColor: 'transparent', borderWidth: 0 }]}>
                    <View style={styles.horizontalSplit}>
                      <View style={{ flex: 1, gap: 10 }}>
                        <AnimatedPressable onPress={() => router.push('/water')} style={{ width: '100%' }}>
                          <View style={styles.widgetHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Label text="WATER & TIMELINE" color={themeColors.textSecondary} />
                            </View>
                            <Feather name="droplet" size={14} color={colors.aqua} />
                          </View>
                          
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                            <AnimatedNumber
                              value={waterTotalMl}
                              prefix=""
                              style={[styles.widgetNumber, { color: colors.aqua }]}
                            />
                            <Text style={[styles.widgetNumberUnit, { color: colors.aqua }]}>ml</Text>
                            <Text style={[styles.statusText, { color: themeColors.textSecondary, fontSize: 11, marginLeft: 8 }]}>
                              ({waterPct}% of goal)
                            </Text>
                          </View>
                        </AnimatedPressable>

                        {/* Compact grid timeline */}
                        <View style={styles.hourGridCompactLeft}>
                          {Array.from({ length: 17 }, (_, i) => {
                            const hour = i + 6; // 6 AM to 10 PM
                            const done = waterHourlyMap[hour] === true;
                            const isCurrentHour = hour === currentHour;
                            
                            let dotColor: string = themeColors.hairline;
                            if (done) dotColor = colors.aqua;               // water logged
                            if (isCurrentHour && !done) dotColor = colors.signal; // "now" marker

                            return (
                              <View key={hour} style={styles.hourCellCompact}>
                                <PulseDot color={dotColor} isActive={isCurrentHour} size={8} />
                              </View>
                            );
                          })}
                        </View>

                        {/* Inline water controls */}
                        <View style={styles.widgetControlRowLeft}>
                          {waterSaving ? (
                            <View style={[styles.widgetControlBtn, { backgroundColor: colors.primary + '18', width: 90, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }]}>
                              <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.9 }] }} />
                            </View>
                          ) : (
                            <>
                              <TouchableOpacity onPress={() => removeWater()} style={[styles.widgetControlBtn, { backgroundColor: colors.primary + '18' }]} activeOpacity={0.7}>
                                <Feather name="minus" size={18} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => addWater(250)} style={[styles.widgetControlBtn, { backgroundColor: colors.primary + '18' }]} activeOpacity={0.7}>
                                <Feather name="plus" size={18} color={colors.primary} />
                              </TouchableOpacity>
                            </>
                          )}
                          <Text style={[styles.statusText, { color: themeColors.textSecondary, fontSize: 11, marginLeft: 6 }]}>
                            {trackedHours} logs today
                          </Text>
                        </View>
                      </View>

                      {/* Animated Bottle Fluid Chamber */}
                      <AnimatedPressable onPress={() => router.push('/water')}>
                        <WaterChamber percent={waterPct} colors={colors} isDark={isDark} />
                      </AnimatedPressable>
                    </View>
                  </Panel>
                </Animated.View>
              </Animated.View>

              {/* ── Row 3: Barcode Alarm (Conditionally Rendered when Active) ── */}
              {alarmConfig?.enabled && (
                <Animated.View entering={FadeInDown.duration(600).springify()}>
                  <AnimatedPressable
                    onPress={() => router.push('/alarm/setup' as any)}
                    style={{ marginTop: 16 }}
                  >
                    <Panel style={[styles.widgetFullWidth, { backgroundColor: colors.surface, borderColor: colors.border, height: 100 }]}>
                      <View style={styles.alarmLayout}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Label text="BARCODE ALARM ACTIVE" color={themeColors.textSecondary} />
                          <Text style={[styles.alarmTimeText, { color: themeColors.text }]}>
                            {formatAlarmTime(alarmConfig.hour, alarmConfig.minute)}
                          </Text>
                          <Text style={[styles.statusText, { color: themeColors.textSecondary, fontSize: 11 }]}>
                            {alarmConfig.soundName || 'Default Sound'} • Scan barcode to dismiss
                          </Text>
                        </View>
                        <View style={styles.alarmIconContainer}>
                          <AnimatedRingingBell colors={colors} />
                        </View>
                      </View>
                    </Panel>
                  </AnimatedPressable>
                </Animated.View>
              )}
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: Spacing.four,
    gap: 16,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  appName: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  dateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  dateStr: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Apple iOS Widget Grid ──────────────────────────────────────────────────
  widgetGridRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  widgetSquare: {
    flex: 1,
    height: 162,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  widgetFullWidth: {
    width: '100%',
    height: 162,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  widgetNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  widgetNumberUnit: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  horizontalSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },

  // ── Shared primitives ────────────────────────────────────────────────────────
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  strip: {
    height: 5,
    borderRadius: 2.5,
    width: '100%',
    overflow: 'hidden',
  },
  stripFill: {
    height: '100%',
    borderRadius: 2.5,
  },

  // ── Spend Power Core ────────────────────────────────────────────────────────
  powerCoreContainer: {
    marginTop: 2,
  },
  powerCoreRow: {
    flexDirection: 'row',
    gap: 4,
  },
  powerCoreSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },

  // ── Water Inline Controls & Timeline Grid ───────────────────────────────────
  widgetControlRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  widgetControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourGridCompactLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
    paddingVertical: 2,
    width: '100%',
  },
  hourCellCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 10,
    height: 10,
  },
  pulseContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  solidDot: {},

  // ── Viewfinder Scanner ──────────────────────────────────────────────────────
  viewfinderContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderBrackets: {
    width: 40,
    height: 40,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bracketTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  bracketTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  bracketBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  bracketBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  laserLine: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: 1.5,
    top: 2,
    opacity: 0.8,
  },

  // ── Water Fluid Chamber ─────────────────────────────────────────────────────
  chamberContainer: {
    width: 60,
    height: 110,
    borderRadius: 30,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  chamberFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  alarmLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  alarmTimeText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 38,
  },
  alarmIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
