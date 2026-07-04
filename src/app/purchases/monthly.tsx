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
        { name: 'Groceries', color: '#60A5FA' }, // Blue
        { name: 'Dairy', color: '#FBBF24' },     // Amber
        { name: 'Veggies', color: '#34D399' },   // Emerald
        { name: 'Misc', color: '#F472B6' },      // Pink
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
