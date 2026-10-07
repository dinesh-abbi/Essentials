import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BodyMap } from '@/components/training/BodyMap';
import { BarChart } from '@/components/ui/bar-chart';
import { Chip, ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { StatGrid, StatTile } from '@/components/ui/stat-tile';
import { Colors, Hue, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import { getMuscle } from '@/utils/ExerciseCatalog';
import * as Goals from '@/utils/GoalStorage';
import * as Reviews from '@/utils/ReviewStorage';
import { computeRecords } from '@/utils/TrainingRecords';
import * as Training from '@/utils/TrainingStorage';
import * as Volume from '@/utils/TrainingVolume';
import { localDateKey } from '@/utils/userDocs';

const C = Colors.dark;
type Range = '7' | '30';

/**
 * Progress — Forma's recap, rebuilt on the phone from logged sessions: the
 * period as four numbers, where the work went on the body, sets per day,
 * personal records, goals and the weekly review.
 */
export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [range, setRange] = useState<Range>('7');
  const [sessions, setSessions] = useState<Training.WorkoutSession[]>([]);
  const [goals, setGoals] = useState<Goals.Goal[]>([]);
  const [reviews, setReviews] = useState<Reviews.WeeklyReview[]>([]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  useDataRefresh(['docs'], () => setReloadTick((n) => n + 1));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [s, g, r] = await Promise.all([Training.getRecentSessions(), Goals.getGoals(), Reviews.getReviews()]);
        if (cancelled) return;
        setSessions(s);
        setGoals(g);
        setReviews(r);
      })();
      return () => {
        cancelled = true;
      };
    }, [reloadTick]),
  );

  const today = localDateKey();
  const days = useMemo(() => Volume.lastDays(range === '7' ? 7 : 30), [range]);
  const inRange = useMemo(() => Volume.inDays(sessions, days), [sessions, days]);
  const recap = useMemo(() => Volume.recap(inRange), [inRange]);
  const load = useMemo(() => Volume.muscleLoad(inRange), [inRange]);
  const heat = useMemo(() => Volume.normalise(load), [load]);
  const records = useMemo(() => computeRecords(sessions).slice(0, 8), [sessions]);
  const missing = Volume.untrained(load);

  // 7 days → one bar a day; 30 days → five 6-day blocks.
  const bars = useMemo(() => {
    const perDay = Volume.setsPerDay(inRange, days);
    if (range === '7')
      return days.map((d, i) => ({
        label: Training.WEEKDAY_SHORT[(new Date(`${d}T12:00:00`).getDay() + 6) % 7].slice(0, 2),
        value: perDay[i],
        strong: d === today,
        selected: d === today,
        caption: perDay[i] ? String(perDay[i]) : undefined,
      }));
    return Array.from({ length: 5 }, (_, b) => {
      const chunk = perDay.slice(b * 6, b * 6 + 6);
      const start = new Date(`${days[b * 6]}T12:00:00`);
      const value = chunk.reduce((a, n) => a + n, 0);
      return { label: `${start.getDate()}/${start.getMonth() + 1}`, value, strong: b === 4, caption: value ? String(value) : undefined };
    });
  }, [inRange, days, range, today]);

  const thisWeek = Reviews.mondayKey();
  const currentReview = reviews.find((r) => r.week === thisWeek) ?? null;
  const bodyW = Math.min(150, (width - Spacing.three * 2 - Spacing.four * 2 - Spacing.three) / 2);
  const train = Hue.train;

  const removeGoal = (g: Goals.Goal) =>
    Alert.alert('Remove this goal?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setGoals((cur) => cur.filter((x) => x.id !== g.id));
          await Goals.deleteGoal(g.id);
        },
      },
    ]);

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerPad}>
          <ScreenHeader bracket="Progress" />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
          <EntranceView index={0} style={styles.intro}>
            <Text style={[Type.largeTitle, { color: C.textHi }]}>Progress</Text>
            <Segmented
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
              ]}
              value={range}
              onChange={setRange}
              hue="train"
            />
          </EntranceView>

          <EntranceView index={1}>
            <StatGrid>
              <StatTile icon="arm-flex" hue="train" value={String(recap.sessions)} label="sessions" />
              <StatTile icon="timer-outline" hue="train" value={String(recap.minutes)} label="minutes" />
              <StatTile icon="repeat" hue="train" value={String(recap.sets)} label="sets" />
              <StatTile
                icon="weight-kilogram"
                hue="train"
                value={recap.volumeKg >= 10_000 ? `${(recap.volumeKg / 1000).toFixed(1)}t` : String(Math.round(recap.volumeKg))}
                label="kg moved"
              />
            </StatGrid>
          </EntranceView>

          {/* ── Where the work went ───────────────────────────────────── */}
          <EntranceView index={2}>
            <Tile style={styles.section}>
              <Text style={[Type.dotLabel, { color: C.textMid }]}>Where the work went</Text>
              <View style={styles.bodies}>
                {(['front', 'back'] as const).map((side) => (
                  <BodyMap key={side} side={side} heat={heat} width={bodyW} />
                ))}
              </View>
              {Object.keys(load).length === 0 ? (
                <Text style={[Type.body, styles.center, { color: C.textMid }]}>Log a session to light the body up</Text>
              ) : missing.length > 0 ? (
                <>
                  <Text style={[Type.dotLabel, { color: C.textMid }]}>Not trained</Text>
                  <View style={styles.chips}>
                    {missing.map((id) => (
                      <Chip key={id} label={getMuscle(id)?.name ?? id} />
                    ))}
                  </View>
                </>
              ) : (
                <Chip icon="check-bold" label="Every muscle got work" hue="train" solid />
              )}
            </Tile>
          </EntranceView>

          <EntranceView index={3}>
            <Tile style={styles.section}>
              <Text style={[Type.dotLabel, { color: C.textMid }]}>Sets {range === '7' ? 'per day' : 'per 6 days'}</Text>
              <BarChart bars={bars} hue="train" height={120} />
            </Tile>
          </EntranceView>

          {/* ── Records ──────────────────────────────────────────────── */}
          <EntranceView index={4} style={styles.sectionHead}>
            <Text style={[Type.headline, { color: C.textHi }]}>Records</Text>
            <MaterialCommunityIcons name="trophy" size={24} color={train.main} />
          </EntranceView>
          {records.length === 0 ? (
            <Text style={[Type.body, { color: C.textMid }]}>Finish a session with weights to set your first records.</Text>
          ) : (
            records.map((r, i) => (
              <Tile
                key={r.key}
                style={styles.recordRow}
                onPress={r.catalogId ? () => router.push(`/train/exercise/${r.catalogId}` as any) : undefined}
                accessibilityLabel={`${r.name}: best ${r.bestWeight} kilograms${r.bestE1rm ? `, estimated max ${r.bestE1rm}` : ''}`}
              >
                <View style={[styles.rank, { backgroundColor: i === 0 ? train.main : C.surface2 }]}>
                  <Text style={[Type.dotSmall, { color: i === 0 ? train.on : C.textHi, fontSize: 16 }]}>{i + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>
                    {r.sessions} session{r.sessions === 1 ? '' : 's'}
                    {r.bestE1rm ? ` · est. max ${Math.round(r.bestE1rm)} kg` : ''}
                  </Text>
                </View>
                <View style={styles.recordValue}>
                  <Text style={[Type.dotSmall, { color: C.textHi }]}>{r.bestWeight}</Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>{r.bestWeightReps ? `kg × ${r.bestWeightReps}` : 'kg'}</Text>
                </View>
              </Tile>
            ))
          )}

          {/* ── Goals ────────────────────────────────────────────────── */}
          <EntranceView index={5} style={styles.sectionHead}>
            <Text style={[Type.headline, { color: C.textHi }]}>Goals</Text>
            <ChunkyButton
              icon="plus"
              variant="soft"
              hue="train"
              size="md"
              haptic="light"
              onPress={() => (goals.length >= Goals.MAX_GOALS ? Alert.alert('That’s 50 goals', 'Remove an old one first.') : setGoalOpen(true))}
              accessibilityLabel="New goal"
            />
          </EntranceView>
          {goals.length === 0 && <Text style={[Type.body, { color: C.textMid }]}>Set a target — sessions, minutes or active days.</Text>}
          {goals.map((g) => {
            const current = Goals.goalProgress(g, sessions, today);
            const status = Goals.goalStatus(g, current, today);
            return (
              <Tile key={g.id} hue={status === 'achieved' ? 'train' : null} style={styles.goalRow}>
                <ProgressRing size={56} stroke={8} progress={Math.min(1, current / g.target)} color={train.main} track={train.soft}>
                  {status === 'achieved' ? (
                    <MaterialCommunityIcons name="check-bold" size={22} color={train.main} />
                  ) : (
                    <Text style={[Type.dotLabel, { color: C.textHi }]}>{Math.floor((current / g.target) * 100)}%</Text>
                  )}
                </ProgressRing>
                <View style={styles.flex}>
                  <Text style={[Type.controlLabel, { color: C.textHi }]}>
                    {current} / {g.target} {Goals.METRIC_LABEL[g.metric].toLowerCase()}
                  </Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>
                    {shortDate(g.start)} → {shortDate(g.end)}
                  </Text>
                  <View style={styles.chips}>
                    <Chip label={STATUS_LABEL[status]} hue={status === 'active' || status === 'achieved' ? 'train' : undefined} solid={status === 'achieved'} />
                  </View>
                </View>
                <ChunkyButton icon="trash-can-outline" variant="soft" hue="train" size="sm" haptic="light" onPress={() => removeGoal(g)} accessibilityLabel="Remove goal" />
              </Tile>
            );
          })}

          {/* ── Weekly review ────────────────────────────────────────── */}
          <EntranceView index={6} style={styles.sectionHead}>
            <Text style={[Type.headline, { color: C.textHi }]}>Weekly review</Text>
          </EntranceView>
          <Tile
            hue={currentReview ? 'train' : null}
            style={styles.reviewFace}
            onPress={() => setReviewOpen(true)}
            accessibilityLabel={currentReview ? 'Edit this week’s review' : 'Write this week’s review'}
          >
            <IconBlob name={currentReview ? 'notebook-check' : 'notebook-edit'} hue="train" size={44} />
            <View style={styles.flex}>
              <Text style={[Type.controlLabel, { color: C.textHi }]}>{currentReview ? 'This week' : 'How did this week go?'}</Text>
              <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={2}>
                {currentReview ? currentReview.win : 'One win, what got in the way, your next step'}
              </Text>
            </View>
            {currentReview ? <Confidence value={currentReview.confidence} /> : <MaterialCommunityIcons name="chevron-right" size={22} color={C.textMid} />}
          </Tile>
          {reviews
            .filter((r) => r.week !== thisWeek)
            .slice(0, 4)
            .map((r) => (
              <Tile key={r.week} style={styles.pastReview}>
                <View style={styles.reviewTop}>
                  <Text style={[Type.dotLabel, { color: C.textMid }]}>Week of {shortDate(r.week)}</Text>
                  <Confidence value={r.confidence} />
                </View>
                <Text style={[Type.body, { color: C.textHi }]}>{r.win}</Text>
                <Text style={[Type.subline, { color: C.textMid }]}>Next: {r.nextStep}</Text>
              </Tile>
            ))}
        </ScrollView>
      </SafeAreaView>

      <GoalSheet
        visible={goalOpen}
        onClose={() => setGoalOpen(false)}
        onSaved={(g) => {
          setGoals((cur) => [g, ...cur]);
          setGoalOpen(false);
        }}
      />
      <ReviewSheet
        visible={reviewOpen}
        week={thisWeek}
        initial={currentReview}
        onClose={() => setReviewOpen(false)}
        onSaved={(r) => {
          setReviews((cur) => [r, ...cur.filter((x) => x.week !== r.week)]);
          setReviewOpen(false);
        }}
      />
    </View>
  );
}

const STATUS_LABEL: Record<Goals.GoalStatus, string> = {
  achieved: 'Achieved',
  active: 'On now',
  upcoming: 'Upcoming',
  ended: 'Ended',
};

function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Confidence({ value }: { value: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Confidence ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.dot, { backgroundColor: n <= value ? Hue.train.main : C.surface2 }]} />
      ))}
    </View>
  );
}

// ── Goal form ─────────────────────────────────────────────────────────────────

const WINDOWS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: '30', label: 'Next 30 days' },
  { id: '90', label: 'Next 90 days' },
] as const;

function windowDates(id: (typeof WINDOWS)[number]['id']): { start: string; end: string } {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  if (id === 'week') {
    const start = Reviews.mondayKey(now);
    const end = new Date(`${start}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return { start, end: localDateKey(end) };
  }
  if (id === 'month') {
    return {
      start: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  const end = new Date(now);
  end.setDate(end.getDate() + Number(id) - 1);
  return { start: localDateKey(now), end: localDateKey(end) };
}

function GoalSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (g: Goals.Goal) => void }) {
  const [metric, setMetric] = useState<Goals.GoalMetric>('sessions');
  const [target, setTarget] = useState('12');
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]['id']>('month');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = parseInt(target, 10);
    const { start, end } = windowDates(windowId);
    const error = Goals.goalError(metric, n, start, end);
    if (error) {
      Alert.alert('Check the goal', error);
      return;
    }
    setSaving(true);
    try {
      onSaved(await Goals.saveGoal({ metric, target: n, start, end }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} bracket="New goal" title="Set a target" heightRatio={0.72}>
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <Segmented
          options={[
            { value: 'sessions', label: 'Sessions' },
            { value: 'minutes', label: 'Minutes' },
            { value: 'active_days', label: 'Days' },
          ]}
          value={metric}
          onChange={setMetric}
          hue="train"
        />
        <View style={[styles.targetField, { backgroundColor: C.bg }]}>
          <TextInput
            value={target}
            onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            style={[Type.dotHero, styles.targetInput, { color: C.textHi }]}
            accessibilityLabel="Target"
            selectTextOnFocus
          />
          <Text style={[Type.controlLabel, { color: C.textMid }]}>{Goals.METRIC_LABEL[metric].toLowerCase()}</Text>
        </View>
        <View style={styles.chips}>
          {WINDOWS.map((w) => (
            <ChunkyButton
              key={w.id}
              label={w.label}
              variant={windowId === w.id ? 'solid' : 'soft'}
              hue="train"
              size="sm"
              haptic="selection"
              onPress={() => setWindowId(w.id)}
            />
          ))}
        </View>
        <ChunkyButton label="Save goal" icon="flag-checkered" hue="train" onPress={save} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}

// ── Weekly review form ────────────────────────────────────────────────────────

function ReviewSheet({
  visible,
  week,
  initial,
  onClose,
  onSaved,
}: {
  visible: boolean;
  week: string;
  initial: Reviews.WeeklyReview | null;
  onClose: () => void;
  onSaved: (r: Reviews.WeeklyReview) => void;
}) {
  const [win, setWin] = useState('');
  const [challenge, setChallenge] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [confidence, setConfidence] = useState<Reviews.WeeklyReview['confidence']>(3);
  const [saving, setSaving] = useState(false);

  // Re-seed the form each time the sheet opens (during render, not in an effect).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = visible ? `${week}:${initial?.updatedAt ?? 0}` : null;
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (visible) {
      setWin(initial?.win ?? '');
      setChallenge(initial?.challenge ?? '');
      setNextStep(initial?.nextStep ?? '');
      setConfidence(initial?.confidence ?? 3);
    }
  }

  const save = async () => {
    if (!win.trim() || !nextStep.trim()) {
      Alert.alert('Almost', 'Add a win and a next step.');
      return;
    }
    setSaving(true);
    try {
      onSaved(await Reviews.saveReview({ week, win: win.trim(), challenge: challenge.trim(), nextStep: nextStep.trim(), confidence }));
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <View style={styles.reviewField}>
      <Text style={[Type.dotLabel, { color: C.textMid }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => set(t.slice(0, 1000))}
        placeholder={placeholder}
        placeholderTextColor={C.textMid}
        multiline
        style={[Type.body, styles.reviewInput, { color: C.textHi, backgroundColor: C.bg }]}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} bracket="Weekly review" title={`Week of ${shortDate(week)}`} heightRatio={0.9}>
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        {field('A win', win, setWin, 'Hit every session, added 5 kg to squats…')}
        {field('What got in the way', challenge, setChallenge, 'Optional')}
        {field('Next step', nextStep, setNextStep, 'One small thing for next week')}
        <Text style={[Type.dotLabel, { color: C.textMid }]}>How confident are you?</Text>
        <View style={styles.confRow}>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <ChunkyButton
              key={n}
              label={String(n)}
              variant={n <= confidence ? 'solid' : 'soft'}
              hue="train"
              size="md"
              haptic="selection"
              onPress={() => setConfidence(n)}
              style={styles.flex}
              accessibilityLabel={`Confidence ${n} of 5`}
            />
          ))}
        </View>
        <ChunkyButton label="Save review" icon="content-save" hue="train" onPress={save} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  headerPad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 10 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  intro: { gap: Spacing.three, marginBottom: Spacing.two },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  recordValue: { alignItems: 'flex-end' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewFace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastReview: { gap: 6 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  targetField: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.lg },
  targetInput: { minWidth: 80, textAlign: 'center', padding: 0, includeFontPadding: false },
  reviewField: { gap: 6 },
  reviewInput: { minHeight: 64, borderRadius: Radius.md, padding: 12, textAlignVertical: 'top' },
  confRow: { flexDirection: 'row', gap: 8 },
});
