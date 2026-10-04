import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Droplet from '@/components/illustrations/Droplet';
import { ChunkyButton } from '@/components/ui/chunky';
import { Confetti } from '@/components/ui/confetti';
import { StatGrid, StatTile } from '@/components/ui/stat-tile';
import { Colors, Spacing, Type } from '@/constants/theme';
import * as WaterStorage from '@/utils/WaterStorage';

const C = Colors.dark;

/**
 * The "goal hit" celebration (opened from the goal notification): confetti,
 * Drip at full joy, three facts, one button home.
 */
export default function WaterGoalScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [total, setTotal] = useState(0);
  const [goal, setGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [reachedAt, setReachedAt] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [g, t, logs] = await Promise.all([
          WaterStorage.getUserWaterGoal(),
          WaterStorage.getTodayTotalMl(),
          WaterStorage.getTodayWaterLogs(),
        ]);
        setGoal(g);
        setTotal(t);
        let running = 0;
        for (const l of logs.sort((a, b) => a.timestamp - b.timestamp)) {
          running += l.amountMl;
          if (running >= g) {
            setReachedAt(new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            break;
          }
        }
      } catch {
        // Celebration still renders with defaults.
      }
    })();
  }, []);

  const enter = (d: number) => (reduceMotion ? undefined : FadeInDown.delay(d).springify().damping(16));

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <Confetti />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <ChunkyButton icon="close" variant="soft" hue="water" size="md" haptic="light" onPress={() => router.back()} accessibilityLabel="Close" />
        </View>
        <View style={styles.content}>
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.delay(150).springify().damping(10)}>
            <Droplet ratio={Math.max(1, total / goal)} size={190} />
          </Animated.View>
          <Animated.Text entering={enter(400)} style={[styles.headline, { color: C.textHi }]}>
            Goal hit!
          </Animated.Text>
          <Animated.Text entering={enter(520)} style={[Type.title, styles.center, { color: C.textMid }]}>
            {total > goal ? `${(total - goal).toLocaleString('en-IN')} ml extra today` : 'Drip is very happy'}
          </Animated.Text>
          <Animated.View entering={enter(650)} style={styles.stats}>
            <StatGrid>
              <StatTile icon="cup-water" hue="water" value={`${total}`} label="ml today" />
              <StatTile icon="clock-check-outline" hue="spend" value={reachedAt || '--:--'} label="reached at" />
            </StatGrid>
          </Animated.View>
        </View>
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(800)} style={styles.actions}>
          <ChunkyButton label="Back to hydration" icon="water" hue="water" onPress={() => router.replace('/water')} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1 },
  top: { alignItems: 'flex-end', paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: Spacing.three },
  headline: { ...Type.dotHero, fontSize: 64, lineHeight: 72, marginTop: 10 },
  center: { textAlign: 'center' },
  stats: { alignSelf: 'stretch', marginTop: Spacing.three },
  actions: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
});
