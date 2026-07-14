import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
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
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import AppLoader from '@/components/AppLoader';
import * as WaterStorage from '@/utils/WaterStorage';
import { triggerWaterGoalNotification } from '@/utils/notifications';

// ── Water Wave Animation Component ──────────────────────────────────────────
function WaterWave({ percent, colors }: { percent: number; colors: any }) {
  const animatedPercent = useSharedValue(0);

  const rotation1 = useSharedValue(0);
  const rotation2 = useSharedValue(0);

  // Bubble animation values
  const bubbleY1 = useSharedValue(0);
  const bubbleY2 = useSharedValue(0);
  const bubbleY3 = useSharedValue(0);

  useEffect(() => {
    // Wave rotation loop
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

    // Floating bubbles
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
  }, []);

  // Update animated percentage when prop changes
  useEffect(() => {
    animatedPercent.value = withTiming(Math.min(percent, 1), {
      duration: 1000,
      easing: Easing.out(Easing.quad),
    });
  }, [percent]);

  // TranslateY: 320 is empty, 110 is full
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
          { backgroundColor: '#3B82F690', borderRadius: 130 },
        ]}
      />
      <Animated.View
        style={[
          styles.waveLayer,
          waveStyle2,
          { backgroundColor: '#60A5FAe0', borderRadius: 125 },
        ]}
      />

      {/* Floating Bubbles inside liquid */}
      <Animated.View style={[styles.bubble, { left: 45, bottom: 20 }, bubbleStyle1]} />
      <Animated.View style={[styles.bubble, { left: 110, bottom: 10, width: 6, height: 6 }, bubbleStyle2]} />
      <Animated.View style={[styles.bubble, { left: 155, bottom: 30, width: 7, height: 7 }, bubbleStyle3]} />

      {/* Center Percentage Display */}
      <View style={styles.waveOverlayText}>
        <Text style={[styles.percentNum, { color: '#FFF' }]}>
          {Math.round(percent * 100)}%
        </Text>
        <Text style={[styles.percentLabel, { color: '#FFFFFFA0' }]}>DRANK</Text>
      </View>
    </View>
  );
}

// ── Water Navigation Tabs ────────────────────────────────────────────────────
export function WaterTabs({ activeTab }: { activeTab: 'daily' | 'weekly' | 'monthly' }) {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.tabsWrapper, { backgroundColor: colors.backgroundSelected }]}>
      <TouchableOpacity
        onPress={() => router.replace('/water')}
        style={[styles.tabBtn, activeTab === 'daily' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'daily' ? colors.text : colors.textSecondary }]}>Daily</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.replace('/water/weekly')}
        style={[styles.tabBtn, activeTab === 'weekly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'weekly' ? colors.text : colors.textSecondary }]}>Weekly</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.replace('/water/monthly')}
        style={[styles.tabBtn, activeTab === 'monthly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'monthly' ? colors.text : colors.textSecondary }]}>Monthly</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Daily Water Screen ──────────────────────────────────────────────────
export default function DailyWaterScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [loading, setLoading] = useState(true);
  const [totalDrank, setTotalDrank] = useState(0);
  const [goal, setGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [todayLogs, setTodayLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [hourlyStatus, setHourlyStatus] = useState<Record<number, boolean>>({});
  const [isMutating, setIsMutating] = useState<number | boolean>(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  async function refreshData() {
    setLoading(true);
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
      Alert.alert('Error', 'Failed to retrieve hydration logs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveGoal(newGoal: number) {
    if (isNaN(newGoal) || newGoal <= 0) {
      Alert.alert('Invalid Goal', 'Please enter a valid water volume in ml.');
      return;
    }
    try {
      await WaterStorage.setUserWaterGoal(newGoal);
      setGoal(newGoal);
      setIsGoalModalOpen(false);
      setCustomGoalInput('');
    } catch (e) {
      Alert.alert('Error', 'Failed to update hydration target.');
    }
  }

  async function handleAddWater(ml: number) {
    setIsMutating(ml);
    try {
      const prevTotal = totalDrank; // snapshot before adding
      await WaterStorage.logWaterIntake(ml);
      await refreshData();

      // Fire the celebration notification the first time we cross 3000ml today.
      // Re-read the fresh total from storage to avoid stale state closure.
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
  }

  async function handleDeleteLog(id: string) {
    Alert.alert('Remove Log', 'Do you want to delete this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsMutating(true);
          try {
            await WaterStorage.deleteWaterLog(id);
            await refreshData();
          } catch (e) {
            Alert.alert('Error', 'Could not delete entry.');
          } finally {
            setIsMutating(false);
          }
        },
      },
    ]);
  }

  const hydrationPercent = Math.min(totalDrank / goal, 2); // Cap at 200% for display safety

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
        <WaterTabs activeTab="daily" />

        {loading ? (
          <View style={styles.scrollContent}>
            <View style={styles.heroSection}>
              {/* Circular Wave Skeleton */}
              <View style={[styles.waveContainer, { borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                <Skeleton width={120} height={120} borderRadius={60} />
              </View>

              {/* Progress Stats Skeleton */}
              <View style={[styles.statsBlock, { gap: 8 }]}>
                <Skeleton width={110} height={36} />
                <Skeleton width={140} height={14} />
              </View>

              {/* Quick Add Buttons Skeleton */}
              <View style={styles.quickAddRow}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={[styles.quickBtn, { borderColor: colors.border, paddingVertical: 14 }]}>
                    <Skeleton width={50} height={14} style={{ marginBottom: 4 }} />
                    <Skeleton width={30} height={10} />
                  </View>
                ))}
              </View>

              {/* Hourly Timeline Skeleton */}
              <View style={[styles.timelineCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Skeleton width={180} height={12} style={{ marginBottom: 15 }} />
                <View style={styles.timelineDotsRow}>
                  {Array.from({ length: 17 }).map((_, i) => (
                    <View key={i} style={styles.dotColumn}>
                      <Skeleton width={6} height={16} borderRadius={3} />
                      <Skeleton width={12} height={8} style={{ marginTop: 4 }} />
                    </View>
                  ))}
                </View>
              </View>

              {/* History Header Skeleton */}
              <Skeleton width={120} height={12} style={{ alignSelf: 'flex-start', marginTop: 32, marginBottom: 12 }} />
            </View>

            {/* List Items Skeleton */}
            <View style={{ gap: 12, width: '100%' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={[styles.logCard, { borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <View style={{ gap: 4 }}>
                      <Skeleton width={60} height={14} />
                      <Skeleton width={40} height={10} />
                    </View>
                  </View>
                  <Skeleton width={14} height={14} borderRadius={7} />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={todayLogs}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={
              <View style={styles.heroSection}>
                {/* Wave Animation */}
                <WaterWave percent={hydrationPercent} colors={colors} />

                {/* Progress Stats */}
                <View style={styles.statsBlock}>
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
                </View>

                {/* Quick Add Buttons */}
                <View style={styles.quickAddRow}>
                  {[250, 500, 1000].map((ml) => {
                    const currentlyMutating = isMutating === ml;
                    return (
                      <AnimatedPressable
                        key={ml}
                        onPress={() => handleAddWater(ml)}
                        disabled={isMutating !== false}
                        style={[
                          styles.quickBtn,
                          {
                            borderColor: colors.border,
                            opacity: isMutating !== false && !currentlyMutating ? 0.5 : 1,
                          },
                        ]}
                      >
                        {currentlyMutating ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Feather name="droplet" size={14} color={colors.primary} />
                            <Text style={[styles.quickBtnText, { color: colors.text }]}>+{ml}ml</Text>
                          </>
                        )}
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Hourly Timeline */}
                <View style={[styles.timelineCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                  <Text style={[styles.timelineTitle, { color: colors.textSecondary }]}>HOURLY TRACKING (6 AM - 10 PM)</Text>
                  <View style={styles.timelineDotsRow}>
                    {Object.entries(hourlyStatus)
                      .map(([hour, drank]) => ({ hour: parseInt(hour), drank }))
                      .sort((a, b) => a.hour - b.hour)
                      .map(({ hour, drank }) => (
                        <View key={hour} style={styles.dotColumn}>
                          <View
                            style={[
                              styles.timelineDot,
                              {
                                backgroundColor: drank
                                  ? '#3B82F6'
                                  : colors.backgroundSelected,
                                borderColor: drank ? '#60A5FA' : colors.border,
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

                {/* History Header */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TODAY'S LOG HISTORY</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Animated.View
                entering={FadeInDown.duration(350)}
                style={[styles.logCard, { borderColor: colors.border }]}
              >
                <View style={styles.logLeft}>
                  <View style={[styles.logIcon, { backgroundColor: '#3B82F618' }]}>
                    <Feather name="droplet" size={14} color="#3B82F6" />
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
              !loading ? (
                <View style={styles.emptyLogs}>
                  <Feather name="coffee" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyLogsText, { color: colors.textSecondary }]}>No water logged yet today.</Text>
                </View>
              ) : null
            }
          />
        )}
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

              {/* Goal Presets */}
              <View style={styles.presetRow}>
                {[2000, 3000, 4000, 5000].map((presetMl) => (
                  <TouchableOpacity
                    key={presetMl}
                    onPress={() => {
                      handleSaveGoal(presetMl);
                    }}
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
    backgroundColor: '#1E293B', // Slate background for inside circle
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
    marginTop: 32,
    marginBottom: 12,
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
});
