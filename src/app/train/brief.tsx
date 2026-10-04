import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChunkyButton, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { Confetti } from '@/components/ui/confetti';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hue, MaxContentWidth, Spacing, Type, type HueName } from '@/constants/theme';
import * as Training from '@/utils/TrainingStorage';
import { localDateKey } from '@/utils/userDocs';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';

type Kind = 'wake' | 'go' | 'complete';
const C = Colors.dark;

/**
 * The three "moment" screens opened from the 6 AM / 7 AM / workout-complete
 * notifications: /train/brief?kind=… Each is one big picture, one huge word,
 * a few facts as tiles, and at most two buttons.
 */
export default function BriefScreen() {
  const { kind: rawKind } = useLocalSearchParams<{ kind?: string }>();
  const kind: Kind = rawKind === 'go' || rawKind === 'complete' ? rawKind : 'wake';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [day, setDay] = useState<Training.TrainingDay | null>(null);
  const [session, setSession] = useState<Training.WorkoutSession | null>(null);
  const [streak, setStreak] = useState(0);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    (async () => {
      const [split, offset] = await Promise.all([Training.getCachedSplit(), Training.getScheduleOffset()]);
      setDay(Training.dayForSlot(split.days, Training.splitSlotFor(new Date(), offset)));
      if (kind === 'complete') {
        const sessions = await Training.getRecentSessions();
        setSession(sessions.find((s) => s.date === localDateKey()) ?? null);
        setStreak(Training.currentStreak(sessions, split.days, offset));
      }
    })();
  }, [kind]);

  const logWater = async () => {
    setLogging(true);
    try {
      await WaterStorage.logWaterIntake(500);
      WidgetSync.sync();
      setLogged(true);
    } finally {
      setLogging(false);
    }
  };

  const goTrain = () => router.replace('/(tabs)/train' as any);
  const goHome = () => router.replace('/(tabs)' as any);

  const done = session?.exercises.filter((e) => e.isCompleted).length ?? 0;
  const minutes = day ? Math.max(20, day.exercises.length * 8) : 0;

  const copy: Record<Kind, { eyebrow: string; headline: string; line: string; icon: IconName; hue: HueName }> = {
    wake: {
      eyebrow: 'Morning',
      headline: 'Rise.',
      line: day?.isRecovery ? 'Recovery day — move gently, eat well.' : `${day?.focus ?? '…'} today.`,
      icon: 'white-balance-sunny',
      hue: 'spend',
    },
    go: {
      eyebrow: 'Time to train',
      headline: 'Go.',
      line: day ? `${day.focus} · ${day.exercises.length} moves · ~${minutes} min` : '…',
      icon: 'arm-flex',
      hue: 'train',
    },
    complete: {
      eyebrow: 'Workout logged',
      headline: 'Done!',
      line: session ? session.title : 'Nice work today.',
      icon: 'trophy',
      hue: 'train',
    },
  };
  const c = copy[kind];

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {kind === 'complete' && <Confetti loop={false} />}
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket={c.eyebrow} icon="x" onBack={goHome} />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
          <EntranceView index={0}>
            <IconBlob name={c.icon} hue={c.hue} size={96} />
          </EntranceView>
          <EntranceView index={1} style={styles.words}>
            <Text style={[styles.headline, { color: C.textHi }]}>{c.headline}</Text>
            <Text style={[Type.title, { color: C.textMid }]}>{c.line}</Text>
          </EntranceView>

          {kind === 'go' && day && day.exercises.length > 0 && (
            <EntranceView index={2}>
              <Tile style={styles.list}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>First up</Text>
                {day.exercises.slice(0, 3).map((e, i) => (
                  <View key={e.id} style={styles.line}>
                    <View style={[styles.num, { backgroundColor: Hue.train.soft }]}>
                      <Text style={[Type.dotSmall, { color: Hue.train.main, fontSize: 16 }]}>{i + 1}</Text>
                    </View>
                    <Text style={[Type.controlLabel, styles.flex, { color: C.textHi }]}>{e.name}</Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>{Training.prescription(e)}</Text>
                  </View>
                ))}
                <Tip icon="run" text="Warm up 5 minutes first" />
              </Tile>
            </EntranceView>
          )}

          {kind === 'complete' && (
            <EntranceView index={2} style={styles.statRow}>
              <Stat icon="check-bold" hue="train" value={`${done}`} label="moves" />
              <Stat icon="weight-kilogram" hue="profile" value={session?.totalLoadKg ? `${Math.round(session.totalLoadKg)}` : '--'} label="kg" />
              <Stat icon="fire" hue="spend" value={`${streak}`} label="streak" />
            </EntranceView>
          )}

          {kind === 'complete' && (
            <EntranceView index={3}>
              <Tile hue="fuel" style={styles.list}>
                <Text style={[Type.dotLabel, { color: Hue.fuel.main }]}>Refuel</Text>
                <Tip icon="food-drumstick" text="25–40 g protein in the next 2 hours" />
                <Tip icon="rice" text="Fast carbs: rice, banana or oats" />
                <Tip icon="cup-water" text="At least 500 ml of water now" />
              </Tile>
            </EntranceView>
          )}

          {kind === 'wake' && (
            <EntranceView index={2}>
              <Tile style={styles.list}>
                <Tip icon="cup-water" text="Half a litre of water first" />
                <Tip icon="white-balance-sunny" text="Two minutes of daylight" />
              </Tile>
            </EntranceView>
          )}

          <EntranceView index={4} style={styles.actions}>
            {(kind === 'wake' || kind === 'complete') && (
              <ChunkyButton
                label={logged ? 'Logged 500 ml' : 'Log 500 ml'}
                icon={logged ? 'check-bold' : 'cup-water'}
                variant="soft"
                hue="water"
                onPress={logWater}
                loading={logging}
                disabled={logged}
              />
            )}
            <ChunkyButton
              label={kind === 'complete' ? 'Back home' : kind === 'go' ? 'Start workout' : 'See today'}
              icon="arrow-right"
              hue={c.hue}
              onPress={kind === 'complete' ? goHome : goTrain}
            />
          </EntranceView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, hue, value, label }: { icon: IconName; hue: HueName; value: string; label: string }) {
  return (
    <Tile hue={hue} containerStyle={styles.flex} style={styles.stat}>
      <IconBlob name={icon} hue={hue} size={34} />
      <Text style={[Type.dotNumber, { color: C.textHi }]}>{value}</Text>
      <Text style={[Type.subline, { color: C.textMid }]}>{label}</Text>
    </Tile>
  );
}

function Tip({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.tip}>
      <MaterialCommunityIcons name={icon} size={20} color={C.textMid} />
      <Text style={[Type.body, styles.flex, { color: C.textHi }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  pad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, gap: Spacing.three, flexGrow: 1 },
  flex: { flex: 1 },
  words: { gap: 4 },
  headline: { ...Type.dotHero, fontSize: 84, lineHeight: 92 },
  list: { gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { alignItems: 'flex-start', gap: 4 },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actions: { gap: 10, marginTop: 'auto', paddingTop: Spacing.four },
});
