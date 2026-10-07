import { memo } from 'react';
import { View } from 'react-native';

import { BodyMap, bestSide, type BodySide } from '@/components/training/BodyMap';

/**
 * A thumbnail silhouette with a move's target muscles lit — the primary one
 * strongest — so the picture answers "what does this work?" before any label.
 */
export const MuscleChip = memo(function MuscleChip({
  muscleIds,
  side,
  size = 40,
}: {
  muscleIds: string[];
  side?: BodySide;
  /** Width in dp; height follows the body's 1:2 proportions. */
  size?: number;
}) {
  const heat = Object.fromEntries(muscleIds.map((id, index) => [id, index === 0 ? 1 : 0.45]));
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <BodyMap side={side ?? bestSide(muscleIds)} heat={heat} plain width={size} />
    </View>
  );
});
