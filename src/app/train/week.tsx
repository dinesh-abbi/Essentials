import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, ChunkyButton, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Hue, MaxContentWidth, Spacing, Type } from '@/constants/theme';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import * as Training from '@/utils/TrainingStorage';
import { isoWeekday, localDateKey } from '@/utils/userDocs';

const C = Colors.dark;

/**
 * The week plan: seven day cards (today glows, logged days carry a tick,
 * rest days a moon). Tap a day to see its moves or make it today's session.
 */
export default function WeekPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [split, setSplit] = useState<{ days: Training.TrainingDay[]; isCustom: boolean }>({
    days: Training.DEFAULT_SPLIT,
    isCustom: false,
  });
  const [offset, setOffset] = useState(0);
  const [doneDates, setDoneDates] = useState<Set<string>>(new Set());
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [cached, off] = await Promise.all([Training.getCachedSplit(), Training.getScheduleOffset()]);
    setSplit(cached);
    setOffset(off);
    const [fresh, sessions] = await Promise.all([Training.getSplit(), Training.getRecentSessions()]);
    setSplit(fresh);
    setDoneDates(Training.sessionDatesThisWeek(sessions));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date();
  const todayIso = isoWeekday(today);
  const monday = new Date(today);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(today.getDate() - (todayIso - 1));

  const rows = Training.WEEKDAY_SHORT.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const slot = Training.splitSlotFor(date, offset);
    return { iso: i + 1, label, date, slot, day: Training.dayForSlot(split.days, slot), done: doneDates.has(localDateKey(date)) };
  });

  const openDay = openSlot ? Training.dayForSlot(split.days, openSlot) : null;
  const openIsToday = openSlot === Training.splitSlotFor(today, offset);

  const applyOffset = async (next: number) => {
    await Training.setScheduleOffset(next);
    setOffset(await Training.getScheduleOffset());
    rescheduleRoutineReminders().catch(() => {});
  };

  const makeToday = async (slot: number) => {
    await applyOffset(Training.offsetToMakeToday(slot, today));
    setOpenSlot(null);
    router.back();
  };

  const resetSplit = () =>
    Alert.alert('Back to the default split?', 'Your own split will be removed from this account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await Training.clearCustomSplit();
          setSplit({ days: Training.DEFAULT_SPLIT, isCustom: false });
          rescheduleRoutineReminders().catch(() => {});
        },
      },
    ]);

  const train = Hue.train;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerPad}>
          <ScreenHeader bracket="Week plan" />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
          <EntranceView index={0} style={styles.intro}>
            <Text style={[Type.largeTitle, { color: C.textHi }]}>Your week</Text>
            <Text style={[Type.subline, { color: C.textMid }]}>Tap a day to see it — or train it today</Text>
            {offset !== 0 && (
              <ChunkyButton
                label={`Moved ${offset > 0 ? '+' : ''}${offset} day${Math.abs(offset) === 1 ? '' : 's'} · undo`}
                icon="undo-variant"
                variant="soft"
                hue="train"
                size="sm"
                onPress={() => applyOffset(0)}
                style={styles.selfStart}
              />
            )}
          </EntranceView>

          {rows.map((r, i) => {
            const isToday = r.iso === todayIso;
            const rest = r.day.exercises.length === 0;
            return (
              <EntranceView key={r.iso} index={1 + i}>
                <Tile
                  hue={isToday || r.done ? 'train' : null}
                  onPress={() => setOpenSlot(r.slot)}
                  haptic="selection"
                  style={styles.dayFace}
                  accessibilityLabel={`${Training.WEEKDAY_NAMES[r.iso - 1]}: ${r.day.focus}${r.done ? ', logged' : ''}`}
                >
                  <View style={[styles.date, { backgroundColor: isToday ? train.main : C.surface2 }]}>
                    <Text style={[Type.dotLabel, { color: isToday ? train.on : C.textMid, fontSize: 11 }]}>{r.label}</Text>
                    <Text style={[Type.dotSmall, { color: isToday ? train.on : C.textHi }]}>{r.date.getDate()}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[Type.title, { color: rest ? C.textMid : C.textHi, fontSize: 17 }]} numberOfLines={1}>
                      {r.day.focus}
                    </Text>
                    <View style={styles.chips}>
                      <Chip icon={rest ? 'weather-night' : 'dumbbell'} label={rest ? 'Rest' : `${r.day.exercises.length} moves`} hue={rest ? undefined : 'train'} />
                      {isToday ? <Chip label="Today" hue="train" solid /> : null}
                    </View>
                  </View>
                  {r.done ? (
                    <View style={[styles.tick, { backgroundColor: train.main }]}>
                      <MaterialCommunityIcons name="check-bold" size={16} color={train.on} />
                    </View>
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={22} color={C.textLow} />
                  )}
                </Tile>
              </EntranceView>
            );
          })}

          {split.isCustom && (
            <EntranceView index={9}>
              <ChunkyButton label="Use the default split" icon="restore" variant="soft" hue="train" size="md" onPress={resetSplit} style={styles.reset} />
            </EntranceView>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Day detail ─────────────────────────────────────────────────── */}
      <Sheet visible={!!openDay} onClose={() => setOpenSlot(null)} bracket={`Split day ${openSlot ?? ''}`} title={openDay?.focus} heightRatio={0.8}>
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {openDay && !openIsToday && (
            <ChunkyButton
              label="Train this today"
              icon="lightning-bolt"
              hue="train"
              onPress={() => makeToday(openDay.dayNumber)}
              accessibilityLabel={`Make ${openDay.focus} today's session`}
            />
          )}
          {openDay && openDay.exercises.length === 0 && (
            <View style={styles.restNote}>
              <MaterialCommunityIcons name="weather-night" size={28} color={C.textMid} />
              <Text style={[Type.body, styles.flex, { color: C.textMid }]}>Recovery — walk, stretch, foam-roll. No lifting.</Text>
            </View>
          )}
          {openDay?.exercises.map((ex, i) => (
            <View key={ex.id} style={[styles.exRow, { backgroundColor: C.bg }]}>
              <View style={[styles.exNum, { backgroundColor: train.soft }]}>
                <Text style={[Type.dotSmall, { color: train.main, fontSize: 16 }]}>{i + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[Type.controlLabel, { color: C.textHi }]}>{ex.name}</Text>
                <Text style={[Type.subline, { color: C.textMid }]}>
                  {Training.prescription(ex)}
                  {ex.tempo && !ex.isCardio ? `  ·  tempo ${ex.tempo}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  headerPad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 8 },
  flex: { flex: 1 },
  selfStart: { alignSelf: 'flex-start' },
  intro: { gap: 6, marginBottom: Spacing.three },
  dayFace: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  date: { width: 52, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tick: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  reset: { marginTop: Spacing.three },
  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 10 },
  restNote: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  exNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
