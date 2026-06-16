import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Dimensions,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ConfettiRain } from '@/components/ui/confetti-rain';
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import * as AttendanceStorage from '@/utils/AttendanceStorage';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WaterStorage from '@/utils/WaterStorage';
import * as NotificationsUtil from '@/utils/notifications';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// ─── Animated Ambient Blobs ───────────────────────────────────────────────────

function AnimatedBlob({ color, initialTop, initialLeft, initialRight }: { color: string; initialTop: number; initialLeft?: number; initialRight?: number }) {
  const svScale = useSharedValue(1);
  const svTranslateX = useSharedValue(0);
  const svTranslateY = useSharedValue(0);

  useEffect(() => {
    svScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    svTranslateX.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 5000, easing: Easing.inOut(Easing.quad) }),
        withTiming(-20, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    svTranslateY.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 4500, easing: Easing.inOut(Easing.quad) }),
        withTiming(-15, { duration: 5500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 4500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: svScale.value },
      { translateX: svTranslateX.value },
      { translateY: svTranslateY.value }
    ]
  }));

  const positionStyle: any = { top: initialTop };
  if (initialLeft !== undefined) positionStyle.left = initialLeft;
  if (initialRight !== undefined) positionStyle.right = initialRight;

  return (
    <Animated.View
      style={[
        styles.bgBlob,
        { backgroundColor: color },
        positionStyle,
        animatedStyle,
      ]}
    />
  );
}

// ─── Odometer Number Counter ─────────────────────────────────────────────────

function AnimatedNumber({ value, style, prefix = '' }: { value: number; style: any; prefix?: string }) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: 1500, easing: Easing.out(Easing.quad) });
  }, [value]);

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
      style={[style, { padding: 0, margin: 0 }]}
    />
  );
}

// ─── Pulse Dot Indicator ──────────────────────────────────────────────────────

function PulseDot({ color, isActive, size = 12 }: { color: string; isActive: boolean; size?: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(withTiming(2.2, { duration: 1200, easing: Easing.out(Easing.quad) }), -1, false);
      opacity.value = withRepeat(withSequence(withTiming(0, { duration: 1200, easing: Easing.out(Easing.quad) })), -1, false);
    } else {
      scale.value = 1;
      opacity.value = 0;
    }
  }, [isActive]);

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
          let color = isDark ? '#60A5FA' : '#3B82F6'; // Cool blue
          if (i === 1) color = '#F59E0B'; // Amber
          if (i === 2) color = '#EF4444'; // Red
          if (i === 3) color = '#EC4899'; // Hot pink

          return (
            <View
              key={i}
              style={[
                styles.powerCoreSegment,
                {
                  backgroundColor: isActive ? color : isDark ? '#27272A' : '#E4E4E7',
                  opacity: isActive ? 1 : 0.25,
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

  useEffect(() => {
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
  }, []);

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
      {/* Dynamic filling water block */}
      <AnimatedWaterFill percent={percent} colors={colors} />
      
      {/* Floating bubbles rising physics */}
      <Bubble delay={0} duration={2200} />
      <Bubble delay={800} duration={2800} />
      <Bubble delay={1600} duration={3400} />
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
        { backgroundColor: colors.primary },
        animatedStyle,
      ]}
    />
  );
}

function Bubble({ delay, duration }: { delay: number; duration: number }) {
  const progress = useSharedValue(0);
  const randomXSeed = useSharedValue(Math.random());

  useEffect(() => {
    let timeout = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const ty = 100 - progress.value * 115;
    const tx = Math.sin(progress.value * Math.PI * 3) * 6 * (randomXSeed.value > 0.5 ? 1 : -1);
    
    let op = 0;
    if (progress.value < 0.15) {
      op = (progress.value / 0.15) * 0.7;
    } else if (progress.value > 0.8) {
      op = ((1 - progress.value) / 0.2) * 0.7;
    } else {
      op = 0.7;
    }

    return {
      transform: [
        { translateY: ty },
        { translateX: tx },
      ],
      opacity: op,
    };
  });

  return <Animated.View style={[styles.bubbleParticle, animatedStyle]} />;
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const highlight = params.highlight;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  
  const isDark = scheme === 'dark';
  const themeColors = Colors[scheme];
  
  const colors = {
    ...themeColors,
    primary: isDark ? '#60A5FA' : '#3B82F6',
    accent: isDark ? '#A78BFA' : '#8B5CF6',
    surface: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.75)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
  };

  const waterHighlight = useSharedValue(0);

  useEffect(() => {
    if (highlight === 'water') {
      waterHighlight.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        6,
        false
      );

      // Refresh water metrics immediately to stay in sync with background notification additions
      async function refresh() {
        try {
          setWaterTotalMl(await WaterStorage.getTodayTotalMl());
          setWaterHourlyMap(await WaterStorage.getTodayHourlyStatus());
        } catch (e) {
          console.error('Failed to refresh water metrics on highlight', e);
        }
      }
      refresh();

      router.setParams({ highlight: undefined });
    }
  }, [highlight]);

  const highlightStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      waterHighlight.value,
      [0, 1],
      [colors.border, colors.primary]
    );
    const scale = 1 + waterHighlight.value * 0.03;
    return {
      borderColor,
      transform: [{ scale }],
      shadowColor: colors.primary,
      shadowOpacity: waterHighlight.value * 0.5,
      shadowRadius: waterHighlight.value * 12,
      elevation: waterHighlight.value * 6,
      borderRadius: Radius.xl,
    };
  });

  const [offlineCount, setOfflineCount] = useState(0);
  const [todaySpend, setTodaySpend] = useState(0);
  const [waterTotalMl, setWaterTotalMl] = useState(0);
  const [waterHourlyMap, setWaterHourlyMap] = useState<Record<number, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      async function load() {
        try {
          const queue = await AttendanceStorage.getOfflineQueue();
          setOfflineCount(queue.length);

          const purchases = await PurchasesStorage.getPurchases();
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const todayPs = purchases.filter((p) => p.timestamp >= midnight.getTime());
          setTodaySpend(todayPs.reduce((a, c) => a + c.cost, 0));

          setWaterTotalMl(await WaterStorage.getTodayTotalMl());
          setWaterHourlyMap(await WaterStorage.getTodayHourlyStatus());
        } catch (e) {
          console.error('load metrics failed', e);
        }
      }
      load();
    }, [])
  );

  const addWater = async (amount: number) => {
    try {
      await WaterStorage.logWaterIntake(amount);
      const total = await WaterStorage.getTodayTotalMl();
      const hourly = await WaterStorage.getTodayHourlyStatus();
      setWaterTotalMl(total);
      setWaterHourlyMap(hourly);
      
      // Trigger test notification when we hit the daily water goal
      if (total >= WaterStorage.DEFAULT_DAILY_GOAL) {
        await NotificationsUtil.triggerWaterGoalNotification();
      }
    } catch (e) {
      console.error('Add water failed', e);
    }
  };

  const removeWater = async () => {
    try {
      const todayLogs = await WaterStorage.getTodayWaterLogs();
      if (todayLogs.length > 0) {
        todayLogs.sort((a, b) => b.timestamp - a.timestamp);
        await WaterStorage.deleteWaterLog(todayLogs[0].id);
        const total = await WaterStorage.getTodayTotalMl();
        const hourly = await WaterStorage.getTodayHourlyStatus();
        setWaterTotalMl(total);
        setWaterHourlyMap(hourly);
      }
    } catch (e) {
      console.error('Remove water failed', e);
    }
  };

  const trackedHours = Object.values(waterHourlyMap).filter(Boolean).length;
  const waterPct = Math.min(Math.round((waterTotalMl / WaterStorage.DEFAULT_DAILY_GOAL) * 100), 100);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const currentHour = now.getHours();

  const dayStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'User';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0A0B10' : '#F8FAFC' }]}>
      {/* Background Animated Blobs */}
      <AnimatedBlob color={colors.primary} initialTop={-120} initialLeft={-120} />
      <AnimatedBlob color={colors.accent} initialTop={250} initialRight={-160} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + Spacing.six },
          ]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ───────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: isDark ? '#94A3B8' : '#64748B' }]}>{greeting},</Text>
              <Text style={[styles.appName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{displayName}.</Text>
            </View>
            <View style={[styles.dateBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <Text style={[styles.dateStr, { color: isDark ? '#E2E8F0' : '#334155' }]}>{dayStr}</Text>
            </View>
          </Animated.View>

          {/* ── Row 1: Spend & Check-in Squares (Apple Grid) ──────────────── */}
          <Animated.View entering={FadeInUp.delay(100).duration(600).springify()} style={styles.widgetGridRow}>
            
            {/* Spend widget */}
            <AnimatedPressable onPress={() => router.push('/purchases')} style={{ flex: 1 }}>
              <GlassView style={[styles.widgetSquare, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.widgetHeader}>
                  <Label text="SPEND" color={isDark ? '#94A3B8' : '#64748B'} />
                  <Feather name="credit-card" size={14} color={colors.accent} />
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                  <AnimatedNumber
                    value={todaySpend}
                    prefix="₹"
                    style={[styles.widgetNumber, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                  />
                </View>

                <View style={{ width: '100%', gap: 4 }}>
                  <Text style={[styles.statusText, { color: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }]}>
                    today's expenses
                  </Text>
                  <SpendPowerCore spend={todaySpend} isDark={isDark} />
                </View>
              </GlassView>
            </AnimatedPressable>

            {/* Attendance Viewfinder widget */}
            <AnimatedPressable onPress={() => router.push('/attendance')} style={{ flex: 1 }}>
              <GlassView style={[styles.widgetSquare, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
                <View style={[styles.widgetHeader, { width: '100%' }]}>
                  <Label text="CHECK-IN" color={isDark ? '#94A3B8' : '#64748B'} />
                  <Feather name="aperture" size={13} color={colors.accent} />
                </View>
                
                <CameraViewfinder offlineCount={offlineCount} colors={colors} isDark={isDark} />

                <View style={styles.statusRow}>
                  <Dot color={offlineCount > 0 ? themeColors.alert : themeColors.success} />
                  <Text style={[styles.statusText, { color: offlineCount > 0 ? themeColors.alert : themeColors.success, fontSize: 12 }]} numberOfLines={1}>
                    {offlineCount > 0 ? `${offlineCount} log pending` : 'Synced'}
                  </Text>
                </View>
              </GlassView>
            </AnimatedPressable>

          </Animated.View>

          {/* ── Row 2: Unified Combined Water & Timeline Widget ─────────── */}
          <Animated.View entering={FadeInUp.delay(200).duration(600).springify()}>
            <Animated.View style={highlightStyle}>
              <GlassView style={[styles.widgetFullWidth, { backgroundColor: colors.surface, borderColor: 'transparent', borderWidth: 0 }]}>
                {/* Celebration Confetti & Rain overlay */}
                <ConfettiRain active={waterPct >= 100} />

                <View style={styles.horizontalSplit}>
                  <View style={{ flex: 1, gap: 10 }}>
                    <AnimatedPressable onPress={() => router.push('/water')} style={{ width: '100%' }}>
                      <View style={styles.widgetHeader}>
                        <Label
                          text={waterPct >= 100 ? "🎉 WATER GOAL REACHED! 🎉" : "WATER & TIMELINE"}
                          color={waterPct >= 100 ? (isDark ? '#34D399' : '#059669') : (isDark ? '#94A3B8' : '#64748B')}
                        />
                        <Feather
                          name={waterPct >= 100 ? "award" : "droplet"}
                          size={14}
                          color={waterPct >= 100 ? (isDark ? '#34D399' : '#059669') : colors.primary}
                        />
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <AnimatedNumber
                          value={waterTotalMl}
                          prefix=""
                          style={[styles.widgetNumber, { color: waterPct >= 100 ? (isDark ? '#34D399' : '#059669') : colors.primary }]}
                        />
                        <Text style={[styles.widgetNumberUnit, { color: waterPct >= 100 ? (isDark ? '#34D399' : '#059669') : colors.primary }]}>ml</Text>
                        {waterPct >= 100 ? (
                          <Animated.View entering={FadeInDown.duration(400)} style={[styles.congratsBadge, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(5, 150, 105, 0.1)' }]}>
                            <Text style={[styles.congratsText, { color: isDark ? '#34D399' : '#059669' }]}>🏆 Target Met!</Text>
                          </Animated.View>
                        ) : (
                          <Text style={[styles.statusText, { color: isDark ? '#94A3B8' : '#64748B', fontSize: 11, marginLeft: 8 }]}>
                            ({waterPct}% of goal)
                          </Text>
                        )}
                      </View>
                    </AnimatedPressable>

                    {/* Compact grid timeline */}
                    <View style={styles.hourGridCompactLeft}>
                      {Array.from({ length: 16 }, (_, i) => {
                        const hour = i + 6; // 6 AM to 9 PM
                        const done = waterHourlyMap[hour] === true;
                        const isCurrentHour = hour === currentHour;
                        
                        let dotColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                        if (done) dotColor = colors.primary;
                        if (isCurrentHour && !done) dotColor = colors.accent;

                        return (
                          <View key={hour} style={styles.hourCellCompact}>
                            <PulseDot color={dotColor} isActive={isCurrentHour} size={8} />
                          </View>
                        );
                      })}
                    </View>

                    {/* Inline water controls */}
                    <View style={styles.widgetControlRowLeft}>
                      <TouchableOpacity onPress={() => removeWater()} style={[styles.widgetControlBtn, { backgroundColor: colors.primary + '18' }]} activeOpacity={0.7}>
                        <Feather name="minus" size={13} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => addWater(250)} style={[styles.widgetControlBtn, { backgroundColor: colors.primary + '18' }]} activeOpacity={0.7}>
                        <Feather name="plus" size={13} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={[styles.statusText, { color: isDark ? '#94A3B8' : '#64748B', fontSize: 11, marginLeft: 4 }]}>
                        {trackedHours} logs today
                      </Text>
                    </View>
                  </View>

                  {/* Animated Bottle Fluid Chamber */}
                  <AnimatedPressable onPress={() => router.push('/water')}>
                    <WaterChamber percent={waterPct} colors={colors} isDark={isDark} />
                  </AnimatedPressable>
                </View>
              </GlassView>
            </Animated.View>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bgBlob: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    opacity: 0.14,
    filter: [{ blur: 70 }],
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
  bubbleParticle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    bottom: 0,
    left: '50%',
  },
  congratsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 10,
    alignSelf: 'center',
  },
  congratsText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
