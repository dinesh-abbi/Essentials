import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Droplet from '@/components/illustrations/Droplet';
import Skeleton from '@/components/SkeletonLoader';
import { Chip, ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { DotMeter } from '@/components/ui/dots';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hue, Spacing, Type } from '@/constants/theme';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';

const C = Colors.dark;

/** One day of water: Drip at that day's level, the total vs goal, and every glass. */
export default function WaterDailyReportScreen() {
  const { dateMs } = useLocalSearchParams<{ dateMs: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const target = dateMs ? new Date(parseInt(dateMs, 10)) : new Date();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WaterStorage.WaterLog[]>([]);
  const [goal, setGoal] = useState(WaterStorage.DEFAULT_DAILY_GOAL);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const start = new Date(target);
        start.setHours(0, 0, 0, 0);
        const end = new Date(target);
        end.setHours(23, 59, 59, 999);
        const [day, g] = await Promise.all([
          WaterStorage.getWaterLogsBetween(start.getTime(), end.getTime()),
          WaterStorage.getUserWaterGoal(),
        ]);
        setGoal(g);
        setLogs(day.sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.warn('Failed to load water report:', e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMs]);

  const remove = (id: string) =>
    Alert.alert('Remove this glass?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(id);
          try {
            await WaterStorage.deleteWaterLog(id);
            setLogs((prev) => prev.filter((l) => l.id !== id));
            WidgetSync.sync();
          } catch {
            Alert.alert('Error', 'Failed to remove it.');
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);

  const total = logs.reduce((s, l) => s + l.amountMl, 0);
  const ratio = goal > 0 ? total / goal : 0;
  const glasses = Math.round(total / 250);

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket="Water · day" />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]} showsVerticalScrollIndicator={false}>
          <Text style={[Type.largeTitle, { color: C.textHi }]}>
            {target.toLocaleDateString('en-IN', { weekday: 'long' })}
          </Text>
          <Text style={[Type.dotLabel, { color: C.textMid }]}>
            {target.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>

          <Tile hue="water" style={styles.hero}>
            {loading ? (
              <Skeleton width={110} height={136} borderRadius={55} />
            ) : (
              <Droplet ratio={ratio} size={110} />
            )}
            <View style={styles.flex}>
              <Text style={[Type.dotNumber, { color: C.textHi }]}>{total}</Text>
              <Text style={[Type.subline, { color: C.textMid }]}>of {goal.toLocaleString('en-IN')} ml</Text>
              <DotMeter total={10} lit={Math.min(10, Math.round(ratio * 10))} color={Hue.water.main} size={10} gap={4} style={styles.meter} />
              <Chip icon={ratio >= 1 ? 'trophy' : 'water-percent'} label={ratio >= 1 ? 'Goal hit' : `${Math.round(ratio * 100)}%`} hue="water" solid={ratio >= 1} />
            </View>
          </Tile>

          <View style={styles.sectionRow}>
            <Text style={[Type.headline, { color: C.textHi }]}>Glasses</Text>
            <Chip icon="cup-water" label={`≈ ${glasses}`} hue="water" />
          </View>

          {!loading && logs.length === 0 && (
            <Tile style={styles.empty}>
              <MaterialCommunityIcons name="cup-off-outline" size={40} color={C.textLow} />
              <Text style={[Type.body, { color: C.textMid }]}>No water logged this day.</Text>
            </Tile>
          )}
          {logs.map((l, i) => (
            <Animated.View key={l.id} entering={reduceMotion ? undefined : FadeInDown.delay(i * 30).springify().damping(18)}>
              <Tile style={styles.row}>
                <IconBlob name="cup-water" hue="water" size={40} variant="soft" />
                <View style={styles.flex}>
                  <Text style={[Type.dotSmall, { color: C.textHi }]}>{l.amountMl} ml</Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>
                    {new Date(l.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
                <ChunkyButton
                  icon="trash-can-outline"
                  variant="soft"
                  hue="alarm"
                  textColor={C.alert}
                  size="sm"
                  haptic="light"
                  loading={deleting === l.id}
                  onPress={() => remove(l.id)}
                  accessibilityLabel="Remove this glass"
                />
              </Tile>
            </Animated.View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 10 },
  flex: { flex: 1, gap: 4 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.three },
  meter: { marginVertical: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
