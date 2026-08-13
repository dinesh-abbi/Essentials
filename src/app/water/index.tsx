import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  Modal,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '@/components/SkeletonLoader';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import { triggerWaterGoalNotification } from '@/utils/notifications';

// ── Water Wave Animation Component ──────────────────────────────────────────
function WaterWave({ percent, colors, isLoading, pulseStyle }: { percent: number; colors: any; isLoading?: boolean; pulseStyle?: any }) {
  const animatedPercent = useSharedValue(0);
  const rotation1 = useSharedValue(0);
  const rotation2 = useSharedValue(0);

  // Bubble animation values
  const bubbleY1 = useSharedValue(0);
  const bubbleY2 = useSharedValue(0);
  const bubbleY3 = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return; // no ambient rotation/bubbles under reduced motion
    rotation1.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
    rotation2.value = withRepeat(
      withTiming(-360, { duration: 11000, easing: Easing.linear }),
      -1,
      false
    );

    bubbleY1.value = withRepeat(
      withTiming(-200, { duration: 4000, easing: Easing.ease }),
      -1,
      false
    );
    bubbleY2.value = withRepeat(
      withTiming(-200, { duration: 6000, easing: Easing.ease }),
      -1,
      false
    );
    bubbleY3.value = withRepeat(
      withTiming(-200, { duration: 5000, easing: Easing.ease }),
      -1,
      false
    );
  }, [reduceMotion]);

  useEffect(() => {
    animatedPercent.value = withTiming(Math.min(percent, 1), {
      duration: 1000,
      easing: Easing.out(Easing.quad),
    });
  }, [percent]);

  const waveHeight = useDerivedValue(() => {
    return interpolate(animatedPercent.value, [0, 1], [320, 110]);
  });

  const waveStyle1 = useAnimatedStyle(() => ({
    transform: [
      { translateY: waveHeight.value },
      { rotate: `${rotation1.value}deg` },
    ],
  }));

  const waveStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateY: waveHeight.value - 10 },
      { rotate: `${rotation2.value}deg` },
    ],
  }));

  const bubbleStyle1 = useAnimatedStyle(() => {
    const bubbleY = 190 + bubbleY1.value;
    const waterY = 210 * (1 - animatedPercent.value);
    const opacity = bubbleY < waterY ? 0 : 1;
    return {
      transform: [{ translateY: bubbleY1.value }],
      opacity,
    };
  });

  const bubbleStyle2 = useAnimatedStyle(() => {
    const bubbleY = 200 + bubbleY2.value;
    const waterY = 210 * (1 - animatedPercent.value);
    const opacity = bubbleY < waterY ? 0 : 1;
    return {
      transform: [{ translateY: bubbleY2.value }],
      opacity,
    };
  });

  const bubbleStyle3 = useAnimatedStyle(() => {
    const bubbleY = 180 + bubbleY3.value;
    const waterY = 210 * (1 - animatedPercent.value);
    const opacity = bubbleY < waterY ? 0 : 1;
    return {
      transform: [{ translateY: bubbleY3.value }],
      opacity,
    };
  });

  return (
    <View style={[styles.waveContainer, { borderColor: colors.border }]}>
      {/* Wave Layers */}
      <Animated.View
        style={[
          styles.waveLayer,
          waveStyle1,
          { backgroundColor: colors.aqua + 'D0', borderRadius: 130 },
        ]}
      />
      <Animated.View
        style={[
          styles.waveLayer,
          waveStyle2,
          { backgroundColor: colors.aqua + 'E0', borderRadius: 125 },
        ]}
      />

      {/* Floating Bubbles inside liquid */}
      <Animated.View style={[styles.bubble, { left: 45, bottom: 20 }, bubbleStyle1]} />
      <Animated.View style={[styles.bubble, { left: 110, bottom: 10, width: 6, height: 6 }, bubbleStyle2]} />
      <Animated.View style={[styles.bubble, { left: 155, bottom: 30, width: 7, height: 7 }, bubbleStyle3]} />

      {/* Center Percentage Display */}
      <Animated.View style={[styles.waveOverlayText, isLoading && pulseStyle]}>
        <Text style={[styles.percentNum, { color: '#FFF' }]}>
          {isLoading ? '—' : `${Math.round(percent * 100)}%`}
        </Text>
        <Text style={[styles.percentLabel, { color: '#FFFFFFA0' }]}>
          {isLoading ? 'LOADING' : 'DRANK'}
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Animated Bar Component for Weekly Chart ──────────────────────────────────
function AnimatedBar({
  dayName,
  totalMl,
  goal,
  colors,
  isSelected,
  onPress,
}: {
  dayName: string;
  totalMl: number;
  goal: number;
  colors: any;
  isSelected: boolean;
  onPress: () => void;
}) {
  const heightPercent = Math.min(totalMl / goal, 1.2);
  const heightVal = useSharedValue(0);

  useEffect(() => {
    heightVal.value = withTiming(heightPercent * 130, { duration: 1000 });
  }, [totalMl, goal]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightVal.value,
  }));

  const getBarColor = () => {
    if (totalMl >= goal) return colors.success;
    if (totalMl > 0) return colors.aqua;
    return colors.border;
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.barCol}>
      <Text style={[styles.barValText, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? '900' : '700' }]}>
        {totalMl > 0 ? `${(totalMl / 1000).toFixed(1)}L` : '0'}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: colors.backgroundSelected, borderColor: isSelected ? colors.primary : 'transparent', borderWidth: isSelected ? 1.5 : 0 }]}>
        <Animated.View
          style={[
            styles.barFill,
            animatedStyle,
            { backgroundColor: getBarColor() },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '900' : '700' }]}>{dayName}</Text>
    </TouchableOpacity>
  );
}

// ── Water Navigation Tabs ────────────────────────────────────────────────────
export function WaterTabs({ activeTab, onTabPress }: { activeTab: 'daily' | 'weekly' | 'monthly'; onTabPress: (tab: 'daily' | 'weekly' | 'monthly') => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.tabsWrapper, { backgroundColor: colors.backgroundSelected }]}>
      <TouchableOpacity
        onPress={() => onTabPress('daily')}
        style={[styles.tabBtn, activeTab === 'daily' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'daily' ? colors.text : colors.textSecondary }]}>Daily</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onTabPress('weekly')}
        style={[styles.tabBtn, activeTab === 'weekly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'weekly' ? colors.text : colors.textSecondary }]}>Weekly</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onTabPress('monthly')}
        style={[styles.tabBtn, activeTab === 'monthly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'monthly' ? colors.text : colors.textSecondary }]}>Monthly</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Water Screen ────────────────────────────────────────────────────────
export default function WaterDashboardScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Shared pulse animation for loading states
  const pulseVal = useSharedValue(0.35);
  useEffect(() => {
    if (reduceMotion) {
      pulseVal.value = 0.6;
      return;
    }
    pulseVal.value = withRepeat(
      withTiming(0.8, { duration: 1000, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      -1,
      true
    );
  }, [reduceMotion]);

  const skeletonPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseVal.value,
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // ── DAILY TAB STATES & LOGIC ───────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [totalDrank, setTotalDrank] = useState(0);
  const [goal, setGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [todayLogs, setTodayLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [hourlyStatus, setHourlyStatus] = useState<Record<number, boolean>>({});
  const [isMutating, setIsMutating] = useState<number | boolean>(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState('');

  const refreshDailyData = async (showSpinner = true) => {
    if (showSpinner) setLoadingDaily(true);
    try {
      const logs = await WaterStorage.getTodayWaterLogs();
      const total = await WaterStorage.getTodayTotalMl();
      const hourly = await WaterStorage.getTodayHourlyStatus();
      const userGoal = await WaterStorage.getUserWaterGoal();
      setTodayLogs(logs.sort((a, b) => b.timestamp - a.timestamp));
      setTotalDrank(total);
      setHourlyStatus(hourly);
      setGoal(userGoal);
    } catch (e) {
      console.warn('Failed to load daily hydration:', e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleSaveGoal = async (newGoal: number) => {
    if (isNaN(newGoal) || newGoal <= 0) {
      Alert.alert('Invalid Goal', 'Please enter a valid water volume in ml.');
      return;
    }
    try {
      await WaterStorage.setUserWaterGoal(newGoal);
      setGoal(newGoal);
      setIsGoalModalOpen(false);
      setCustomGoalInput('');
      WidgetSync.sync();
    } catch (e) {
      Alert.alert('Error', 'Failed to update hydration target.');
    }
  };

  const handleAddWater = async (ml: number) => {
    setIsMutating(ml);
    try {
      const prevTotal = totalDrank;
      await WaterStorage.logWaterIntake(ml);
      await refreshDailyData(false);
      WidgetSync.sync();

      if (prevTotal < WaterStorage.DEFAULT_DAILY_GOAL) {
        const freshTotal = await WaterStorage.getTodayTotalMl();
        if (freshTotal >= WaterStorage.DEFAULT_DAILY_GOAL) {
          triggerWaterGoalNotification().catch((e) =>
            console.warn('Goal notification failed:', e)
          );
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save water log.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    Alert.alert('Remove Log', 'Do you want to delete this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsMutating(true);
          try {
            await WaterStorage.deleteWaterLog(id);
            await refreshDailyData(false);
            WidgetSync.sync();
          } catch (e) {
            Alert.alert('Error', 'Could not delete entry.');
          } finally {
            setIsMutating(false);
          }
        },
      },
    ]);
  };

  const hydrationPercent = Math.min(totalDrank / goal, 2);

  // ───────────────────────────────────────────────────────────────────────────
  // ── WEEKLY TAB STATES & LOGIC ──────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [weeklyData, setWeeklyData] = useState<{ date: Date; totalMl: number; logsCount: number }[]>([]);
  const [weeklyRawLogs, setWeeklyRawLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<{ date: Date; totalMl: number; logsCount: number } | null>(null);
  const [selectedWeeklyLogs, setSelectedWeeklyLogs] = useState<WaterStorage.WaterLog[]>([]);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const refreshWeeklyData = async () => {
    setLoadingWeekly(true);
    try {
      const refDateMs = Date.now() + weekOffset * 7 * 24 * 60 * 60 * 1000;
      const data = await WaterStorage.getWeeklyData(refDateMs);
      setWeeklyData(data);

      // Find Monday and Sunday of that offset week
      const now = new Date(refDateMs);
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const rawLogs = await WaterStorage.getWaterLogsBetween(monday.getTime(), sunday.getTime());
      setWeeklyRawLogs(rawLogs);

      // Set selected day to Monday by default or clear selection
      if (data.length > 0) {
        setSelectedWeeklyDay(data[0]);
        const dayStart = new Date(data[0].date.getFullYear(), data[0].date.getMonth(), data[0].date.getDate()).getTime();
        const dayEnd = dayStart + 86400000 - 1;
        const filtered = rawLogs.filter((l) => l.timestamp >= dayStart && l.timestamp <= dayEnd);
        setSelectedWeeklyLogs(filtered.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setSelectedWeeklyDay(null);
        setSelectedWeeklyLogs([]);
      }
    } catch (e) {
      console.warn('Failed to load weekly progress:', e);
    } finally {
      setLoadingWeekly(false);
    }
  };

  const handleSelectWeeklyDay = (day: { date: Date; totalMl: number; logsCount: number }) => {
    router.push({
      pathname: '/water/report' as any,
      params: { dateMs: day.date.getTime().toString() }
    });
  };

  // Weekly Stats Calculations
  const weeklyTotalVolume = weeklyData.reduce((sum, d) => sum + d.totalMl, 0);
  const weeklyAverageVolume = Math.round(weeklyTotalVolume / 7);
  const weeklyDaysGoalMet = weeklyData.filter((d) => d.totalMl >= goal).length;
  const weeklyBestDay = weeklyData.reduce((best, curr) => (curr.totalMl > best.totalMl ? curr : best), { totalMl: 0 } as any);

  const getBestWeeklyDayName = () => {
    if (!weeklyBestDay.date || weeklyBestDay.totalMl === 0) return '—';
    const dayIndex = weeklyBestDay.date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return weekdays[adjustedIndex];
  };

  // Calculate clean range subtitle: e.g. "Mon, 12 Jul — Sun, 18 Jul"
  const getWeeklySubtitleRange = () => {
    if (weeklyData.length < 7) return 'Loading...';
    const firstDate = weeklyData[0].date;
    const lastDate = weeklyData[6].date;
    const firstStr = firstDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const lastStr = lastDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `${firstStr} — ${lastStr}`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── MONTHLY TAB STATES & LOGIC ─────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayMap, setDayMap] = useState<Map<number, number>>(new Map());
  const [monthlyRawLogs, setMonthlyRawLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [selectedMonthlyDayNum, setSelectedMonthlyDayNum] = useState<number | null>(null);
  const [selectedMonthlyLogs, setSelectedMonthlyLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [selectedMonthlyTotal, setSelectedMonthlyTotal] = useState(0);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const refreshMonthlyData = async () => {
    setLoadingMonthly(true);
    try {
      const data = await WaterStorage.getMonthlyCalendarData(currentYear, currentMonth);
      setDayMap(data);

      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      const rawLogs = await WaterStorage.getWaterLogsBetween(startOfMonth.getTime(), endOfMonth.getTime());
      setMonthlyRawLogs(rawLogs);

      // Default selected day to today (if in current month) or the 1st
      const today = new Date();
      let defaultDay = 1;
      if (today.getFullYear() === currentYear && today.getMonth() === currentMonth) {
        defaultDay = today.getDate();
      }
      setSelectedMonthlyDayNum(defaultDay);
      const dayStart = new Date(currentYear, currentMonth, defaultDay).getTime();
      const dayEnd = dayStart + 86400000 - 1;
      const filtered = rawLogs.filter((l) => l.timestamp >= dayStart && l.timestamp <= dayEnd);
      setSelectedMonthlyLogs(filtered.sort((a, b) => b.timestamp - a.timestamp));
      setSelectedMonthlyTotal(data.get(defaultDay) || 0);

    } catch (e) {
      console.warn('Failed to load monthly data:', e);
    } finally {
      setLoadingMonthly(false);
    }
  };

  const handleSelectMonthlyDay = (dayNum: number) => {
    const targetDate = new Date(currentYear, currentMonth, dayNum);
    router.push({
      pathname: '/water/report' as any,
      params: { dateMs: targetDate.getTime().toString() }
    });
  };

  // Month Grid Calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells: { type: 'empty' | 'day'; dayNum?: number }[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ type: 'empty' });
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    cells.push({ type: 'day', dayNum: d });
  }

  // Monthly stats calculations
  let monthlyTotalLitres = 0;
  let monthlyDaysTracked = 0;
  let monthlyDaysGoalMet = 0;
  let monthlyMaxIntake = 0;

  dayMap.forEach((val) => {
    monthlyTotalLitres += val;
    if (val > 0) monthlyDaysTracked++;
    if (val >= goal) monthlyDaysGoalMet++;
    if (val > monthlyMaxIntake) monthlyMaxIntake = val;
  });

  const monthlyDailyAverage = monthlyDaysTracked > 0 ? Math.round(monthlyTotalLitres / monthlyDaysTracked) : 0;
  const monthNameName = currentDate.toLocaleString('default', { month: 'long' });

  const getCellColor = (ml: number, isSelected: boolean) => {
    if (ml === 0) return isDark ? colors.surfaceSunken : colors.backgroundSelected;
    if (ml < goal / 3) return colors.aqua + '35';
    if (ml < goal) return colors.aqua + '60';
    return colors.aqua;
  };

  const getCellTextColor = (ml: number) => {
    if (ml >= goal) return '#FFFFFF';
    return colors.text;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── CENTRAL DISPATCH & TAB BINDING ─────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    refreshDailyData();
  }, []);

  useEffect(() => {
    refreshWeeklyData();
  }, [weekOffset]);

  useEffect(() => {
    refreshMonthlyData();
  }, [currentDate]);

  const handleTabPress = (tab: 'daily' | 'weekly' | 'monthly') => {
    setActiveTab(tab);
    let index = 0;
    if (tab === 'weekly') index = 1;
    if (tab === 'monthly') index = 2;
    scrollViewRef.current?.scrollTo({ x: index * windowWidth, animated: true });
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </AnimatedPressable>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.headerTitle}>
            HYDRATION
          </ThemedText>
          {loadingDaily || loadingWeekly || loadingMonthly ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ width: 40 }} />
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Swipeable Tabs Bar */}
        <WaterTabs activeTab={activeTab} onTabPress={handleTabPress} />

        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / windowWidth);
            if (index === 0) setActiveTab('daily');
            else if (index === 1) setActiveTab('weekly');
            else if (index === 2) setActiveTab('monthly');
          }}
        >
          {/* ============================================== */}
          {/* ================ 1. DAILY PANEL ============== */}
          {/* ============================================== */}
          <View style={{ width: windowWidth }}>
            <FlatList
              data={loadingDaily ? [] : todayLogs}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              ListHeaderComponent={
                <View style={styles.heroSection}>
                  {/* Wave Animation Loader */}
                  <WaterWave
                    percent={loadingDaily ? 0.35 : hydrationPercent}
                    colors={colors}
                    isLoading={loadingDaily}
                    pulseStyle={skeletonPulseStyle}
                  />

                  {/* Progress Stats Block */}
                  <View style={styles.statsBlock}>
                    {loadingDaily ? (
                      <Animated.View style={[{ gap: 6, alignItems: 'center' }, skeletonPulseStyle]}>
                        <Skeleton width={110} height={36} />
                        <Skeleton width={130} height={14} />
                      </Animated.View>
                    ) : (
                      <>
                        <Text style={[styles.mainVol, { color: colors.text }]}>
                          {totalDrank} <Text style={styles.volUnit}>ml</Text>
                        </Text>
                        <TouchableOpacity
                          onPress={() => setIsGoalModalOpen(true)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>
                            Target: {goal} ml
                          </Text>
                          <Feather name="edit-2" size={12} color={colors.primary} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  {/* Quick Add Row */}
                  <View style={styles.quickAddRow}>
                    {[250, 500, 1000].map((ml) => {
                      const currentlyMutating = isMutating === ml;
                      return (
                        <AnimatedPressable
                          key={ml}
                          onPress={() => handleAddWater(ml)}
                          disabled={loadingDaily || isMutating !== false}
                          style={[
                            styles.quickBtn,
                            {
                              borderColor: colors.border,
                              opacity: (loadingDaily || isMutating !== false) && !currentlyMutating ? 0.5 : 1,
                            },
                          ]}
                        >
                          {currentlyMutating ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Feather name="droplet" size={14} color={colors.aqua} />
                              <Text style={[styles.quickBtnText, { color: colors.text }]}>+{ml}ml</Text>
                            </>
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>

                  {/* Hourly Timeline */}
                  <View style={[styles.timelineCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <Text style={[styles.timelineTitle, { color: colors.textSecondary }]}>
                      HOURLY TRACKING (6 AM - 10 PM)
                    </Text>
                    <View style={styles.timelineDotsRow}>
                      {loadingDaily
                        ? Array.from({ length: 17 }).map((_, i) => (
                            <View key={i} style={styles.dotColumn}>
                              <Animated.View style={[skeletonPulseStyle]}>
                                <Skeleton width={8} height={8} borderRadius={4} />
                              </Animated.View>
                              <Skeleton width={12} height={8} style={{ marginTop: 4 }} />
                            </View>
                          ))
                        : Object.entries(hourlyStatus)
                            .map(([hour, drank]) => ({ hour: parseInt(hour), drank }))
                            .sort((a, b) => a.hour - b.hour)
                            .map(({ hour, drank }) => (
                              <View key={hour} style={styles.dotColumn}>
                                <View
                                  style={[
                                    styles.timelineDot,
                                    {
                                      backgroundColor: drank ? colors.aqua : colors.backgroundSelected,
                                      borderColor: drank ? colors.aqua : colors.border,
                                    },
                                  ]}
                                />
                                <Text style={[styles.dotLabel, { color: colors.textSecondary }]}>
                                  {hour % 3 === 0 || hour === 22 || hour === 6
                                    ? (hour > 12 ? `${hour - 12}p` : hour === 12 ? '12p' : `${hour}a`)
                                    : ''}
                                </Text>
                              </View>
                            ))}
                    </View>
                  </View>

                  {/* History List Header */}
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TODAY'S LOG HISTORY</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Animated.View
                  entering={FadeInDown.duration(350)}
                  style={[styles.logCard, { borderColor: colors.border }]}
                >
                  <View style={styles.logLeft}>
                    <View style={[styles.logIcon, { backgroundColor: colors.aqua + '18' }]}>
                      <Feather name="droplet" size={14} color={colors.aqua} />
                    </View>
                    <View>
                      <Text style={[styles.logAmount, { color: colors.text }]}>{item.amountMl} ml</Text>
                      <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteLog(item.id)} style={styles.deleteBtn}>
                    <Feather name="trash-2" size={14} color={colors.alert} />
                  </TouchableOpacity>
                </Animated.View>
              )}
              ListEmptyComponent={
                loadingDaily ? (
                  <View style={{ gap: 12, width: '100%' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Animated.View key={i} style={[styles.logCard, { borderColor: colors.border, opacity: pulseVal.value }]}>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                          <Skeleton width={32} height={32} borderRadius={16} />
                          <View style={{ gap: 4 }}>
                            <Skeleton width={80} height={14} />
                            <Skeleton width={50} height={10} />
                          </View>
                        </View>
                      </Animated.View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyLogs}>
                    <Feather name="coffee" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                    <Text style={[styles.emptyLogsText, { color: colors.textSecondary }]}>No water logged yet today.</Text>
                  </View>
                )
              }
            />
          </View>

          {/* ============================================== */}
          {/* ================ 2. WEEKLY PANEL ============= */}
          {/* ============================================== */}
          <View style={{ width: windowWidth }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Week Navigation bar */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setWeekOffset(prev => prev - 1)} style={[styles.navBtn, { borderColor: colors.border }]}>
                  <Feather name="chevron-left" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `Week (${weekOffset} w)`}
                </Text>
                <TouchableOpacity onPress={() => setWeekOffset(prev => Math.min(0, prev + 1))} disabled={weekOffset === 0} style={[styles.navBtn, { borderColor: colors.border, opacity: weekOffset === 0 ? 0.3 : 1 }]}>
                  <Feather name="chevron-right" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Chart Card */}
              {loadingWeekly ? (
                <Animated.View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border, gap: 16 }, skeletonPulseStyle]}>
                  <Skeleton width={160} height={10} />
                  <View style={[styles.barsContainer, { justifyContent: 'space-between', alignItems: 'flex-end', height: 130 }]}>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                        <Skeleton width={14} height={20 + i * 15} borderRadius={4} />
                        <Skeleton width={20} height={8} />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(400)}>
                  <View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                      <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>WEEKLY HISTORY (TAP TO EXPLORE)</Text>
                      <Text style={[styles.chartSubtitle, { color: colors.text }]}>{getWeeklySubtitleRange()}</Text>
                    </View>

                    <View style={styles.barsContainer}>
                      {weeklyData.map((d, index) => (
                        <AnimatedBar
                          key={index}
                          dayName={weekdays[index]}
                          totalMl={d.totalMl}
                          goal={goal}
                          colors={colors}
                          isSelected={selectedWeeklyDay?.date.toDateString() === d.date.toDateString()}
                          onPress={() => handleSelectWeeklyDay(d)}
                        />
                      ))}
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Weekly Summary statistics grid */}
              <View style={styles.statsGrid}>
                {loadingWeekly ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Animated.View key={i} style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }, skeletonPulseStyle]}>
                      <Skeleton width={50} height={14} />
                      <Skeleton width={80} height={20} style={{ marginTop: 4 }} />
                    </Animated.View>
                  ))
                ) : (
                  <>
                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="activity" size={16} color={colors.primary} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{(weeklyTotalVolume / 1000).toFixed(1)}L</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Volume</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="droplet" size={16} color={colors.aqua} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{weeklyAverageVolume}ml</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Daily Average</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="award" size={16} color={colors.success} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{weeklyDaysGoalMet}/7</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Days Goal Met</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="star" size={16} color={colors.primary} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{getBestWeeklyDayName()}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best Hydrated</Text>
                    </View>
                  </>
                )}
              </View>


            </ScrollView>
          </View>

          {/* ============================================== */}
          {/* ================ 3. MONTHLY PANEL ============ */}
          {/* ============================================== */}
          <View style={{ width: windowWidth }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Calendar control row */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} style={[styles.navBtn, { borderColor: colors.border }]}>
                  <Feather name="chevron-left" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {monthNameName} {currentYear}
                </Text>
                <TouchableOpacity onPress={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} style={[styles.navBtn, { borderColor: colors.border }]}>
                  <Feather name="chevron-right" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Monthly Calendar View */}
              {loadingMonthly ? (
                <Animated.View style={[styles.calendarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border, gap: 16 }, skeletonPulseStyle]}>
                  <Skeleton width={120} height={12} />
                  <View style={[styles.gridContainer]}>
                    {Array.from({ length: 30 }).map((_, i) => (
                      <Skeleton key={i} width={34} height={34} borderRadius={8} />
                    ))}
                  </View>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(400)}>
                  <View style={[styles.calendarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <View style={styles.daysHeader}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                        <Text key={idx} style={[styles.dayLabel, { color: colors.textSecondary }]}>
                          {day}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.gridContainer}>
                      {cells.map((cell, index) => {
                        if (cell.type === 'empty') {
                          return <View key={`empty-${index}`} style={styles.cellSpacer} />;
                        }

                        const dayNum = cell.dayNum!;
                        const mlDrank = dayMap.get(dayNum) || 0;
                        const isSelected = selectedMonthlyDayNum === dayNum;
                        const cellColor = getCellColor(mlDrank, isSelected);
                        const textColor = getCellTextColor(mlDrank);

                        return (
                          <TouchableOpacity
                            key={`day-${dayNum}`}
                            activeOpacity={0.8}
                            onPress={() => handleSelectMonthlyDay(dayNum)}
                            style={[
                              styles.cell,
                              {
                                backgroundColor: cellColor,
                                borderColor: isSelected ? colors.primary : 'transparent',
                                borderWidth: isSelected ? 1.5 : 0,
                              },
                            ]}
                          >
                            <Text style={[styles.cellText, { color: textColor }]}>
                              {dayNum}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Legend */}
              <View style={styles.legendRow}>
                <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Less</Text>
                <View style={[styles.legendDot, { backgroundColor: isDark ? colors.surfaceSunken : colors.backgroundSelected }]} />
                <View style={[styles.legendDot, { backgroundColor: colors.aqua + '25' }]} />
                <View style={[styles.legendDot, { backgroundColor: colors.aqua + '60' }]} />
                <View style={[styles.legendDot, { backgroundColor: colors.aqua }]} />
                <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>More (Goal)</Text>
              </View>



              {/* Month Summary Stats grid */}
              <View style={styles.statsGrid}>
                {loadingMonthly ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Animated.View key={i} style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }, skeletonPulseStyle]}>
                      <Skeleton width={50} height={14} />
                      <Skeleton width={80} height={20} style={{ marginTop: 4 }} />
                    </Animated.View>
                  ))
                ) : (
                  <>
                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="droplet" size={16} color={colors.aqua} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{(monthlyTotalLitres / 1000).toFixed(1)}L</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Drank</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="calendar" size={16} color={colors.primary} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{monthlyDaysTracked} days</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Days Logged</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="award" size={16} color={colors.success} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{monthlyDaysGoalMet} days</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Target Hit</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="trending-up" size={16} color={colors.primary} />
                      <Text style={[styles.statVal, { color: colors.text }]}>{(monthlyDailyAverage / 1000).toFixed(1)}L</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Daily Avg</Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </Animated.ScrollView>

        {/* Set Hydration Target Modal */}
        <Modal
          visible={isGoalModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsGoalModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.editCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.editTitle, { color: colors.text }]}>Set Daily Target</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 16 }}>
                Adjust your daily target water intake to keep track of your hydration progress.
              </Text>

              {/* Preset buttons */}
              <View style={styles.presetRow}>
                {[2000, 3000, 4000, 5000].map((presetMl) => (
                  <TouchableOpacity
                    key={presetMl}
                    onPress={() => handleSaveGoal(presetMl)}
                    style={[styles.presetBtn, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                      {presetMl / 1000}L
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 12, marginBottom: 6 }}>
                CUSTOM TARGET (ML)
              </Text>
              
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    marginBottom: 20,
                  },
                ]}
                placeholder="e.g. 3500"
                placeholderTextColor={colors.textSecondary}
                value={customGoalInput}
                onChangeText={setCustomGoalInput}
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    setIsGoalModalOpen(false);
                    setCustomGoalInput('');
                  }}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const customMl = parseInt(customGoalInput, 10);
                    handleSaveGoal(customMl);
                  }}
                  style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

// ── StyleSheet ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsWrapper: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActiveBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 16,
  },
  waveContainer: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#0B2530', // deep teal gauge well (aqua family, fixed both themes)
  },
  waveLayer: {
    position: 'absolute',
    width: 320,
    height: 320,
    left: -55,
    bottom: 0,
  },
  waveOverlayText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  percentNum: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  percentLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: -2,
  },
  bubble: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF60',
    zIndex: 5,
  },
  statsBlock: {
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  mainVol: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  volUnit: {
    fontSize: 18,
    fontWeight: '500',
  },
  goalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineCard: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  timelineTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timelineDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotColumn: {
    alignItems: 'center',
    gap: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  dotLabel: {
    fontSize: 8,
    fontWeight: '600',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
  },
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  logTime: {
    fontSize: 11,
    marginTop: 1,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyLogs: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyLogsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  presetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  chartCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    gap: 24,
  },
  chartHeader: {
    gap: 4,
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chartSubtitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 170,
    paddingBottom: 8,
  },
  barCol: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  barValText: {
    fontSize: 9,
  },
  barTrack: {
    width: 14,
    height: 130,
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    gap: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  breakdownCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayLabel: {
    width: 32,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSpacer: {
    width: 34,
    height: 34,
  },
  cellText: {
    fontSize: 12,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: -4,
  },
  legendLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
