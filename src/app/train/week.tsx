import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Barbell from '@/components/illustrations/Barbell';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { Colors, FontFace, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import * as Coach from '@/utils/Coach';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import * as Training from '@/utils/TrainingStorage';
import { isoWeekday, localDateKey } from '@/utils/userDocs';

type Palette = typeof Colors.dark;

export default function WeekPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;

  const [split, setSplit] = useState<{ days: Training.TrainingDay[]; isCustom: boolean }>({
    days: Training.DEFAULT_SPLIT,
    isCustom: false,
  });
  const [offset, setOffset] = useState(0);
  const [doneDates, setDoneDates] = useState<Set<string>>(new Set());
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
    Alert.alert('Back to the default split?', 'Your imported split will be removed from this account.', [
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerPad}>
          <ScreenHeader bracket="[ WEEK PLAN ]" />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        >
          <EntranceView index={0} style={styles.intro}>
            <Text style={[Type.headline, { color: colors.textHi }]}>Your week</Text>
            <Text style={[Type.subline, { color: colors.textMid }]}>
              {split.isCustom ? 'Imported split' : 'Default split'} · tap a day to see it or train it today
            </Text>
            {offset !== 0 && (
              <AnimatedPressable
                onPress={() => applyOffset(0)}
                haptic="light"
                pressOpacity={0.7}
                style={styles.inlineLink}
                accessibilityRole="button"
                accessibilityLabel="Undo this week's schedule shift"
              >
                <Feather name="rotate-ccw" size={14} color={colors.water} />
                <Text style={[Type.controlLabel, { color: colors.water, fontSize: 14 }]}>
                  Shifted {offset > 0 ? '+' : ''}
                  {offset} day{Math.abs(offset) === 1 ? '' : 's'} this week — undo
                </Text>
              </AnimatedPressable>
            )}
          </EntranceView>

          <EntranceView index={1} style={[styles.list, { borderTopColor: colors.hairline }]}>
            {rows.map((r) => {
              const isToday = r.iso === todayIso;
              return (
                <AnimatedPressable
                  key={r.iso}
                  onPress={() => setOpenSlot(r.slot)}
                  haptic="selection"
                  pressScale={0.985}
                  style={[styles.row, { borderBottomColor: colors.hairline }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${Training.WEEKDAY_NAMES[r.iso - 1]}: ${r.day.focus}${r.done ? ', logged' : ''}`}
                >
                  <View style={[styles.rule, { backgroundColor: isToday ? colors.water : 'transparent' }]} />
                  <View style={styles.dateCol}>
                    <Text style={[Type.bracketLabel, { color: isToday ? colors.water : colors.textMid }]}>{r.label}</Text>
                    <Text style={[styles.dateNum, { color: isToday ? colors.textHi : colors.textMid }]}>{r.date.getDate()}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowFocus, { color: r.day.isRecovery ? colors.textMid : colors.textHi }]} numberOfLines={1}>
                      {r.day.focus}
                    </Text>
                    <Text style={[Type.subline, { color: colors.textMid }]}>
                      {r.day.exercises.length > 0 ? `${r.day.exercises.length} movements` : 'Recovery'}
                      {`  ·  split day ${r.slot}`}
                    </Text>
                  </View>
                  {r.done ? (
                    <View style={[styles.doneDot, { backgroundColor: colors.water }]}>
                      <Feather name="check" size={13} color={colors.onAccent} />
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={colors.textLow} />
                  )}
                </AnimatedPressable>
              );
            })}
          </EntranceView>

          <EntranceView index={2} style={[styles.splitCard, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
            <View style={styles.splitHead}>
              <View style={{ flex: 1, gap: Spacing.one }}>
                <Text style={[Type.bracketLabel, { color: colors.water }]}>[ YOUR OWN SPLIT ]</Text>
                <Text style={[Type.body, { color: colors.textHi }]}>
                  {split.isCustom
                    ? 'You’re running an imported split. It syncs to your account.'
                    : 'Have a program as a PDF, a photo or plain text? The coach turns it into this week view.'}
                </Text>
              </View>
              <Barbell size={44} color={colors.water} />
            </View>
            <View style={styles.splitActions}>
              <AnimatedPressable
                onPress={() => setImportOpen(true)}
                haptic="medium"
                pressOpacity={0.85}
                style={[styles.pill, { backgroundColor: colors.water }]}
                accessibilityRole="button"
              >
                <Feather name="upload" size={16} color={colors.onAccent} />
                <Text style={[Type.controlLabel, { color: colors.onAccent }]}>{split.isCustom ? 'Import another' : 'Import a split'}</Text>
              </AnimatedPressable>
              {split.isCustom && (
                <AnimatedPressable
                  onPress={resetSplit}
                  haptic="light"
                  pressOpacity={0.85}
                  style={[styles.pill, { borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth }]}
                  accessibilityRole="button"
                >
                  <Text style={[Type.controlLabel, { color: colors.textHi }]}>Use default</Text>
                </AnimatedPressable>
              )}
            </View>
          </EntranceView>
        </ScrollView>
      </SafeAreaView>

      {/* ── Day detail ─────────────────────────────────────────────────── */}
      <Sheet
        visible={!!openDay}
        onClose={() => setOpenSlot(null)}
        bracket={`[ SPLIT DAY ${openSlot ?? ''} ]`}
        title={openDay?.focus}
        heightRatio={0.8}
      >
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {openDay && !openIsToday && (
            <AnimatedPressable
              onPress={() => makeToday(openDay.dayNumber)}
              haptic="medium"
              pressOpacity={0.85}
              style={[styles.pill, styles.fullPill, { backgroundColor: colors.water }]}
              accessibilityRole="button"
              accessibilityLabel={`Make ${openDay.focus} today's session`}
            >
              <Feather name="zap" size={16} color={colors.onAccent} />
              <Text style={[Type.controlLabel, { color: colors.onAccent }]}>Train this today</Text>
            </AnimatedPressable>
          )}
          {openDay && openDay.exercises.length === 0 && (
            <Text style={[Type.body, { color: colors.textMid }]}>A recovery day — walk, stretch, foam-roll. No lifting.</Text>
          )}
          {openDay?.exercises.map((ex, i) => (
            <View key={ex.id} style={[styles.exRow, { borderBottomColor: colors.hairline }]}>
              <Text style={[Type.badge, styles.exIndex, { color: colors.textMid }]}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.exName, { color: colors.textHi }]}>{ex.name}</Text>
                <Text style={[Type.subline, { color: colors.textMid }]}>
                  {Training.prescription(ex)}
                  {ex.tempo && !ex.isCardio ? `  ·  tempo ${ex.tempo}` : ''}
                </Text>
                {ex.notes ? <Text style={[Type.subline, { color: colors.textMid, marginTop: 4 }]}>{ex.notes}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </Sheet>

      <ImportSheet
        visible={importOpen}
        colors={colors}
        onClose={() => setImportOpen(false)}
        onSaved={(days) => {
          setSplit({ days, isCustom: true });
          setImportOpen(false);
          rescheduleRoutineReminders().catch(() => {});
        }}
      />
    </View>
  );
}

// ─── Import ───────────────────────────────────────────────────────────────────

type Source = { kind: 'text' } | { kind: 'file'; uri: string; name: string; mimeType: string };

function ImportSheet({
  visible,
  colors,
  onClose,
  onSaved,
}: {
  visible: boolean;
  colors: Palette;
  onClose: () => void;
  onSaved: (days: Training.TrainingDay[]) => void;
}) {
  const [source, setSource] = useState<Source>({ kind: 'text' });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Training.TrainingDay[] | null>(null);

  const reset = () => {
    setSource({ kind: 'text' });
    setText('');
    setError(null);
    setPreview(null);
  };

  const pick = async (images: boolean) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: images ? ['image/*'] : ['application/pdf', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const lower = a.name.toLowerCase();
    const mimeType =
      a.mimeType ||
      (lower.endsWith('.pdf') ? 'application/pdf' : lower.endsWith('.txt') ? 'text/plain' : lower.endsWith('.png') ? 'image/png' : 'image/jpeg');
    setSource({ kind: 'file', uri: a.uri, name: a.name, mimeType });
    setError(null);
    setPreview(null);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      let result;
      if (source.kind === 'file') {
        if (source.mimeType === 'text/plain') {
          const raw = await FileSystem.readAsStringAsync(source.uri);
          result = await Coach.parseSplit({ text: raw });
        } else {
          const base64 = await FileSystem.readAsStringAsync(source.uri, { encoding: 'base64' as any });
          result = await Coach.parseSplit({ base64, mimeType: source.mimeType });
        }
      } else {
        result = await Coach.parseSplit({ text });
      }
      if (result.ok) setPreview(result.days);
      else setError(result.message);
    } catch (e: any) {
      setError(e?.message ?? 'Couldn’t read that file.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await Training.saveCustomSplit(preview);
      onSaved(preview);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const canRun = Coach.isConfigured() && !busy && (source.kind === 'file' || text.trim().length > 20);

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        onClose();
        reset();
      }}
      dismissable={!busy}
      bracket="[ IMPORT A SPLIT ]"
      title={preview ? 'Check it, then use it' : 'Give the coach your program'}
    >
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!Coach.isConfigured() && (
          <Text style={[Type.body, { color: colors.alert }]}>
            The coach isn’t configured — add EXPO_PUBLIC_GEMINI_API_KEY to .env and rebuild to import splits.
          </Text>
        )}

        {preview ? (
          <>
            {preview.map((d) => (
              <View key={d.dayNumber} style={[styles.exRow, { borderBottomColor: colors.hairline }]}>
                <Text style={[Type.badge, styles.exIndex, { color: colors.textMid }]}>{Training.WEEKDAY_SHORT[d.dayNumber - 1]}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.exName, { color: d.isRecovery ? colors.textMid : colors.textHi }]}>{d.focus}</Text>
                  <Text style={[Type.subline, { color: colors.textMid }]}>
                    {d.exercises.length ? d.exercises.map((e) => e.name).join(' · ') : 'Recovery'}
                  </Text>
                </View>
              </View>
            ))}
            <View style={styles.splitActions}>
              <AnimatedPressable
                onPress={save}
                disabled={busy}
                haptic="medium"
                style={[styles.pill, { backgroundColor: colors.water }]}
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={[Type.controlLabel, { color: colors.onAccent }]}>Use this split</Text>}
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => setPreview(null)}
                disabled={busy}
                haptic="light"
                style={[styles.pill, { borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth }]}
                accessibilityRole="button"
              >
                <Text style={[Type.controlLabel, { color: colors.textHi }]}>Try again</Text>
              </AnimatedPressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sourceRow}>
              <SourceTile icon="file-text" label="PDF or .txt" colors={colors} onPress={() => pick(false)} />
              <SourceTile icon="image" label="Photo of a plan" colors={colors} onPress={() => pick(true)} />
            </View>

            {source.kind === 'file' ? (
              <View style={[styles.fileChip, { borderColor: colors.water }]}>
                <Feather name="paperclip" size={14} color={colors.water} />
                <Text style={[Type.body, { color: colors.textHi, flex: 1 }]} numberOfLines={1}>
                  {source.name}
                </Text>
                <AnimatedPressable onPress={() => setSource({ kind: 'text' })} haptic="light" accessibilityLabel="Remove file">
                  <Feather name="x" size={16} color={colors.textMid} />
                </AnimatedPressable>
              </View>
            ) : (
              <>
                <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ OR PASTE IT ]</Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder={'Mon — Push: bench 4×8, incline DB 3×10…\nTue — Pull: …'}
                  placeholderTextColor={colors.textLow}
                  style={[styles.textArea, { color: colors.textHi, borderColor: colors.hairline, backgroundColor: colors.surface }]}
                  textAlignVertical="top"
                />
              </>
            )}

            {error && <Text style={[Type.body, { color: colors.alert }]}>{error}</Text>}

            <AnimatedPressable
              onPress={run}
              disabled={!canRun}
              haptic="medium"
              style={[styles.pill, styles.fullPill, { backgroundColor: canRun ? colors.water : colors.surface2 }]}
              accessibilityRole="button"
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.onAccent} />
                  <Text style={[Type.controlLabel, { color: colors.onAccent }]}>Reading your program…</Text>
                </>
              ) : (
                <Text style={[Type.controlLabel, { color: canRun ? colors.onAccent : colors.textMid }]}>Build my week</Text>
              )}
            </AnimatedPressable>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function SourceTile({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: 'file-text' | 'image';
  label: string;
  colors: Palette;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      style={[styles.sourceTile, { borderColor: colors.hairline, backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`Choose a ${label}`}
    >
      <Feather name={icon} size={22} color={colors.water} />
      <Text style={[Type.subline, { color: colors.textHi }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  headerPad: { paddingHorizontal: Spacing.four },
  content: { paddingHorizontal: Spacing.four + Spacing.one, paddingTop: Spacing.three },
  intro: { gap: Spacing.two, marginBottom: Spacing.five },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },

  list: { borderTopWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rule: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: -Spacing.two },
  dateCol: { width: 40, alignItems: 'center', gap: 2 },
  dateNum: { ...Type.readout, fontSize: 22, lineHeight: 26 },
  rowText: { flex: 1, gap: 2 },
  rowFocus: { fontFamily: FontFace.displayBold, fontSize: 17, lineHeight: 22 },
  doneDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  splitCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three + 2, gap: Spacing.three },
  splitHead: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  splitActions: { flexDirection: 'row', gap: Spacing.two },
  pill: {
    flex: 1,
    height: 50,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  fullPill: { flex: 0, alignSelf: 'stretch' },

  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  exRow: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  exIndex: { width: 30, fontSize: 13, marginTop: 2 },
  exName: { fontFamily: FontFace.displayBold, fontSize: 16, lineHeight: 21 },

  sourceRow: { flexDirection: 'row', gap: Spacing.two },
  sourceTile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  textArea: {
    ...Type.body,
    minHeight: 170,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
});
