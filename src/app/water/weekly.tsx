import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import AppLoader from '@/components/AppLoader';
import * as WaterStorage from '@/utils/WaterStorage';
import { WaterTabs } from './index';

interface WeeklyDayData {
  date: Date;
  totalMl: number;
  logsCount: number;
}

// ── Animated Bar Component ───────────────────────────────────────────────────
function AnimatedBar({
  dayName,
  totalMl,
  goal,
  colors,
}: {
  dayName: string;
  totalMl: number;
  goal: number;
  colors: any;
}) {
  const heightPercent = Math.min(totalMl / goal, 1.2); // Cap height visually at 120%
  const heightVal = useSharedValue(0);

  useEffect(() => {
    heightVal.value = withTiming(heightPercent * 130, { duration: 1000 });
  }, [totalMl]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightVal.value,
  }));

  // Coloring based on achievement
  const getBarColor = () => {
    if (totalMl >= goal) return '#10B981'; // Success Green
    if (totalMl > 0) return colors.primary; // Partial Amber
    return colors.border; // Empty Gray
  };

  return (
    <View style={styles.barCol}>
      <Text style={[styles.barValText, { color: colors.textSecondary }]}>
        {totalMl > 0 ? `${(totalMl / 1000).toFixed(1)}L` : '0'}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: colors.backgroundSelected }]}>
        <Animated.View
          style={[
            styles.barFill,
            animatedStyle,
            { backgroundColor: getBarColor() },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: colors.text }]}>{dayName}</Text>
    </View>
  );
}

// ── Main Weekly Water Screen ──────────────────────────────────────────────────
export default function WeeklyWaterScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyDayData[]>([]);
  const goal = WaterStorage.DEFAULT_DAILY_GOAL;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await WaterStorage.getWeeklyData();
      setWeeklyData(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve weekly progress data.');
    } finally {
      setLoading(false);
    }
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculations
  const totalVolume = weeklyData.reduce((sum, d) => sum + d.totalMl, 0);
  const averageVolume = Math.round(totalVolume / 7);
  const daysGoalMet = weeklyData.filter((d) => d.totalMl >= goal).length;
  const bestDay = weeklyData.reduce((best, curr) => (curr.totalMl > best.totalMl ? curr : best), { totalMl: 0 } as WeeklyDayData);

  const getBestDayName = () => {
    if (!bestDay.date || bestDay.totalMl === 0) return '—';
    const dayIndex = bestDay.date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return weekdays[adjustedIndex];
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
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ width: 40 }} />
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Tab Selector */}
        <WaterTabs activeTab="weekly" />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Weekly Bar Chart Card */}
          <Animated.View entering={FadeInDown.duration(400)}>
              <View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <View style={styles.chartHeader}>
                  <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>WEEKLY HISTORY</Text>
                  <Text style={[styles.chartSubtitle, { color: colors.text }]}>Mon — Sun</Text>
                </View>

                {/* Bars Container */}
                <View style={styles.barsContainer}>
                  {weeklyData.map((d, index) => (
                    <AnimatedBar
                      key={index}
                      dayName={weekdays[index]}
                      totalMl={d.totalMl}
                      goal={goal}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Statistics Grid */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsGrid}>
              <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Feather name="activity" size={16} color={colors.primary} />
                <Text style={[styles.statVal, { color: colors.text }]}>{(totalVolume / 1000).toFixed(1)}L</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Volume</Text>
              </View>

              <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Feather name="droplet" size={16} color="#3B82F6" />
                <Text style={[styles.statVal, { color: colors.text }]}>{averageVolume}ml</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Daily Average</Text>
              </View>

              <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Feather name="award" size={16} color="#10B981" />
                <Text style={[styles.statVal, { color: colors.text }]}>{daysGoalMet}/7</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Days Goal Met</Text>
              </View>

              <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Feather name="star" size={16} color="#F59E0B" />
                <Text style={[styles.statVal, { color: colors.text }]}>{getBestDayName()}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best Hydrated</Text>
              </View>
            </Animated.View>

            {/* Day breakdown list */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DAILY TOTALS</Text>
              <View style={[styles.breakdownCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                {weeklyData.map((d, index) => {
                  const dayName = d.date.toLocaleDateString([], { weekday: 'long' });
                  const dateStr = d.date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  return (
                    <View
                      key={index}
                      style={[
                        styles.breakdownRow,
                        {
                          borderBottomWidth: index < 6 ? StyleSheet.hairlineWidth : 0,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View>
                        <Text style={[styles.breakdownDay, { color: colors.text }]}>{dayName}</Text>
                        <Text style={[styles.breakdownDate, { color: colors.textSecondary }]}>{dateStr}</Text>
                      </View>
                      <View style={styles.breakdownRight}>
                        <Text style={[styles.breakdownVol, { color: colors.text }]}>
                          {d.totalMl} <Text style={styles.breakdownVolUnit}>ml</Text>
                        </Text>
                        {d.totalMl >= goal ? (
                          <View style={[styles.achievementBadge, { backgroundColor: '#10B98115' }]}>
                            <Feather name="check" size={10} color="#10B981" />
                          </View>
                        ) : d.totalMl > 0 ? (
                          <View style={[styles.achievementBadge, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.primary }}>•</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </ScrollView>
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
    fontWeight: '700',
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
    fontWeight: '700',
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
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  breakdownCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  breakdownDay: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownDate: {
    fontSize: 11,
    marginTop: 1,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownVol: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownVolUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  achievementBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
