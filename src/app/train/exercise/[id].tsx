import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseArt } from '@/components/training/ExerciseArt';
import { MuscleChip } from '@/components/training/MuscleChip';
import { BigMessage } from '@/components/ui/big-message';
import { Chip, ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Hue, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import * as Catalog from '@/utils/ExerciseCatalog';
import * as Training from '@/utils/TrainingStorage';

const C = Colors.dark;

/**
 * One library move: the illustration first, then the muscles it works, the
 * steps, breathing, common mistakes and an easier/alternative option — and
 * "Add to a day" to put it in your split.
 */
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ex = Catalog.getExercise(id);

  const [starred, setStarred] = useState(false);
  const [picking, setPicking] = useState(false);
  const [days, setDays] = useState<Training.TrainingDay[]>(Training.DEFAULT_SPLIT);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [favs, split] = await Promise.all([Training.getFavourites(), Training.getCachedSplit()]);
        if (cancelled) return;
        setStarred(!!id && favs.includes(id));
        setDays(split.days);
      })();
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (!ex) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg }]}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.headerPad}>
            <ScreenHeader bracket="Move" />
          </View>
          <BigMessage icon="dumbbell" hue="train" title="Move not found" text="It may have been renamed in an update." />
        </SafeAreaView>
      </View>
    );
  }

  const toggleStar = async () => {
    const on = !starred;
    setStarred(on);
    await Training.setFavourite(ex.id, on);
  };

  const addTo = async (slot: number) => {
    const day = Training.dayForSlot(days, slot);
    if (day.exercises.some((e) => e.catalogId === ex.id || e.name.toLowerCase() === ex.name.toLowerCase())) {
      Alert.alert('Already there', `${ex.name} is already in ${day.focus}.`);
      return;
    }
    const next = Array.from({ length: 7 }, (_, i) => Training.dayForSlot(days, i + 1)).map((d) =>
      d.dayNumber === slot ? { ...d, exercises: [...d.exercises, Catalog.toSplitExercise(ex, slot)] } : d,
    );
    await Training.saveCustomSplit(next);
    setDays(next);
    setPicking(false);
    Alert.alert('Added', `${ex.name} is now in ${day.focus}.`);
  };

  const alternative = Catalog.EXERCISES.find((e) => e.name.toLowerCase() === ex.alternative.toLowerCase());
  const muscles = ex.muscle_ids.map((m) => Catalog.getMuscle(m)).filter((m): m is Catalog.Muscle => !!m);
  const artW = Math.min(320, width - Spacing.three * 2 - Spacing.four * 2);
  const train = Hue.train;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerPad}>
          <ScreenHeader
            bracket={ex.muscle}
            right={
              <ChunkyButton
                icon={starred ? 'star' : 'star-outline'}
                variant={starred ? 'solid' : 'soft'}
                hue="train"
                size="md"
                haptic="light"
                onPress={toggleStar}
                accessibilityLabel={starred ? 'Unstar this move' : 'Star this move'}
              />
            }
          />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
          <EntranceView index={0}>
            <Tile hue="train" style={styles.art}>
              <ExerciseArt exerciseId={ex.id} name={ex.name} width={artW} />
            </Tile>
          </EntranceView>

          <EntranceView index={1} style={styles.titleBlock}>
            <Text style={[Type.headline, { color: C.textHi }]}>{ex.name}</Text>
            <View style={styles.chips}>
              <Chip icon="dumbbell" label={ex.equipment} />
              <Chip icon="signal-cellular-2" label={ex.level} hue={ex.level === 'Beginner' ? undefined : 'train'} />
              <Chip icon="repeat" label={`${ex.sets} × ${ex.reps}`} hue="train" />
            </View>
            <Text style={[Type.subline, { color: C.textMid }]}>{ex.cue}</Text>
          </EntranceView>

          <EntranceView index={2}>
            <Tile style={styles.musclesFace}>
              <MuscleChip muscleIds={ex.muscle_ids} size={54} />
              <View style={styles.flex}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>Works</Text>
                <View style={styles.chips}>
                  {muscles.map((m, i) => (
                    <Chip key={m.id} label={m.name} hue="train" solid={i === 0} />
                  ))}
                </View>
              </View>
            </Tile>
          </EntranceView>

          <EntranceView index={3}>
            <ChunkyButton label="Add to a day" icon="calendar-plus" hue="train" onPress={() => setPicking(true)} />
          </EntranceView>

          <EntranceView index={4}>
            <Tile style={styles.section}>
              <Text style={[Type.dotLabel, { color: C.textMid }]}>How to</Text>
              {ex.steps.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepNum, { backgroundColor: train.soft }]}>
                    <Text style={[Type.dotSmall, { color: train.main, fontSize: 16 }]}>{i + 1}</Text>
                  </View>
                  <Text style={[Type.body, styles.flex, { color: C.textHi }]}>{step}</Text>
                </View>
              ))}
            </Tile>
          </EntranceView>

          <EntranceView index={5}>
            <Tile style={styles.section}>
              <View style={styles.line}>
                <IconBlob name="weather-windy" hue="train" size={36} variant="soft" />
                <Text style={[Type.body, styles.flex, { color: C.textHi }]}>{ex.breathing}</Text>
              </View>
            </Tile>
          </EntranceView>

          <EntranceView index={6}>
            <Tile style={styles.section}>
              <Text style={[Type.dotLabel, { color: C.textMid }]}>Watch out for</Text>
              {ex.mistakes.map((m, i) => (
                <View key={i} style={styles.line}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.warn} />
                  <Text style={[Type.body, styles.flex, { color: C.textHi }]}>{m}</Text>
                </View>
              ))}
            </Tile>
          </EntranceView>

          <EntranceView index={7}>
            <Tile
              style={styles.altFace}
              onPress={alternative ? () => router.push(`/train/exercise/${alternative.id}` as any) : undefined}
              accessibilityLabel={`Alternative: ${ex.alternative}`}
            >
              <IconBlob name="swap-horizontal" hue="train" size={40} variant="soft" />
              <View style={styles.flex}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>Alternative</Text>
                <Text style={[Type.controlLabel, { color: C.textHi }]}>{ex.alternative}</Text>
              </View>
              {alternative ? <MaterialCommunityIcons name="chevron-right" size={22} color={C.textMid} /> : null}
            </Tile>
          </EntranceView>

          <Text style={[Type.subline, styles.footnote, { color: C.textMid }]}>
            Sets, reps and load are starting values, not a prescription. Stop if it hurts.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={picking} onClose={() => setPicking(false)} bracket="Add to a day" title={ex.name} heightRatio={0.75}>
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 7 }, (_, i) => Training.dayForSlot(days, i + 1)).map((d) => {
            const has = d.exercises.some((e) => e.catalogId === ex.id || e.name.toLowerCase() === ex.name.toLowerCase());
            return (
              <Tile
                key={d.dayNumber}
                hue={has ? 'train' : null}
                onPress={() => addTo(d.dayNumber)}
                haptic="selection"
                style={styles.dayRow}
                accessibilityLabel={`Add to day ${d.dayNumber}, ${d.focus}${has ? ', already added' : ''}`}
              >
                <View style={[styles.stepNum, { backgroundColor: has ? train.main : C.surface2 }]}>
                  <Text style={[Type.dotSmall, { color: has ? train.on : C.textHi, fontSize: 16 }]}>{d.dayNumber}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={1}>
                    {d.focus}
                  </Text>
                  <Text style={[Type.subline, { color: C.textMid }]}>
                    {d.exercises.length ? `${d.exercises.length} moves` : 'Rest'}
                  </Text>
                </View>
                <MaterialCommunityIcons name={has ? 'check-bold' : 'plus'} size={22} color={has ? train.main : C.textMid} />
              </Tile>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  headerPad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 12 },
  flex: { flex: 1 },
  art: { alignItems: 'center', paddingVertical: Spacing.three },
  titleBlock: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  musclesFace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  section: { gap: 12 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  altFace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footnote: { textAlign: 'center', marginTop: Spacing.two },
  sheetBody: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: Radius.lg },
});
