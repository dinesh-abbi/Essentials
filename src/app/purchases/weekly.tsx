import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';

import Skeleton from '@/components/SkeletonLoader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import { PurchasesTabs } from './index';

interface WeeklyDayData {
  date: Date;
  totalCost: number;
  itemsCount: number;
}

// ── Animated Bar Component ───────────────────────────────────────────────────
function AnimatedBar({
  dayName,
  totalCost,
  maxCost,
  colors,
}: {
  dayName: string;
  totalCost: number;
  maxCost: number;
  colors: any;
}) {
  const heightPercent = maxCost > 0 ? Math.min(totalCost / maxCost, 1) : 0;
  const heightVal = useSharedValue(0);

  useEffect(() => {
    heightVal.value = withTiming(heightPercent * 130, { duration: 1000 });
  }, [totalCost, maxCost]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightVal.value,
  }));

  return (
    <View style={styles.barColumn}>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: totalCost > 0 ? colors.primary : colors.border },
            animatedStyle,
          ]}
        />
      </View>
      <ThemedText type="code" themeColor="textSecondary" style={styles.barLabel as TextStyle}>
        {dayName}
      </ThemedText>
      <Text style={[styles.barAmount, { color: colors.textSecondary }]}>
        ₹{Math.round(totalCost)}
      </Text>
    </View>
  );
}

// ── Main Weekly Purchases Screen ──────────────────────────────────────────────
export default function WeeklyPurchasesScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyDayData[]>([]);
  const [highestDay, setHighestDay] = useState({ day: 'None', val: 0 });
  const [averageSpent, setAverageSpent] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    loadWeeklyPurchases();
  }, []);

  async function loadWeeklyPurchases() {
    try {
      const logs = await PurchasesStorage.getPurchases();
      
      // Calculate past 7 days
      const days: WeeklyDayData[] = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = d.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;

        const dayLogs = logs.filter(
          (log) => log.timestamp >= dayStart && log.timestamp < dayEnd
        );
        const totalCost = dayLogs.reduce((acc, curr) => acc + curr.cost, 0);

        days.push({
          date: d,
          totalCost,
          itemsCount: dayLogs.length,
        });
      }

      setWeeklyData(days);

      // Calculations
      const total = days.reduce((acc, curr) => acc + curr.totalCost, 0);
      setTotalSpent(total);
      setAverageSpent(total / 7);

      let maxVal = 0;
      let maxDayName = 'None';
      days.forEach((d) => {
        if (d.totalCost > maxVal) {
          maxVal = d.totalCost;
          maxDayName = d.date.toLocaleDateString('en-IN', { weekday: 'short' });
        }
      });
      setHighestDay({ day: maxDayName, val: maxVal });

    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve weekly purchases.');
    } finally {
      setLoading(false);
    }
  }

  const maxVal = Math.max(...weeklyData.map((d) => d.totalCost), 1);

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
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.headerTitle as TextStyle}>
            SPEND TRACKER
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab Selector */}
        <PurchasesTabs activeTab="weekly" />

        {loading ? (
          <View style={styles.scrollContent as ViewStyle}>
            {/* Chart Card Skeleton */}
            <View style={[styles.chartCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 16 }]}>
              <Skeleton width={160} height={10} />
              <View style={[styles.chartRow, { justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }]}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                    <Skeleton width={24} height={15 + i * 15} borderRadius={4} />
                    <Skeleton width={20} height={8} />
                  </View>
                ))}
              </View>
            </View>

            {/* Stats Info Grid Skeleton */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 8 }]}>
                <Skeleton width={70} height={10} />
                <Skeleton width={100} height={20} />
              </View>
              <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 8 }]}>
                <Skeleton width={80} height={10} />
                <Skeleton width={100} height={20} />
              </View>
            </View>

            {/* Highest Day Banner Skeleton */}
            <View style={[styles.insightCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 12, flexDirection: 'row', alignItems: 'center' }]}>
              <Skeleton width={16} height={16} borderRadius={8} />
              <Skeleton width="80%" height={12} />
            </View>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent as ViewStyle}
          >
            {/* Chart Card */}
            <Animated.View
              entering={FadeInDown.duration(500).springify()}
              style={[
                styles.chartCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}
            >
              <ThemedText type="code" themeColor="textSecondary" style={styles.chartTitle as TextStyle}>
                WEEKLY SPENDING PATTERN
              </ThemedText>

              <View style={styles.chartRow}>
                {weeklyData.map((day, idx) => {
                  const dayName = day.date.toLocaleDateString('en-IN', { weekday: 'short' });
                  return (
                    <AnimatedBar
                      key={idx}
                      dayName={dayName.toUpperCase()}
                      totalCost={day.totalCost}
                      maxCost={maxVal}
                      colors={colors}
                    />
                  );
                })}
              </View>
            </Animated.View>

            {/* Stats Info Grid */}
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statBox,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                ]}
              >
                <ThemedText type="code" themeColor="textSecondary" style={styles.statLabel as TextStyle}>
                  TOTAL SPENT
                </ThemedText>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  ₹{totalSpent.toFixed(2)}
                </Text>
              </View>

              <View
                style={[
                  styles.statBox,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                ]}
              >
                <ThemedText type="code" themeColor="textSecondary" style={styles.statLabel as TextStyle}>
                  DAILY AVERAGE
                </ThemedText>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ₹{averageSpent.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Highest Day Banner */}
            <View
              style={[
                styles.insightCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}
            >
              <Feather name="trending-up" size={16} color={colors.primary} />
              <Text style={[styles.insightText, { color: colors.text }]}>
                Highest spending day this week was{' '}
                <Text style={{ fontWeight: '700', color: colors.primary }}>{highestDay.day}</Text>{' '}
                (₹{highestDay.val.toFixed(2)}).
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  chartCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    width: '100%',
    height: 170,
  },
  barColumn: {
    alignItems: 'center',
    width: '12%',
  },
  barTrack: {
    height: 130,
    width: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 8,
  },
  barAmount: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
  },
  insightText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
