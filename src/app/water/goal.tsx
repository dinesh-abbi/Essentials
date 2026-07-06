import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSpring,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import * as WaterStorage from '@/utils/WaterStorage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Single floating droplet particle ────────────────────────────────────────
function WaterDroplet({
  x,
  delay,
  size,
  duration,
}: {
  x: number;
  delay: number;
  size: number;
  duration: number;
}) {
  const translateY = useSharedValue(SCREEN_HEIGHT * 0.6);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-SCREEN_HEIGHT * 0.1, { duration, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration * 0.15 }),
          withTiming(0.6, { duration: duration * 0.6 }),
          withTiming(0, { duration: duration * 0.25 })
        ),
        -1,
        false
      )
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration * 0.2 }),
          withTiming(0.7, { duration: duration * 0.8 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    bottom: 0,
    width: size,
    height: size * 1.3,
    borderRadius: size / 2,
    backgroundColor: '#60A5FA',
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={style} />;
}

// ── Rising wave layer ────────────────────────────────────────────────────────
function RisingWave({ delay, color }: { delay: number; color: string }) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const rotation = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT * 0.25, {
        duration: 2200,
        easing: Easing.out(Easing.cubic),
      })
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    bottom: 0,
    left: -SCREEN_WIDTH * 0.3,
    width: SCREEN_WIDTH * 1.6,
    height: SCREEN_WIDTH * 1.6,
    borderRadius: SCREEN_WIDTH * 0.8,
    backgroundColor: color,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return <Animated.View style={style} />;
}

// ── Trophy pulse animation ───────────────────────────────────────────────────
function TrophyIcon() {
  const scale = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      600,
      withSpring(1, { damping: 8, stiffness: 100 })
    );
    glow.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withTiming(0.4, { duration: 1200 })
        ),
        -1,
        true
      )
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.5,
    transform: [{ scale: 1 + glow.value * 0.15 }],
  }));

  return (
    <Animated.View style={[styles.trophyContainer, containerStyle]}>
      {/* Glow ring */}
      <Animated.View style={[styles.trophyGlow, glowStyle]} />
      <View style={styles.trophyInner}>
        <Text style={styles.trophyEmoji}>🏆</Text>
      </View>
    </Animated.View>
  );
}

// ── Main Goal Screen ─────────────────────────────────────────────────────────
export default function WaterGoalScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [totalDrank, setTotalDrank] = useState(0);
  const [goal, setGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [goalReachedTime, setGoalReachedTime] = useState<string>('');

  useEffect(() => {
    loadGoalData();
  }, []);

  async function loadGoalData() {
    try {
      const userGoal = await WaterStorage.getUserWaterGoal();
      setGoal(userGoal);
      const total = await WaterStorage.getTodayTotalMl();
      setTotalDrank(total);

      // Find the approximate time the goal was crossed by reading today's logs
      const logs = await WaterStorage.getTodayWaterLogs();
      const sorted = logs.sort((a, b) => a.timestamp - b.timestamp);
      let running = 0;
      for (const log of sorted) {
        running += log.amountMl;
        if (running >= userGoal) {
          setGoalReachedTime(
            new Date(log.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
          break;
        }
      }
    } catch {
      // fallback silently
    }
  }

  // Droplet particles
  const droplets = [
    { x: SCREEN_WIDTH * 0.08, delay: 0, size: 10, duration: 3200 },
    { x: SCREEN_WIDTH * 0.2, delay: 500, size: 7, duration: 2800 },
    { x: SCREEN_WIDTH * 0.35, delay: 200, size: 12, duration: 3600 },
    { x: SCREEN_WIDTH * 0.5, delay: 800, size: 8, duration: 3000 },
    { x: SCREEN_WIDTH * 0.62, delay: 100, size: 11, duration: 3400 },
    { x: SCREEN_WIDTH * 0.75, delay: 600, size: 6, duration: 2600 },
    { x: SCREEN_WIDTH * 0.88, delay: 300, size: 9, duration: 3100 },
  ];

  return (
    <View style={styles.root}>
      {/* ── Background wave layers ── */}
      <RisingWave delay={0} color="#1E3A5F" />
      <RisingWave delay={200} color="#1D4ED820" />
      <RisingWave delay={400} color="#3B82F615" />

      {/* ── Floating droplet particles ── */}
      {droplets.map((d, i) => (
        <WaterDroplet key={i} {...d} />
      ))}

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* ── Back button ── */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.backRow}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="x" size={20} color="#FFFFFF" />
          </AnimatedPressable>
        </Animated.View>

        {/* ── Main content ── */}
        <View style={styles.content}>
          {/* Trophy */}
          <TrophyIcon />

          {/* Headline */}
          <Animated.Text entering={FadeInDown.delay(800).duration(600)} style={styles.headline}>
            Goal Reached!
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(1000).duration(600)} style={styles.subline}>
            You've hit your daily hydration goal.{'\n'}Your body thanks you 💧
          </Animated.Text>

          {/* Stats card */}
          <Animated.View
            entering={FadeInUp.delay(1200).duration(600)}
            style={styles.statsCard}
          >
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalDrank}</Text>
                <Text style={styles.statLabel}>ML DRANK</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{goal}</Text>
                <Text style={styles.statLabel}>ML GOAL</Text>
              </View>
              {goalReachedTime ? (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{goalReachedTime}</Text>
                    <Text style={styles.statLabel}>REACHED AT</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                entering={FadeIn.delay(1500)}
                style={[
                  styles.progressFill,
                  { width: `${Math.min((totalDrank / goal) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {totalDrank > goal
                ? `${totalDrank - goal}ml over goal! 🚀`
                : '100% complete ✓'}
            </Text>
          </Animated.View>

          {/* CTA Button */}
          <Animated.View entering={FadeInUp.delay(1600).duration(500)} style={styles.ctaWrap}>
            <AnimatedPressable
              onPress={() => router.replace('/water')}
              style={styles.ctaBtn}
            >
              <Feather name="droplet" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.ctaBtnText}>Back to Hydration</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A1628',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 20,
    gap: 0,
  },
  // Trophy
  trophyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  trophyGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#3B82F6',
  },
  trophyInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#60A5FA',
  },
  trophyEmoji: {
    fontSize: 52,
  },
  // Text
  headline: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 10,
  },
  subline: {
    fontSize: 15,
    fontWeight: '500',
    color: '#93C5FD',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  // Stats card
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF12',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F630',
    padding: 20,
    marginBottom: 28,
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#3B82F630',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF15',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#3B82F6',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93C5FD',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: -4,
  },
  // CTA
  ctaWrap: {
    width: '100%',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
