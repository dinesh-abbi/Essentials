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

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

// ── Category Progress Bar Component ───────────────────────────────────────────
function CategoryBar({
  category,
  amount,
  percentage,
  color,
  textColor,
}: {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  textColor: string;
}) {
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(percentage, { duration: 1000 });
  }, [percentage]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <View style={styles.catRow}>
      <View style={styles.catInfo}>
        <ThemedText type="smallBold" style={styles.catName as TextStyle}>
          {category}
        </ThemedText>
        <Text style={[styles.catAmount, { color: textColor }]}>
          ₹{amount.toFixed(2)} ({Math.round(percentage)}%)
        </Text>
      </View>
      <View style={[styles.progressBarTrack, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            { backgroundColor: color },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

// ── Main Monthly Purchases Screen ─────────────────────────────────────────────
export default function MonthlyPurchasesScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [avgTransaction, setAvgTransaction] = useState(0);

  useEffect(() => {
    loadMonthlyPurchases();
  }, []);

  async function loadMonthlyPurchases() {
    try {
      const logs = await PurchasesStorage.getPurchases();

      // Filter current month logs
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const monthlyLogs = logs.filter((log) => log.timestamp >= startOfMonth);
      const total = monthlyLogs.reduce((acc, curr) => acc + curr.cost, 0);

      setTotalSpent(total);
      setTotalTransactions(monthlyLogs.length);
      setAvgTransaction(monthlyLogs.length > 0 ? total / monthlyLogs.length : 0);

      // Compute category breakdown
      const cats = [
        { name: 'Groceries', color: '#4F46E5' },
        { name: 'Dairy', color: '#6366F1' },
        { name: 'Veggies', color: '#818CF8' },
        { name: 'Snacks', color: '#A5B4FC' },
        { name: 'Transport', color: '#C7D2FE' },
        { name: 'Bills', color: '#312E81' },
        { name: 'Health', color: '#3730A3' },
        { name: 'Food', color: '#4338CA' },
        { name: 'Shopping', color: '#E0E7FF' },
        { name: 'Misc', color: '#6B7280' },
      ];

      const breakdown: CategoryBreakdown[] = cats.map((c) => {
        const catLogs = monthlyLogs.filter((log) => log.category === c.name);
        const amount = catLogs.reduce((acc, curr) => acc + curr.cost, 0);
        return {
          category: c.name,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: c.color,
        };
      });

      setCategories(breakdown);

    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve monthly purchases.');
    } finally {
      setLoading(false);
    }
  }

  const currentMonthName = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

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
        <PurchasesTabs activeTab="monthly" />

        {loading ? (
          <View style={styles.scrollContent as ViewStyle}>
            {/* Summary Card Skeleton */}
            <View style={[styles.summaryCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 12 }]}>
              <View style={[styles.summaryHeader, { justifyContent: 'space-between' }]}>
                <Skeleton width={140} height={10} />
                <Skeleton width={14} height={14} borderRadius={7} />
              </View>
              <View style={[styles.totalRow, { gap: 6, marginTop: 4 }]}>
                <Skeleton width={150} height={32} />
                <Skeleton width={100} height={10} />
              </View>
            </View>

            {/* Category Breakdown Card Skeleton */}
            <View style={[styles.breakdownCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 15 }]}>
              <Skeleton width={160} height={10} style={{ marginBottom: 4 }} />
              <View style={{ gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <View key={i} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton width={80} height={10} />
                      <Skeleton width={60} height={10} />
                    </View>
                    <Skeleton width="100%" height={8} borderRadius={4} />
                  </View>
                ))}
              </View>
            </View>

            {/* Stats Info Grid Skeleton */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 8 }]}>
                <Skeleton width={90} height={10} />
                <Skeleton width={60} height={20} />
              </View>
              <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 8 }]}>
                <Skeleton width={100} height={10} />
                <Skeleton width={90} height={20} />
              </View>
            </View>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent as ViewStyle}
          >
            {/* Summary Card */}
            <Animated.View
              entering={FadeInDown.duration(500).springify()}
              style={[
                styles.summaryCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}
            >
              <View style={styles.summaryHeader}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.summaryTitle as TextStyle}>
                  {currentMonthName.toUpperCase()} SUMMARY
                </ThemedText>
                <Feather name="pie-chart" size={14} color={colors.primary} />
              </View>

              <View style={styles.totalRow}>
                <Text style={[styles.totalSpentText, { color: colors.primary }]}>
                  ₹{totalSpent.toFixed(2)}
                </Text>
                <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11, fontWeight: '700' } as TextStyle}>
                  SPENT IN TOTAL
                </ThemedText>
              </View>
            </Animated.View>

            {/* Category Breakdown Card */}
            <View
              style={[
                styles.breakdownCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}
            >
              <ThemedText type="code" themeColor="textSecondary" style={styles.cardSectionTitle as TextStyle}>
                CATEGORY ALLOCATION
              </ThemedText>

              <View style={styles.categoriesList}>
                {categories.map((cat, idx) => (
                  <CategoryBar
                    key={idx}
                    category={cat.category}
                    amount={cat.amount}
                    percentage={cat.percentage}
                    color={cat.color}
                    textColor={colors.textSecondary}
                  />
                ))}
              </View>
            </View>

            {/* Stats Info Grid */}
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statBox,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                ]}
              >
                <ThemedText type="code" themeColor="textSecondary" style={styles.statLabel as TextStyle}>
                  TRANSACTIONS
                </ThemedText>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {totalTransactions}
                </Text>
              </View>

              <View
                style={[
                  styles.statBox,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                ]}
              >
                <ThemedText type="code" themeColor="textSecondary" style={styles.statLabel as TextStyle}>
                  AVG PER SPEND
                </ThemedText>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ₹{avgTransaction.toFixed(2)}
                </Text>
              </View>
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
  summaryCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    gap: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  totalSpentText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  breakdownCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  cardSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  categoriesList: {
    gap: 16,
  },
  catRow: {
    gap: 6,
  },
  catInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 12,
  },
  catAmount: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
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
});
