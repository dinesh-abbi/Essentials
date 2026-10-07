import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseArt } from '@/components/training/ExerciseArt';
import { MuscleChip } from '@/components/training/MuscleChip';
import { ChunkyButton, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Hue, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import * as Catalog from '@/utils/ExerciseCatalog';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import * as Training from '@/utils/TrainingStorage';

const C = Colors.dark;

/**
 * Edit one day of the split: rename it, reorder or drop moves, change sets
 * and reps, and add moves from the library. Every change saves straight to
 * your custom split (local first, synced in the background).
 */
export default function EditDayScreen() {
  const { slot: rawSlot } = useLocalSearchParams<{ slot?: string }>();
  const slot = Math.min(7, Math.max(1, parseInt(rawSlot ?? '1', 10) || 1));
  const insets = useSafeAreaInsets();

  const [days, setDays] = useState<Training.TrainingDay[] | null>(null);
  const [focusText, setFocusText] = useState('');
  const [editing, setEditing] = useState<Training.Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Training.getCachedSplit().then(({ days: cached }) => {
        if (cancelled) return;
        const all = Array.from({ length: 7 }, (_, i) => Training.dayForSlot(cached, i + 1));
        setDays(all);
        setFocusText(all[slot - 1].focus);
      });
      return () => {
        cancelled = true;
      };
    }, [slot]),
  );

  const day = days?.[slot - 1];

  const save = async (nextDay: Training.TrainingDay) => {
    if (!days) return;
    const next = days.map((d) => (d.dayNumber === slot ? nextDay : d));
    setDays(next);
    await Training.saveCustomSplit(next);
    rescheduleRoutineReminders().catch(() => {});
  };

  const setExercises = (exercises: Training.Exercise[]) => day && save({ ...day, exercises });

  const move = (i: number, delta: number) => {
    if (!day) return;
    const j = i + delta;
    if (j < 0 || j >= day.exercises.length) return;
    const list = [...day.exercises];
    [list[i], list[j]] = [list[j], list[i]];
    setExercises(list);
  };

  const remove = (ex: Training.Exercise) =>
    Alert.alert(`Remove ${ex.name}?`, 'It comes off this day of your split.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setEditing(null);
          if (day) setExercises(day.exercises.filter((e) => e.id !== ex.id));
        },
      },
    ]);

  const saveEdit = (patch: Partial<Training.Exercise>) => {
    if (!day || !editing) return;
    const updated = { ...editing, ...patch };
    setEditing(updated);
    setExercises(day.exercises.map((e) => (e.id === updated.id ? updated : e)));
  };

  const add = (entry: Catalog.CatalogExercise) => {
    if (!day) return;
    if (day.exercises.some((e) => e.catalogId === entry.id || e.name.toLowerCase() === entry.name.toLowerCase())) {
      Alert.alert('Already there', `${entry.name} is already on this day.`);
      return;
    }
    setExercises([...day.exercises, Catalog.toSplitExercise(entry, slot)]);
    setAdding(false);
    setQ('');
  };

  const results = useMemo(() => Catalog.search({ q }), [q]);
  const train = Hue.train;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerPad}>
          <ScreenHeader bracket={`Split day ${slot}`} />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        >
          <EntranceView index={0}>
            <TextInput
              value={focusText}
              onChangeText={setFocusText}
              onEndEditing={() => day && focusText.trim() && focusText.trim() !== day.focus && save({ ...day, focus: focusText.trim() })}
              style={[Type.largeTitle, styles.titleInput, { color: C.textHi, borderColor: C.hairline }]}
              accessibilityLabel="Day name"
              placeholder="Day name"
              placeholderTextColor={C.textMid}
              maxLength={60}
            />
            <Text style={[Type.subline, { color: C.textMid }]}>Tap a move to change sets and reps</Text>
          </EntranceView>

          {day?.exercises.length === 0 && (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="weather-night" size={28} color={C.textMid} />
              <Text style={[Type.body, { color: C.textMid }]}>Rest day — add a move to train it</Text>
            </View>
          )}

          {day?.exercises.map((ex, i) => {
            const muscles = Catalog.musclesFor(ex);
            return (
              <EntranceView key={ex.id} index={1 + i}>
                <Tile onPress={() => setEditing(ex)} haptic="selection" style={styles.row} accessibilityLabel={`${ex.name}, ${Training.prescription(ex)}. Edit.`}>
                  <View style={[styles.num, { backgroundColor: train.soft }]}>
                    <Text style={[Type.dotSmall, { color: train.main, fontSize: 16 }]}>{i + 1}</Text>
                  </View>
                  {muscles.length ? <MuscleChip muscleIds={muscles} size={22} /> : null}
                  <View style={styles.flex}>
                    <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={2}>
                      {ex.name}
                    </Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>{Training.prescription(ex)}</Text>
                  </View>
                  <View style={styles.order}>
                    <ChunkyButton icon="chevron-up" variant="soft" hue="train" size="sm" haptic="selection" onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel={`Move ${ex.name} up`} />
                    <ChunkyButton
                      icon="chevron-down"
                      variant="soft"
                      hue="train"
                      size="sm"
                      haptic="selection"
                      onPress={() => move(i, 1)}
                      disabled={i === day.exercises.length - 1}
                      accessibilityLabel={`Move ${ex.name} down`}
                    />
                  </View>
                </Tile>
              </EntranceView>
            );
          })}

          <ChunkyButton label="Add from library" icon="plus" hue="train" onPress={() => setAdding(true)} style={styles.addBtn} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Edit one move ──────────────────────────────────────────────── */}
      <Sheet visible={!!editing} onClose={() => setEditing(null)} bracket="Move" title={editing?.name} heightRatio={0.6}>
        {editing && (
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <View style={styles.fields}>
              <Field label="Sets" value={editing.sets} keyboardType="number-pad" onChange={(v) => saveEdit({ sets: v.replace(/[^0-9]/g, '').slice(0, 2) || '1' })} />
              <Field label="Reps" value={editing.reps} onChange={(v) => saveEdit({ reps: v.slice(0, 16) })} hint="12 or 8-12 · 60 sec" />
            </View>
            <ChunkyButton label="Remove from this day" icon="trash-can-outline" variant="soft" hue="train" onPress={() => remove(editing)} />
          </ScrollView>
        )}
      </Sheet>

      {/* ── Add from library ───────────────────────────────────────────── */}
      <Sheet visible={adding} onClose={() => setAdding(false)} bracket="Library" title="Add a move" heightRatio={0.88}>
        <View style={styles.sheetSearch}>
          <View style={[styles.search, { backgroundColor: C.bg }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={C.textMid} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search moves"
              placeholderTextColor={C.textMid}
              style={[Type.body, styles.flex, { color: C.textHi }]}
              accessibilityLabel="Search the library"
            />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {results.map((e) => (
            <Tile key={e.id} onPress={() => add(e)} haptic="selection" style={styles.row} accessibilityLabel={`Add ${e.name}`}>
              <View style={[styles.thumb, { backgroundColor: C.bg }]}>
                <ExerciseArt exerciseId={e.id} width={56} />
              </View>
              <View style={styles.flex}>
                <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={2}>
                  {e.name}
                </Text>
                <Text style={[Type.subline, { color: C.textMid }]}>
                  {e.equipment} · {e.muscle}
                </Text>
              </View>
              <MaterialCommunityIcons name="plus" size={22} color={train.main} />
            </Tile>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType = 'default',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
  hint?: string;
}) {
  const [text, setText] = useState(value);
  return (
    <View style={styles.field}>
      <Text style={[Type.dotLabel, { color: C.textMid }]}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => text.trim() && text.trim() !== value && onChange(text.trim())}
        keyboardType={keyboardType}
        style={[Type.dotNumber, styles.fieldInput, { color: C.textHi, backgroundColor: C.bg }]}
        accessibilityLabel={label}
        selectTextOnFocus
      />
      {hint ? <Text style={[Type.subline, { color: C.textMid }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  headerPad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 8 },
  flex: { flex: 1 },
  titleInput: { paddingVertical: 4, paddingHorizontal: 0, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  order: { gap: 6 },
  addBtn: { marginTop: Spacing.three },
  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 8 },
  sheetSearch: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 48, borderRadius: Radius.pill },
  thumb: { width: 64, height: 58, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  fields: { flexDirection: 'row', gap: 12, marginBottom: Spacing.three },
  field: { flex: 1, gap: 6 },
  fieldInput: { height: 56, borderRadius: Radius.md, textAlign: 'center', padding: 0 },
});
