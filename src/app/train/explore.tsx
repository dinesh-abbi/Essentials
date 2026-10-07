import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BodyMap, REGIONS_BY_SIDE, regionSides, type BodySide } from '@/components/training/BodyMap';
import { ExerciseArt } from '@/components/training/ExerciseArt';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Chip, ChunkyButton, Tile } from '@/components/ui/chunky';
import { EntranceView } from '@/components/ui/entrance-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { Colors, Hue, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import * as Catalog from '@/utils/ExerciseCatalog';
import * as Training from '@/utils/TrainingStorage';

const C = Colors.dark;

/**
 * Explore — the muscle atlas and exercise library from Forma. Tap a muscle on
 * the body (or its name below), read what it does, then filter the moves
 * that train it by equipment and level. Each move opens its how-to page.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [side, setSide] = useState<BodySide>('front');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [level, setLevel] = useState<'all' | (typeof Catalog.LEVELS)[number]>('all');
  const [q, setQ] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  useDataRefresh(['docs'], () => setReloadTick((n) => n + 1));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Training.getFavourites().then((ids) => !cancelled && setFavourites(ids));
      return () => {
        cancelled = true;
      };
    }, [reloadTick]),
  );

  const info = Catalog.getMuscle(muscle);
  const counts = useMemo(() => new Map(Catalog.regionsWithCounts().map((m) => [m.id, m.exerciseCount])), []);
  const results = useMemo(() => {
    const rows = Catalog.search({ muscle, equipment, level: level === 'all' ? null : level, q });
    return starredOnly ? rows.filter((e) => favourites.includes(e.id)) : rows;
  }, [muscle, equipment, level, q, starredOnly, favourites]);

  const pick = (id: string) => setMuscle((cur) => (cur === id ? null : id));
  const changeSide = (next: BodySide) => {
    setSide(next);
    // Keep a muscle that exists on both views; drop one the new view can't show.
    if (muscle && !regionSides[muscle]?.includes(next)) setMuscle(null);
  };

  const toggleStar = async (id: string) => {
    const on = !favourites.includes(id);
    setFavourites((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
    setFavourites(await Training.setFavourite(id, on));
  };

  const bodyW = Math.min(240, width * 0.58);
  const train = Hue.train;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerPad}>
          <ScreenHeader bracket="Explore" />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        >
          <EntranceView index={0} style={styles.intro}>
            <Text style={[Type.largeTitle, { color: C.textHi }]}>Muscles</Text>
            <Text style={[Type.subline, { color: C.textMid }]}>Tap a muscle to see the moves that train it</Text>
          </EntranceView>

          <EntranceView index={1}>
            <Segmented
              options={[
                { value: 'front', label: 'Front', icon: 'human-handsup' },
                { value: 'back', label: 'Back', icon: 'human-handsdown' },
              ]}
              value={side}
              onChange={changeSide}
              hue="train"
            />
          </EntranceView>

          <EntranceView index={2}>
            <Tile style={styles.atlas}>
              <BodyMap side={side} selected={muscle} onSelect={pick} width={bodyW} />
            </Tile>
          </EntranceView>

          {/* Named selector — the accessible way in, and easier for small muscles. */}
          <EntranceView index={3}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
              {REGIONS_BY_SIDE[side].map((r) => (
                <ChunkyButton
                  key={r.id}
                  label={r.label}
                  variant={muscle === r.id ? 'solid' : 'soft'}
                  hue="train"
                  size="sm"
                  haptic="selection"
                  onPress={() => pick(r.id)}
                  accessibilityLabel={`${r.label}, ${counts.get(r.id as Catalog.MuscleId) ?? 0} moves${muscle === r.id ? ', selected' : ''}`}
                />
              ))}
            </ScrollView>
          </EntranceView>

          {info && (
            <EntranceView index={4}>
              <Tile hue="train" style={styles.infoFace}>
                <View style={styles.infoHead}>
                  <View style={[styles.closeUp, { backgroundColor: C.bg }]}>
                    <BodyMap side={side} selected={info.id} isolated width={100} maxHeight={84} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[Type.title, { color: C.textHi }]}>{info.name}</Text>
                    <Text style={[Type.subline, { color: C.textMid }]}>{info.anatomical_name}</Text>
                    <View style={styles.chips}>
                      <Chip icon="arrow-expand-vertical" label={info.movement} hue="train" />
                    </View>
                  </View>
                </View>
                <Text style={[Type.body, { color: C.textHi }]}>{info.description}</Text>
                <View style={[styles.cue, { backgroundColor: C.surface2 }]}>
                  <MaterialCommunityIcons name="lightbulb-on" size={18} color={train.main} />
                  <Text style={[Type.body, styles.flex, { color: C.textMid }]}>{info.cue}</Text>
                </View>
              </Tile>
            </EntranceView>
          )}

          {/* ── Library ───────────────────────────────────────────────── */}
          <EntranceView index={5} style={styles.libHead}>
            <Text style={[Type.headline, { color: C.textHi }]}>{info ? `${info.name} moves` : 'All moves'}</Text>
            <Text style={[Type.dotSmall, { color: train.main }]}>{results.length}</Text>
          </EntranceView>

          <View style={[styles.search, { backgroundColor: C.surface }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={C.textMid} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search moves or equipment"
              placeholderTextColor={C.textMid}
              style={[Type.body, styles.flex, { color: C.textHi }]}
              accessibilityLabel="Search moves"
              returnKeyType="search"
            />
            {q ? (
              <AnimatedPressable onPress={() => setQ('')} haptic="light" style={styles.clear} accessibilityLabel="Clear search">
                <MaterialCommunityIcons name="close" size={18} color={C.textMid} />
              </AnimatedPressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            <ChunkyButton
              icon={starredOnly ? 'star' : 'star-outline'}
              variant={starredOnly ? 'solid' : 'soft'}
              hue="train"
              size="sm"
              haptic="selection"
              onPress={() => setStarredOnly((v) => !v)}
              accessibilityLabel={starredOnly ? 'Show all moves' : 'Show starred moves only'}
            />
            {Catalog.EQUIPMENT.map((eq) => (
              <ChunkyButton
                key={eq}
                label={eq}
                variant={equipment === eq ? 'solid' : 'soft'}
                hue="train"
                size="sm"
                haptic="selection"
                onPress={() => setEquipment((cur) => (cur === eq ? null : eq))}
              />
            ))}
          </ScrollView>

          <Segmented
            options={[
              { value: 'all', label: 'All' },
              { value: 'Beginner', label: 'Beginner' },
              { value: 'Intermediate', label: 'Intermediate' },
            ]}
            value={level}
            onChange={setLevel}
            hue="train"
          />

          {results.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="dumbbell" size={28} color={C.textMid} />
              <Text style={[Type.body, { color: C.textMid }]}>No moves match — loosen a filter</Text>
            </View>
          ) : (
            results.map((e) => {
              const starred = favourites.includes(e.id);
              return (
                <Tile
                  key={e.id}
                  onPress={() => router.push(`/train/exercise/${e.id}` as any)}
                  haptic="selection"
                  style={styles.row}
                  accessibilityLabel={`${e.name}, ${e.equipment}, ${e.level}`}
                >
                  <View style={[styles.thumb, { backgroundColor: C.bg }]}>
                    <ExerciseArt exerciseId={e.id} width={68} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={2}>
                      {e.name}
                    </Text>
                    <View style={styles.chips}>
                      <Chip label={e.equipment} />
                      <Chip label={e.level} hue={e.level === 'Beginner' ? undefined : 'train'} />
                    </View>
                  </View>
                  <ChunkyButton
                    icon={starred ? 'star' : 'star-outline'}
                    variant={starred ? 'solid' : 'soft'}
                    hue="train"
                    size="md"
                    haptic="light"
                    onPress={() => toggleStar(e.id)}
                    accessibilityLabel={starred ? `Unstar ${e.name}` : `Star ${e.name}`}
                  />
                </Tile>
              );
            })
          )}

          <Text style={[Type.subline, styles.footnote, { color: C.textMid }]}>
            Simplified illustrations, not medical advice. Stop any move that hurts.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  headerPad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 12 },
  flex: { flex: 1 },
  intro: { gap: 6, marginBottom: Spacing.two },
  atlas: { alignItems: 'center', paddingVertical: Spacing.three },
  pills: { gap: 8, paddingVertical: 2 },
  infoFace: { gap: 12 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeUp: { width: 112, height: 96, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cue: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: Radius.md, alignItems: 'flex-start' },
  libHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 48, borderRadius: Radius.pill },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumb: { width: 76, height: 70, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  footnote: { textAlign: 'center', marginTop: Spacing.three },
});
