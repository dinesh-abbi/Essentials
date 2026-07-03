import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import AppLoader from '@/components/AppLoader';
import * as WaterStorage from '@/utils/WaterStorage';
import { WaterTabs } from './index';

export default function MonthlyWaterScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date()); // Holds active year/month
  const [dayMap, setDayMap] = useState<Map<number, number>>(new Map());

  const goal = WaterStorage.DEFAULT_DAILY_GOAL;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  useEffect(() => {
    loadMonthlyData();
  }, [currentDate]);

  async function loadMonthlyData() {
    setLoading(true);
    try {
      const data = await WaterStorage.getMonthlyCalendarData(currentYear, currentMonth);
      setDayMap(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve monthly hydration calendar.');
    } finally {
      setLoading(false);
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Calendar Grid Calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Create grid cells (offset + days)
  const cells: { type: 'empty' | 'day'; dayNum?: number }[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ type: 'empty' });
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    cells.push({ type: 'day', dayNum: d });
  }

  // Monthly stats calculations
  let totalLitres = 0;
  let daysTracked = 0;
  let daysGoalMet = 0;
  let maxIntake = 0;

  dayMap.forEach((val) => {
    totalLitres += val;
    if (val > 0) daysTracked++;
    if (val >= goal) daysGoalMet++;
    if (val > maxIntake) maxIntake = val;
  });

  const dailyAverage = daysTracked > 0 ? Math.round(totalLitres / daysTracked) : 0;
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Get cell color based on logged ml
  const getCellColor = (ml: number) => {
    if (ml === 0) return isDark ? '#1C1C1C' : '#EFEFEA';
    if (ml < goal / 3) return '#3B82F625'; // Light tint
    if (ml < goal) return '#3B82F660'; // Mid tint
    return '#3B82F6'; // Full goal blue
  };

  const getCellTextColor = (ml: number) => {
    if (ml >= goal) return '#FFFFFF';
    return colors.text;
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
          <View style={{ width: 40 }} />
        </View>

        {/* Tab Selector */}
        <WaterTabs activeTab="monthly" />

        {loading && dayMap.size === 0 ? (
          <AppLoader />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Month Navigation Control */}
            <View style={styles.navRow}>
              <TouchableOpacity onPress={handlePrevMonth} style={[styles.navBtn, { borderColor: colors.border }]}>
                <Feather name="chevron-left" size={16} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>
                {monthName} {currentYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={[styles.navBtn, { borderColor: colors.border }]}>
                <Feather name="chevron-right" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Calendar Card */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <View style={[styles.calendarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                {/* Day labels */}
                <View style={styles.daysHeader}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <Text key={idx} style={[styles.dayLabel, { color: colors.textSecondary }]}>
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Grid cells */}
                <View style={styles.gridContainer}>
                  {cells.map((cell, index) => {
                    if (cell.type === 'empty') {
                      return <View key={`empty-${index}`} style={styles.cellSpacer} />;
                    }

                    const dayNum = cell.dayNum!;
                    const mlDrank = dayMap.get(dayNum) || 0;
                    const cellColor = getCellColor(mlDrank);
                    const textColor = getCellTextColor(mlDrank);

                    return (
                      <View
                        key={`day-${dayNum}`}
                        style={[styles.cell, { backgroundColor: cellColor }]}
                      >
                        <Text style={[styles.cellText, { color: textColor }]}>
                          {dayNum}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Animated.View>

            {/* Heatmap Legend */}
            <View style={styles.legendRow}>
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Less</Text>
              <View style={[styles.legendDot, { backgroundColor: isDark ? '#1C1C1C' : '#EFEFEA' }]} />
              <View style={[styles.legendDot, { backgroundColor: '#3B82F625' }]} />
              <View style={[styles.legendDot, { backgroundColor: '#3B82F660' }]} />
              <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>More (Goal)</Text>
            </View>

            {/* Month Stats Summary */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MONTH SUMMARY</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <Feather name="droplet" size={16} color="#3B82F6" />
                  <Text style={[styles.statVal, { color: colors.text }]}>{(totalLitres / 1000).toFixed(1)}L</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Drank</Text>
                </View>

                <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <Feather name="calendar" size={16} color={colors.primary} />
                  <Text style={[styles.statVal, { color: colors.text }]}>{daysTracked} days</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Days Logged</Text>
                </View>

                <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <Feather name="award" size={16} color="#10B981" />
                  <Text style={[styles.statVal, { color: colors.text }]}>{daysGoalMet} days</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Target Hit</Text>
                </View>

                <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <Feather name="trending-up" size={16} color="#F59E0B" />
                  <Text style={[styles.statVal, { color: colors.text }]}>{(dailyAverage / 1000).toFixed(1)}L</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Daily Avg</Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
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
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
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
});
