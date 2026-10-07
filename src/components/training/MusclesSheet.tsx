import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BodyMap } from '@/components/training/BodyMap';
import { Chip, ChunkyButton } from '@/components/ui/chunky';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Spacing, Type } from '@/constants/theme';
import { getMuscle } from '@/utils/ExerciseCatalog';
import { busiest, normalise, type MuscleLoad } from '@/utils/TrainingVolume';

const C = Colors.dark;

/**
 * Today's muscles on the front and back body — the more sets a muscle gets
 * in today's plan, the hotter it glows. Replaces the old PNG anatomy plates.
 */
export function MusclesSheet({
  visible,
  onClose,
  load,
  onExplore,
}: {
  visible: boolean;
  onClose: () => void;
  /** Planned sets per muscle (primary 1, supporting 0.5). */
  load: MuscleLoad;
  onExplore: () => void;
}) {
  const { width } = useWindowDimensions();
  const heat = normalise(load);
  const top = busiest(load, 6);
  const bodyW = Math.min(170, (width - Spacing.four * 2 - Spacing.three) / 2);

  return (
    <Sheet visible={visible} onClose={onClose} bracket="Muscles" title="Today works" heightRatio={0.85}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.bodies}>
          {(['front', 'back'] as const).map((side) => (
            <View key={side} style={styles.side}>
              <BodyMap side={side} heat={heat} width={bodyW} />
              <Text style={[Type.dotLabel, { color: C.textMid }]}>{side}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chips}>
          {top.map(([id], i) => (
            <Chip key={id} label={getMuscle(id)?.name ?? id} hue="train" solid={i === 0} />
          ))}
        </View>
        <ChunkyButton label="Explore every muscle" icon="human" variant="soft" hue="train" onPress={onExplore} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  side: { alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
});
