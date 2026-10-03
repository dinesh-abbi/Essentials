import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Barbell from '@/components/illustrations/Barbell';
import Plant from '@/components/illustrations/Plant';
import Sun from '@/components/illustrations/Sun';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, FontFace, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import * as Training from '@/utils/TrainingStorage';
import { localDateKey } from '@/utils/userDocs';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';

type Kind = 'wake' | 'go' | 'complete';
type Palette = typeof Colors.dark;

/**
 * The three "moment" screens Catalyst opened from its 6 AM / 7 AM / session-
 * complete notifications, folded into one route: /train/brief?kind=…
 * Each is a single statement in display type, the facts that matter right
 * now, and at most two actions. One illustration, as everywhere else.
 */
export default function BriefScreen() {
  const { kind: rawKind } = useLocalSearchParams<{ kind?: string }>();
  const kind: Kind = rawKind === 'go' || rawKind === 'complete' ? rawKind : 'wake';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;

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
        const todays = sessions.find((s) => s.date === localDateKey());
        setSession(todays ?? null);
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

  const copy = {
    wake: {
      bracket: '[ MORNING ]',
      headline: 'Rise.',
      line: day?.isRecovery ? 'Recovery day — move gently, eat well.' : `${day?.focus ?? '…'} today.`,
      illo: <Sun size={64} color={colors.water} />,
    },
    go: {
      bracket: '[ TIME TO TRAIN ]',
      headline: 'Go.',
      line: day ? `${day.focus} · ${day.exercises.length} movements · about ${minutes} min` : '…',
      illo: <Barbell size={64} color={colors.water} />,
    },
    complete: {
      bracket: '[ SESSION LOGGED ]',
      headline: 'Done.',
      line: session ? `${session.title} · ${done} of ${session.exercises.length} movements` : 'Nice work today.',
      illo: <Plant size={64} color={colors.water} />,
    },
  }[kind];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket={copy.bracket} icon="x" onBack={goHome} />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
          <EntranceView index={0} style={styles.illo}>
            {copy.illo}
          </EntranceView>
          <EntranceView index={1}>
            <Text style={[styles.headline, { color: colors.textHi }]}>{copy.headline}</Text>
            <Text style={[Type.title, { color: colors.textMid }]}>{copy.line}</Text>
          </EntranceView>

          {kind === 'go' && day && day.exercises.length > 0 && (
            <EntranceView index={2} style={[styles.block, { borderTopColor: colors.hairline }]}>
              <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ FIRST UP ]</Text>
              {day.exercises.slice(0, 3).map((e, i) => (
                <View key={e.id} style={styles.line}>
                  <Text style={[Type.badge, { color: colors.water, width: 26 }]}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={[Type.body, { color: colors.textHi, flex: 1 }]}>{e.name}</Text>
                  <Text style={[Type.subline, { color: colors.textMid }]}>{Training.prescription(e)}</Text>
                </View>
              ))}
              <Text style={[Type.subline, { color: colors.textMid }]}>Warm up 5 minutes first. Tempo 3·1·2·1.</Text>
            </EntranceView>
          )}

          {kind === 'complete' && (
            <EntranceView index={2} style={[styles.block, { borderTopColor: colors.hairline }]}>
              <View style={styles.stats}>
                <Stat label="DONE" value={`${done}`} colors={colors} />
                <Stat label="LOAD" value={session?.totalLoadKg ? `${Math.round(session.totalLoadKg)}` : '—'} unit="kg" colors={colors} />
                <Stat label="STREAK" value={`${streak}`} unit="days" colors={colors} />
              </View>
              <Text style={[Type.bracketLabel, { color: colors.textMid, marginTop: Spacing.three }]}>[ REFUEL ]</Text>
              <Tip text="25–40 g protein in the next two hours — shake, paneer, eggs or chicken." colors={colors} />
              <Tip text="Fast carbs to refill: rice, banana or oats." colors={colors} />
              <Tip text="At least 500 ml of water now." colors={colors} />
            </EntranceView>
          )}

          {kind === 'wake' && (
            <EntranceView index={2} style={[styles.block, { borderTopColor: colors.hairline }]}>
              <Tip text="Half a litre of water before anything else." colors={colors} />
              <Tip text="Two minutes of daylight wakes you faster than coffee." colors={colors} />
            </EntranceView>
          )}

          <EntranceView index={3} style={styles.actions}>
            {(kind === 'wake' || kind === 'complete') && (
              <AnimatedPressable
                onPress={logWater}
                disabled={logging || logged}
                haptic="medium"
                style={[styles.pill, { borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth }]}
                accessibilityRole="button"
              >
                {logging ? (
                  <ActivityIndicator color={colors.water} />
                ) : (
                  <>
                    <Feather name={logged ? 'check' : 'droplet'} size={16} color={colors.water} />
                    <Text style={[Type.controlLabel, { color: colors.textHi }]}>{logged ? 'Logged 500 ml' : 'Log 500 ml'}</Text>
                  </>
                )}
              </AnimatedPressable>
            )}
            <AnimatedPressable
              onPress={kind === 'complete' ? goHome : goTrain}
              haptic="medium"
              style={[styles.pill, { backgroundColor: colors.water }]}
              accessibilityRole="button"
            >
              <Text style={[Type.controlLabel, { color: colors.onAccent }]}>
                {kind === 'complete' ? 'Back home' : kind === 'go' ? 'Start session' : 'See today'}
              </Text>
              <Feather name="arrow-right" size={16} color={colors.onAccent} />
            </AnimatedPressable>
          </EntranceView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value, unit, colors }: { label: string; value: string; unit?: string; colors: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ {label} ]</Text>
      <Text style={[Type.numberSm, { color: colors.textHi }]}>
        {value}
        {unit ? <Text style={[Type.subline, { color: colors.textMid }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function Tip({ text, colors }: { text: string; colors: Palette }) {
  return (
    <View style={styles.tip}>
      <View style={[styles.tipDot, { backgroundColor: colors.water }]} />
      <Text style={[Type.body, { color: colors.textHi, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  pad: { paddingHorizontal: Spacing.four },
  content: { paddingHorizontal: Spacing.four + Spacing.one, paddingTop: Spacing.five, gap: Spacing.five, flexGrow: 1 },
  illo: { alignSelf: 'flex-start' },
  headline: { fontFamily: FontFace.displayBold, fontSize: 84, lineHeight: 90, letterSpacing: -3 },
  block: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.four, gap: Spacing.three },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2 },
  tip: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  actions: { gap: Spacing.two, marginTop: 'auto' },
  pill: {
    height: 56,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
