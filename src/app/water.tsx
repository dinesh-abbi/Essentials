import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as WaterStorage from '@/utils/WaterStorage';

const TRACKING_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // 8:00 to 22:00

export default function WaterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const [hourlyMap, setHourlyMap] = useState<Record<number, boolean>>({});
  const [recentLogs, setRecentLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyDaysTracked, setMonthlyDaysTracked] = useState(0);

  // Load water data
  useEffect(() => {
    loadWaterData();
  }, []);

  async function loadWaterData() {
    try {
      const [total, status, mTotal, mDays, todayLogs] = await Promise.all([
        WaterStorage.getTodayTotalMl(),
        WaterStorage.getTodayHourlyStatus(),
        WaterStorage.getMonthlyTotalMl(),
        WaterStorage.getMonthlyDaysTracked(),
        WaterStorage.getTodayWaterLogs(),
      ]);

      setTodayTotal(total);
      setHourlyMap(status);
      setMonthlyTotal(mTotal);
      setMonthlyDaysTracked(mDays);
      // Sort newest first
      setRecentLogs(todayLogs.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      Alert.alert('Error', 'Failed to load hydration logs.');
    } finally {
      setLoading(false);
    }
  }

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWaterData();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleLogWater = async (amountMl: number) => {
    setLoading(true);
    try {
      await WaterStorage.logWaterIntake(amountMl);
      await loadWaterData();
    } catch (e) {
      Alert.alert('Error', 'Failed to log water intake.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    setLoading(true);
    try {
      await WaterStorage.deleteWaterLog(id);
      await loadWaterData();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete log.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    Alert.alert("Reset Today's Water", 'Are you sure you want to clear your hydration records for today?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await WaterStorage.clearWaterLogs();
            await loadWaterData();
          } catch (e) {
            Alert.alert('Error', 'Failed to reset water data.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const percentGoal = Math.min(Math.round((todayTotal / WaterStorage.DEFAULT_DAILY_GOAL) * 100), 100);
  const formattedHour = (h: number) => {
    return h.toString().padStart(2, '0') + ':00';
  };

  // Date formatting helpers
  const now = new Date();
  const todayDateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });
  const monthStr = now.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const dayOfMonth = now.getDate();
  const dailyAverage = monthlyDaysTracked > 0
    ? Math.round(monthlyTotal / monthlyDaysTracked)
    : 0;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.innerContainer, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.two }]}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[
              styles.roundBtn,
              { borderColor: theme.border, backgroundColor: 'transparent' },
            ]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </AnimatedPressable>
          <ThemedText type="smallBold" style={styles.headerTitle} themeColor="textSecondary">
            HYDRATION
          </ThemedText>
          {recentLogs.length > 0 ? (
            <AnimatedPressable
              onPress={handleReset}
              style={[
                styles.resetBtn,
                { borderColor: theme.alert, backgroundColor: 'transparent' },
              ]}
            >
              <ThemedText type="code" style={{ color: theme.alert, fontSize: 10, fontWeight: '700' }}>
                RESET
              </ThemedText>
            </AnimatedPressable>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38BDF8"
              colors={['#38BDF8']}
            />
          }
        >

          {/* Today's Date Label */}
          <View style={[styles.dateLabel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Feather name="calendar" size={12} color={theme.textSecondary} />
            <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11, fontWeight: '700' }}>
              {todayDateStr.toUpperCase()}
            </ThemedText>
          </View>

          {/* Daily Goal Visual Metric */}
          <View style={[styles.statusCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.statusHeader}>
              <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11, fontWeight: '700' }}>
                DAILY TARGET: {WaterStorage.DEFAULT_DAILY_GOAL}ml
              </ThemedText>
              <ThemedText type="code" style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>
                {percentGoal}% COMPLETE
              </ThemedText>
            </View>

            <View style={styles.metricsRow}>
              <ThemedText type="title" style={[styles.bigMetric, { color: '#38BDF8' }]}>
                {todayTotal}
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 14, fontWeight: '600' }}>
                / {WaterStorage.DEFAULT_DAILY_GOAL} ml
              </ThemedText>
            </View>

            {/* Simple progress bar */}
            <View style={[styles.progressBarOuter, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.progressBarInner, { width: `${percentGoal}%`, backgroundColor: '#38BDF8' }]} />
            </View>
          </View>

          {/* Monthly Intake Summary (Enhanced) */}
          <View style={[styles.statusCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.statusHeader}>
              <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11, fontWeight: '700' }}>
                {monthStr.toUpperCase()}
              </ThemedText>
              <Feather name="trending-up" size={14} color="#38BDF8" />
            </View>

            <View style={styles.monthlyStatsGrid}>
              <View style={styles.monthlyStatItem}>
                <ThemedText type="title" style={[styles.monthlyStatValue, { color: '#38BDF8' }]}>
                  {(monthlyTotal / 1000).toFixed(1)}
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 10, fontWeight: '600' }}>
                  LITERS TOTAL
                </ThemedText>
              </View>

              <View style={[styles.monthlyStatDivider, { backgroundColor: theme.border }]} />

              <View style={styles.monthlyStatItem}>
                <ThemedText type="title" style={[styles.monthlyStatValue, { color: theme.text }]}>
                  {dailyAverage}
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 10, fontWeight: '600' }}>
                  ML / DAY AVG
                </ThemedText>
              </View>

              <View style={[styles.monthlyStatDivider, { backgroundColor: theme.border }]} />

              <View style={styles.monthlyStatItem}>
                <ThemedText type="title" style={[styles.monthlyStatValue, { color: theme.text }]}>
                  {monthlyDaysTracked}
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 10, fontWeight: '600' }}>
                  DAYS TRACKED
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Quick Logging Buttons */}
          <View style={styles.quickAddBlock}>
            <ThemedText type="smallBold" style={styles.sectionTitle} themeColor="textSecondary">
              QUICK ENTRY
            </ThemedText>
            <View style={styles.buttonRow}>
              {[
                { label: '+250ml', value: 250, desc: 'Cup' },
                { label: '+500ml', value: 500, desc: 'Bottle' },
                { label: '+1000ml', value: 1000, desc: 'Flask' },
              ].map((btn) => (
                <AnimatedPressable
                  key={btn.value}
                  onPress={() => handleLogWater(btn.value)}
                  disabled={loading}
                  style={[
                    styles.logBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                >
                  <ThemedText type="smallBold" style={{ color: '#38BDF8', fontFamily: Fonts.mono }}>
                    {btn.label}
                  </ThemedText>
                  <ThemedText type="code" style={{ color: theme.textSecondary, fontSize: 10 }}>
                    {btn.desc}
                  </ThemedText>
                </AnimatedPressable>
              ))}
            </View>
          </View>

          {/* Hourly Visual Tracker Grid */}
          <View style={styles.gridSection}>
            <ThemedText type="smallBold" style={styles.sectionTitle} themeColor="textSecondary">
              HOURLY TIMELINE (8 AM - 10 PM)
            </ThemedText>

            <View style={styles.hourGrid}>
              {TRACKING_HOURS.map((hour) => {
                const isLogged = hourlyMap[hour];
                return (
                  <View
                    key={hour}
                    style={[
                      styles.hourCell,
                      {
                        borderColor: isLogged ? '#38BDF8' : theme.border,
                        backgroundColor: isLogged ? 'rgba(56, 189, 248, 0.1)' : theme.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700', color: isLogged ? '#38BDF8' : theme.textSecondary }}>
                      {formattedHour(hour)}
                    </ThemedText>
                    <Feather
                      name={isLogged ? 'check' : 'minus'}
                      size={12}
                      color={isLogged ? '#38BDF8' : theme.textSecondary}
                      style={{ marginTop: Spacing.half }}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* Today's Log History */}
          <View style={styles.historySection}>
            <ThemedText type="smallBold" style={styles.sectionTitle} themeColor="textSecondary">
              TODAY'S LOG HISTORY
            </ThemedText>

            {loading && recentLogs.length === 0 ? (
              <ActivityIndicator size="small" color="#38BDF8" style={{ margin: Spacing.four }} />
            ) : recentLogs.length === 0 ? (
              <ThemedText type="code" style={styles.emptyText} themeColor="textSecondary">
                No logs recorded for today
              </ThemedText>
            ) : (
              recentLogs.map((log) => {
                const logTime = new Date(log.timestamp).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Kolkata',
                });
                return (
                  <View key={log.id} style={[styles.historyRow, { borderColor: theme.border }]}>
                    <View style={styles.historyInfo}>
                      <View style={styles.historyDot} />
                      <ThemedText type="smallBold">{log.amountMl} ml</ThemedText>
                      <ThemedText type="code" style={{ fontSize: 10 }} themeColor="textSecondary">
                        at {logTime}
                      </ThemedText>
                    </View>
                    <AnimatedPressable
                      onPress={() => handleDeleteLog(log.id)}
                      style={styles.deleteBtn}
                    >
                      <Feather name="x" size={16} color={theme.alert} />
                    </AnimatedPressable>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  innerContainer: {
    flex: 1,
    maxWidth: 500,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
  resetBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  scrollContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  dateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignSelf: 'flex-start',
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  bigMetric: {
    fontSize: 36,
    fontWeight: '800',
  },
  progressBarOuter: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  monthlyStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  monthlyStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  monthlyStatValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  monthlyStatDivider: {
    width: 1,
    height: 32,
    marginHorizontal: Spacing.two,
  },
  quickAddBlock: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  logBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  gridSection: {
    gap: Spacing.two,
  },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  hourCell: {
    width: '18%', // Renders roughly 5 items per row with gap
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  historySection: {
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: Spacing.three,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing.three,
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
