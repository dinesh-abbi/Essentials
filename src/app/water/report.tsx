import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import * as WidgetSync from '@/utils/WidgetSync';
import * as WaterStorage from '@/utils/WaterStorage';

export default function WaterDailyReportScreen() {
  const router = useRouter();
  const { dateMs } = useLocalSearchParams<{ dateMs: string }>();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const targetDate = dateMs ? new Date(parseInt(dateMs)) : new Date();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [goal, setGoal] = useState(2000);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchDayData = async () => {
    setLoading(true);
    try {
      const allLogs = await WaterStorage.getWaterLogs();
      const userGoal = await WaterStorage.getUserWaterGoal();
      setGoal(userGoal);

      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const filtered = allLogs.filter(
        (l) => l.timestamp >= dayStart.getTime() && l.timestamp <= dayEnd.getTime()
      );
      setLogs(filtered.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.warn('Failed to load water report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayData();
  }, [dateMs]);

  const handleDeleteLog = async (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to remove this water log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(id);
          try {
            await WaterStorage.deleteWaterLog(id);
            setLogs((prev) => prev.filter((l) => l.id !== id));
            WidgetSync.sync();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete entry.');
          } finally {
            setIsDeleting(null);
          }
        },
      },
    ]);
  };

  const totalDrank = logs.reduce((sum, l) => sum + l.amountMl, 0);
  const percentMet = Math.min((totalDrank / goal) * 100, 100);

  const progressWidth = useSharedValue(0);
  useEffect(() => {
    if (!loading) {
      progressWidth.value = withTiming(percentMet, { duration: 1000 });
    }
  }, [percentMet, loading]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const formattedDate = targetDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
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
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.headerTitle}>
            DAILY WATER REPORT
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={
              <View style={{ gap: Spacing.four, marginBottom: Spacing.two }}>
                {/* Selected Day Name */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.titleCard}>
                  <Text style={[styles.dateLabel, { color: colors.text }]}>{formattedDate}</Text>
                  <Text style={[styles.subtitleLabel, { color: colors.textSecondary }]}>
                    Consumption details and log history.
                  </Text>
                </Animated.View>

                {/* Progress Summary Card */}
                <Animated.View
                  entering={FadeInDown.duration(500).delay(100)}
                  style={[styles.summaryCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                >
                  <View style={styles.summaryRow}>
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 }}>
                        TOTAL CONSUMED
                      </Text>
                      <Text style={[styles.totalVolume, { color: colors.primary }]}>
                        {totalDrank} <Text style={{ fontSize: 16, fontWeight: '700' }}>ml</Text>
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 }}>
                        DAILY GOAL
                      </Text>
                      <Text style={[styles.goalVolume, { color: colors.text }]}>
                        {goal} <Text style={{ fontSize: 14, fontWeight: '700' }}>ml</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBarWrapper}>
                    <View style={styles.progressHeader}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                        Goal Met
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '800' }}>
                        {percentMet.toFixed(0)}%
                      </Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: '#E2E8F015' }]}>
                      <Animated.View style={[styles.progressBarFill, progressStyle, { backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                </Animated.View>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  LOG HISTORY ({logs.length} Entries)
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const itemDate = new Date(item.timestamp);
              const timeStr = itemDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              });

              return (
                <View style={[styles.itemRow, { borderColor: colors.border }]}>
                  <View style={styles.itemLeft}>
                    <View style={[styles.cupIconWrapper, { backgroundColor: colors.primary + '12' }]}>
                      <Feather name="droplet" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.itemMlText, { color: colors.text }]}>
                        {item.amountMl} ml
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                        Logged at {timeStr}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteLog(item.id)}
                    disabled={isDeleting === item.id}
                    style={styles.deleteBtn}
                  >
                    {isDeleting === item.id ? (
                      <ActivityIndicator size="small" color={colors.alert} />
                    ) : (
                      <Feather name="trash-2" size={16} color={colors.alert} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="info" size={24} color={colors.textSecondary} style={{ marginBottom: Spacing.one, opacity: 0.6 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  No hydration entries found for this day.
                </Text>
              </View>
            }
          />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleCard: {
    marginTop: 10,
    gap: 4,
  },
  dateLabel: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalVolume: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 4,
  },
  goalVolume: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  progressBarWrapper: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cupIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMlText: {
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
